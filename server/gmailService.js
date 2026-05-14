// server/gmailService.js
// ── Fixes applied ────────────────────────────────────────────────────────────
//  Bug 1: Removed static global oauth2Client — every call now receives fresh
//          tokens loaded from the DB, so new OAuth credentials are always used.
//  Bug 3: Added proactive token-refresh before every API call. If the access
//          token is expired (or will expire within 5 min), we force-refresh and
//          write the new tokens back to integration_config so they survive
//          server restarts.
// ─────────────────────────────────────────────────────────────────────────────
import { google } from 'googleapis';
import { query }  from './db.js';
import 'dotenv/config';

// ── Auth factory ─────────────────────────────────────────────────────────────

/**
 * Build a ready-to-use OAuth2Client from stored token data.
 * Automatically refreshes the access token when it is expired or near-expiry,
 * then persists the new tokens back to integration_config.
 *
 * @param {object} tokens  { access_token, refresh_token, expiry_date }
 * @param {string} workspaceId  Used when persisting refreshed tokens
 * @returns {google.auth.OAuth2}
 */
export async function getAuthClient(tokens, workspaceId = process.env.DEFAULT_WORKSPACE_ID ?? 'default') {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI,
  );

  client.setCredentials({
    access_token:  tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date:   tokens.expiry_date,
  });

  // Refresh if expired or expiring within 5 minutes
  const fiveMin = 5 * 60 * 1000;
  const isExpired = tokens.expiry_date
    ? Date.now() >= (Number(tokens.expiry_date) - fiveMin)
    : true; // if no expiry stored, always refresh

  if (isExpired && tokens.refresh_token) {
    try {
      const { credentials } = await client.refreshAccessToken();
      client.setCredentials(credentials);

      // Persist refreshed tokens back to DB
      await query(`
        UPDATE integration_config
        SET config = config || $1::jsonb, last_sync_at = NOW()
        WHERE source = 'gmail' AND workspace_id = $2
      `, [
        JSON.stringify({
          access_token: credentials.access_token,
          expiry_date:  credentials.expiry_date,
        }),
        workspaceId,
      ]);

      console.log('🔄 Gmail access token refreshed and saved');
    } catch (err) {
      console.error('❌ Token refresh failed:', err.message);
      throw new Error(`Gmail token refresh failed: ${err.message}`);
    }
  }

  return client;
}

/**
 * Load stored Gmail tokens from DB for a given workspace.
 * @param {string} workspaceId
 * @returns {object|null}  token object or null if not connected
 */
export async function loadTokensFromDb(workspaceId = process.env.DEFAULT_WORKSPACE_ID ?? 'default') {
  const { rows } = await query(`
    SELECT config FROM integration_config
    WHERE source = 'gmail' AND workspace_id = $1 AND is_active = true
  `, [workspaceId]);

  if (!rows.length) return null;
  return rows[0].config; // { access_token, refresh_token, expiry_date, email, ... }
}

// ── Email fetching ────────────────────────────────────────────────────────────

/**
 * Fetch emails that arrived since a given historyId (called by Pub/Sub webhook).
 * Bug 1 fix: accepts `tokens` object instead of using a global client.
 *
 * @param {string} userEmail     Gmail address (from Pub/Sub payload)
 * @param {string} historyId     Starting history ID from the Pub/Sub notification
 * @param {object} tokens        { access_token, refresh_token, expiry_date }
 * @param {string} workspaceId
 * @returns {Promise<object[]>}  Array of parsed email objects
 */
export async function fetchNewEmails(userEmail, historyId, tokens, workspaceId) {
  const emails = [];

  try {
    const auth  = await getAuthClient(tokens, workspaceId);
    const gmail = google.gmail({ version: 'v1', auth });

    // Fetch history changes since last known historyId
    const histRes = await gmail.users.history.list({
      userId:         'me',
      startHistoryId: String(historyId),
      historyTypes:   ['messageAdded'],
      labelId:        'INBOX',
    });

    const records = histRes.data.history ?? [];
    console.log(`📜 History records since ${historyId}: ${records.length}`);

    for (const record of records) {
      for (const added of record.messagesAdded ?? []) {
        const msgId = added.message.id;

        try {
          const msgRes = await gmail.users.messages.get({
            userId: 'me',
            id:     msgId,
            format: 'full',
          });

          const parsed = parseGmailMessage(msgRes.data);
          if (parsed.rawText?.length > 5) emails.push(parsed);
        } catch (msgErr) {
          console.error(`⚠️ Failed to fetch message ${msgId}:`, msgErr.message);
        }
      }
    }
  } catch (err) {
    console.error('❌ Gmail history fetch error:', err.message);
    if (err.code === 401) {
      console.error('  → 401 Unauthorized. Tokens may be revoked — re-auth required.');
    }
    if (err.code === 404) {
      console.warn('  → 404 historyId not found (too old). Triggering full resync.');
      // historyId is too old — caller should do a fresh fetchInboxHistory
    }
  }

  return emails;
}

