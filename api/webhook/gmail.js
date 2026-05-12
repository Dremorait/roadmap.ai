// api/webhook/gmail.js  — Vercel Serverless Function
// Google Pub/Sub pushes here when a new Gmail arrives
import { normalizeGmail }  from '../lib/normalizers.js';
import { ingestFeedback }  from '../lib/pipeline.js';
import { fetchNewEmails }  from '../lib/gmailService.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Always ACK Pub/Sub immediately to prevent retries
  res.status(200).json({ ok: true });

  const raw = req.body?.message?.data;
  if (!raw) return;

  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  } catch { return; }

  const { emailAddress, historyId } = decoded;
  if (!emailAddress || !historyId) return;

  const emails = await fetchNewEmails(emailAddress, historyId);
  for (const email of emails) {
    const feedback = normalizeGmail(email);
    await ingestFeedback(feedback);
  }
}
