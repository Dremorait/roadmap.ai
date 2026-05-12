// server/normalizers.js
import { v4 as uuid } from 'uuid';

/**
 * Normalize an Instagram Messaging event into CustomerFeedback.
 * @param {object} event  - Meta Graph API messaging entry
 */
export function normalizeInstagram(event) {
  return {
    id:          uuid(),
    source:      'instagram',
    senderId:    String(event.sender?.id ?? 'unknown'),
    senderName:  event.sender?.name  ?? 'Instagram User',
    rawText:     event.message?.text ?? '',
    timestamp:   event.timestamp
                   ? new Date(event.timestamp).toISOString()
                   : new Date().toISOString(),
    metadata: {
      mid:         event.message?.mid,
      recipientId: event.recipient?.id,
    },
    embedding:  null,
    clusterId:  null,
    triage:     null,
  };
}

/**
 * Normalize a Gmail message object (fetched via Gmail API) into CustomerFeedback.
 * @param {object} email - decoded Gmail message
 */
export function normalizeGmail(email) {
  // Extract plain-text body from Gmail parts
  const body = extractGmailBody(email);

  return {
    id:          uuid(),
    source:      'gmail',
    senderId:    email.from?.address ?? email.from ?? 'unknown',
    senderName:  email.from?.name    ?? email.from ?? 'Gmail User',
    rawText:     body,
    timestamp:   email.date ?? new Date().toISOString(),
    metadata: {
      threadId:  email.threadId,
      subject:   email.subject ?? '(no subject)',
      messageId: email.id,
      labelIds:  email.labelIds ?? [],
    },
    embedding:  null,
    clusterId:  null,
    triage:     null,
  };
}

/**
 * Normalize a Slack event_callback into CustomerFeedback.
 */
export function normalizeSlack(event) {
  return {
    id:          uuid(),
    source:      'slack',
    senderId:    event.event?.user     ?? 'unknown',
    senderName:  event.event?.username ?? 'Slack User',
    rawText:     event.event?.text     ?? '',
    timestamp:   event.event_time
                   ? new Date(event.event_time * 1000).toISOString()
                   : new Date().toISOString(),
    metadata: {
      channel:   event.event?.channel,
      team:      event.team_id,
      eventType: event.event?.type,
    },
    embedding:  null,
    clusterId:  null,
    triage:     null,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────

function extractGmailBody(msg) {
  // Try snippet first (safe fallback)
  if (msg.snippet) return msg.snippet;

  // Walk MIME parts
  const parts = msg.payload?.parts ?? [msg.payload];
  for (const part of parts ?? []) {
    if (part?.mimeType === 'text/plain' && part?.body?.data) {
      return Buffer.from(part.body.data, 'base64').toString('utf8').trim();
    }
  }
  return '';
}
