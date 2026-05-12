// server/gmailService.js
import { google } from 'googleapis';
import 'dotenv/config';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_OAUTH_CLIENT_ID,
  process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  process.env.GOOGLE_OAUTH_REDIRECT_URI
);

// Load stored tokens (in production, fetch these from your DB per-user)
oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

/**
 * Fetch new emails using a Gmail historyId delta.
 * Called after a Pub/Sub push notification arrives.
 * @param {string} userEmail
 * @param {string} historyId
 * @returns {Promise<object[]>} normalized email objects
 */
export async function fetchNewEmails(userEmail, historyId) {
  const emails = [];

  try {
    // Get history of changes since last historyId
    const histRes = await gmail.users.history.list({
      userId:          'me',
      startHistoryId:  historyId,
      historyTypes:    ['messageAdded'],
      labelId:         'INBOX',
    });

    const records = histRes.data.history ?? [];

    for (const record of records) {
      for (const added of record.messagesAdded ?? []) {
        const msgId = added.message.id;

        // Fetch full message
        const msgRes = await gmail.users.messages.get({
          userId: 'me',
          id:     msgId,
          format: 'full',
        });

        const parsed = parseGmailMessage(msgRes.data);
        if (parsed.rawText?.length > 5) emails.push(parsed);
      }
    }
  } catch (err) {
    console.error('Gmail fetch error:', err.message);
  }

  return emails;
}

/**
 * Send a reply to a Gmail thread.
 * @param {string} threadId
 * @param {string} toAddress
 * @param {string} subject
 * @param {string} body
 */
export async function sendGmailReply(threadId, toAddress, subject, body) {
  const raw = makeRawEmail(toAddress, `Re: ${subject}`, body);
  await gmail.users.messages.send({
    userId:      'me',
    requestBody: { raw, threadId },
  });
}

/**
 * Register a Gmail Pub/Sub watch (call once to activate push notifications).
 * Run this on server startup or via an admin endpoint.
 */
export async function registerGmailWatch() {
  const res = await gmail.users.watch({
    userId: 'me',
    requestBody: {
      topicName:  process.env.GOOGLE_PUBSUB_TOPIC,
      labelIds:   ['INBOX'],
      labelFilterAction: 'include',
    },
  });
  console.log('📧 Gmail watch registered, expiry:', new Date(Number(res.data.expiration)));
  return res.data;
}

// ── Helpers ──────────────────────────────────────────────────────────

function parseGmailMessage(msg) {
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

  // Extract plain-text body
  let rawText = msg.snippet ?? '';
  const parts = msg.payload?.parts ?? [msg.payload];
  for (const part of parts) {
    if (part?.mimeType === 'text/plain' && part?.body?.data) {
      rawText = Buffer.from(part.body.data, 'base64').toString('utf8').trim();
      break;
    }
  }

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
