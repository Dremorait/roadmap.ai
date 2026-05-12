// server/replyService.js
import { sendGmailReply } from './gmailService.js';
import 'dotenv/config';

/**
 * Route a reply to the correct platform channel.
 * @param {object} feedback  - CustomerFeedback object
 * @param {string} replyText - AI-drafted reply
 */
export async function sendReply(feedback, replyText) {
  switch (feedback.source) {
    case 'gmail':
      await replyViaGmail(feedback, replyText);
      break;

    case 'instagram':
      await replyViaInstagram(feedback, replyText);
      break;

    case 'slack':
      await replyViaSlack(feedback, replyText);
      break;

    default:
      console.warn(`⚠️ No reply channel configured for source: ${feedback.source}`);
  }
}

// ── Channel implementations ──────────────────────────────────────────

async function replyViaGmail(feedback, replyText) {
  const threadId = feedback.metadata?.threadId;
  const subject  = feedback.metadata?.subject ?? 'Your feedback';
  const to       = feedback.senderId;

  if (!threadId || !to) {
    console.warn('Gmail reply skipped — missing threadId or recipient');
    return;
  }

  await sendGmailReply(threadId, to, subject, replyText);
  console.log(`📧 Gmail reply sent → ${to}`);
}

async function replyViaInstagram(feedback, replyText) {
  // Meta Graph API — Send Message endpoint
  const recipientId = feedback.senderId;
  const pageToken   = process.env.META_PAGE_ACCESS_TOKEN;

  if (!pageToken) {
    console.warn('Instagram reply skipped — META_PAGE_ACCESS_TOKEN not set');
    return;
  }

  const res = await fetch(
    `https://graph.facebook.com/v19.0/me/messages?access_token=${pageToken}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient:  { id: recipientId },
        message:    { text: replyText },
        messaging_type: 'RESPONSE',
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error('Instagram reply error:', err);
    return;
  }

  console.log(`📱 Instagram reply sent → ${recipientId}`);
}

async function replyViaSlack(feedback, replyText) {
  const channel     = feedback.metadata?.channel;
  const slackToken  = process.env.SLACK_BOT_TOKEN;

  if (!slackToken || !channel) {
    console.warn('Slack reply skipped — missing token or channel');
    return;
  }

  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json; charset=utf-8',
      'Authorization': `Bearer ${slackToken}`,
    },
    body: JSON.stringify({ channel, text: replyText }),
  });

  const data = await res.json();
  if (!data.ok) {
    console.error('Slack reply error:', data.error);
    return;
  }

  console.log(`⚡ Slack reply sent → ${channel}`);
}