/**
 * Initial inbox backfill — fetches the most recent N emails from INBOX.
 * Bug 2 fix: Called immediately after OAuth so the dashboard is never empty.
 * Handles full pagination automatically.
 *
 * @param {object} tokens        { access_token, refresh_token, expiry_date }
 * @param {string} workspaceId
 * @param {number} maxResults    How many messages to fetch (default: 50)
 * @returns {Promise<object[]>}  Array of parsed email objects
 */
export async function fetchInboxHistory(tokens, workspaceId, maxResults = 50) {
  const emails = [];

  try {
    const auth  = await getAuthClient(tokens, workspaceId);
    const gmail = google.gmail({ version: 'v1', auth });

    let pageToken   = undefined;
    let fetched     = 0;
    const batchSize = Math.min(maxResults, 100); // Gmail API max per page is 100

    console.log(`📥 Starting inbox backfill (up to ${maxResults} emails)...`);

    do {
      const listRes = await gmail.users.messages.list({
        userId:      'me',
        labelIds:    ['INBOX'],
        maxResults:  Math.min(batchSize, maxResults - fetched),
        pageToken,
        // Exclude chats, drafts, promotions
        q: '-in:chats -in:drafts category:primary OR category:updates OR category:forums',
      });

      const messages  = listRes.data.messages ?? [];
      pageToken       = listRes.data.nextPageToken;

      // Fetch full content for each message (parallel batches of 10)
      const CHUNK = 10;
      for (let i = 0; i < messages.length; i += CHUNK) {
        const chunk   = messages.slice(i, i + CHUNK);
        const results = await Promise.allSettled(
          chunk.map(m =>
            gmail.users.messages.get({ userId: 'me', id: m.id, format: 'full' })
          )
        );

        for (const result of results) {
          if (result.status === 'fulfilled') {
            const parsed = parseGmailMessage(result.value.data);
            if (parsed.rawText?.length > 5) emails.push(parsed);
          }
        }
      }

      fetched += messages.length;
      console.log(`  → Fetched ${fetched} / ${maxResults} (page done)`);

    } while (pageToken && fetched < maxResults);

    console.log(`✅ Inbox backfill complete: ${emails.length} usable emails`);
  } catch (err) {
    console.error('❌ Inbox backfill failed:', err.message);
  }

  return emails;
}

// ── Send reply ────────────────────────────────────────────────────────────────

/**
 * Send a reply to a Gmail thread.
 * @param {string} threadId
 * @param {string} toAddress
 * @param {string} subject
 * @param {string} body
 * @param {object} tokens
 * @param {string} workspaceId
 */
export async function sendGmailReply(threadId, toAddress, subject, body, tokens, workspaceId) {
  const auth  = await getAuthClient(tokens, workspaceId);
  const gmail = google.gmail({ version: 'v1', auth });
  const raw   = makeRawEmail(toAddress, `Re: ${subject}`, body);

  await gmail.users.messages.send({
    userId:      'me',
    requestBody: { raw, threadId },
  });
}

// ── Gmail Watch ───────────────────────────────────────────────────────────────

/**
 * Register (or renew) a Gmail Pub/Sub watch for the connected inbox.
 * @param {object} tokens
 * @param {string} workspaceId
 * @returns {object}  watch response data { historyId, expiration }
 */
export async function registerGmailWatch(tokens, workspaceId) {
  const auth  = await getAuthClient(tokens, workspaceId);
  const gmail = google.gmail({ version: 'v1', auth });

  const res = await gmail.users.watch({
    userId: 'me',
    requestBody: {
      topicName:         process.env.GOOGLE_PUBSUB_TOPIC,
      labelIds:          ['INBOX'],
      labelFilterAction: 'include',
    },
  });

  console.log('📡 Gmail watch registered, expiry:', new Date(Number(res.data.expiration)));
  return res.data; // { historyId, expiration }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function parseGmailMessage(msg) {
  const headers  = msg.payload?.headers ?? [];
  const getH     = (name) => headers.find(h => h.name.toLowerCase() === name)?.value ?? '';

  const from     = getH('from');
  const subject  = getH('subject');
  const date     = getH('date');

  // Parse "Name <email>" format
  const nameMatch = from.match(/^(.*?)\s*<(.+)>$/);
  const fromObj   = nameMatch
    ? { name: nameMatch[1].replace(/"/g, '').trim(), address: nameMatch[2] }
    : { name: from, address: from };

  // Extract plain-text body — walk MIME tree recursively
  let rawText = msg.snippet ?? '';
  rawText = extractTextFromParts(msg.payload) || rawText;

  return {
    id:       msg.id,
    threadId: msg.threadId,
    from:     fromObj,
    subject,
    date:     date ? new Date(date).toISOString() : new Date().toISOString(),
    snippet:  msg.snippet,
    rawText,
    labelIds: msg.labelIds ?? [],
  };
}

/** Recursively walk MIME parts to extract the best plain-text body */
function extractTextFromParts(payload) {
  if (!payload) return '';

  // Single-part plain text
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf8').trim();
  }

  // Multi-part — walk children
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractTextFromParts(part);
      if (text) return text;
    }
  }

  return '';
}

function makeRawEmail(to, subject, body) {
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    '',
    body,
  ].join('\r\n');

  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
