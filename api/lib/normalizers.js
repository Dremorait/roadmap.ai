// api/lib/normalizers.js
import { v4 as uuid } from 'uuid';

export function normalizeGmail(email) {
  return {
    id:          uuid(),
    source:      'gmail',
    senderId:    email.from?.address ?? email.from ?? 'unknown',
    senderName:  email.from?.name    ?? email.from ?? 'Gmail User',
    rawText:     email.rawText ?? email.snippet ?? '',
    timestamp:   email.date ?? new Date().toISOString(),
    metadata:    { threadId: email.threadId, subject: email.subject, messageId: email.id },
    embedding:   null, clusterId: null, triage: null,
  };
}

export function normalizeInstagram(event) {
  return {
    id:          uuid(),
    source:      'instagram',
    senderId:    String(event.sender?.id ?? 'unknown'),
    senderName:  event.sender?.name  ?? 'Instagram User',
    rawText:     event.message?.text ?? '',
    timestamp:   event.timestamp ? new Date(event.timestamp).toISOString() : new Date().toISOString(),
    metadata:    { mid: event.message?.mid, recipientId: event.recipient?.id },
    embedding:   null, clusterId: null, triage: null,
  };
}

export function normalizeSlack(event) {
  return {
    id:          uuid(),
    source:      'slack',
    senderId:    event.event?.user     ?? 'unknown',
    senderName:  event.event?.username ?? 'Slack User',
    rawText:     event.event?.text     ?? '',
    timestamp:   event.event_time ? new Date(event.event_time * 1000).toISOString() : new Date().toISOString(),
    metadata:    { channel: event.event?.channel, team: event.team_id },
    embedding:   null, clusterId: null, triage: null,
  };
}
