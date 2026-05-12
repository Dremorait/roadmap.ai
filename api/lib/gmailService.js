// api/lib/gmailService.js — Gmail API helpers for Vercel functions
import { google }   from 'googleapis';
import { supabase } from './supabase.js';

/**
 * Build an authenticated Gmail client using the stored refresh token from Supabase.
 */
async function getGmailClient() {
  const { data } = await supabase
    .from('integration_config')
    .select('config')
    .eq('source', 'gmail')
    .eq('workspace_id', 'default')
    .single();

  if (!data?.config?.refreshToken) {
    throw new Error('Gmail not connected — visit /api/auth/google to authorize');
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: data.config.refreshToken,
    access_token:  data.config.accessToken,
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

/**
 * Fetch new emails using Gmail history delta.
 */
export async function fetchNewEmails(userEmail, historyId) {
  const gmail  = await getGmailClient();
  const emails = [];

  try {
    const histRes = await gmail.users.history.list({
      userId:         'me',
      startHistoryId: historyId,
      historyTypes:   ['messageAdded'],
      labelId:        'INBOX',
    });

    for (const record of histRes.data.history ?? []) {
      for (const added of record.messagesAdded ?? []) {
        const msgRes = await gmail.users.messages.get({
          userId: 'me', id: added.message.id, format: 'full',
        });
        const parsed = parseMessage(msgRes.data);
        if (parsed.rawText?.length > 5) emails.push(parsed);
      }
    }
  } catch (err) {
    console.error('Gmail fetchNewEmails error:', err.message);
  }

  return emails;
}

function parseMessage(msg) {
  const headers = msg.payload?.headers ?? [];
  const getH    = (n) => headers.find(h => h.name.toLowerCase() === n)?.value ?? '';
  const from    = getH('from');
  const match   = from.match(/^(.*?)\s*<(.+)>$/);
  const fromObj = match
    ? { name: match[1].replace(/"/g, '').trim(), address: match[2] }
    : { name: from, address: from };

  let rawText = msg.snippet ?? '';
  for (const part of msg.payload?.parts ?? [msg.payload]) {
    if (part?.mimeType === 'text/plain' && part?.body?.data) {
      rawText = Buffer.from(part.body.data, 'base64').toString('utf8').trim();
      break;
    }
  }

  return {
    id: msg.id, threadId: msg.threadId,
    from: fromObj, subject: getH('subject'),
    date: new Date(getH('date')).toISOString(),
    snippet: msg.snippet, rawText,
  };
}
