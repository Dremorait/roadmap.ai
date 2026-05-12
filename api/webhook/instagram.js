// api/webhook/instagram.js  — Vercel Serverless Function
import crypto              from 'crypto';
import { normalizeInstagram } from '../lib/normalizers.js';
import { ingestFeedback }  from '../lib/pipeline.js';

export default async function handler(req, res) {
  // Meta verification handshake (GET)
  if (req.method === 'GET') {
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).end();
  }

  if (req.method !== 'POST') return res.status(405).end();

  // Verify HMAC signature
  const sig      = req.headers['x-hub-signature-256'] ?? '';
  const expected = 'sha256=' + crypto
    .createHmac('sha256', process.env.META_APP_SECRET ?? '')
    .update(JSON.stringify(req.body))
    .digest('hex');
  if (sig !== expected) return res.status(401).end();

  res.status(200).json({ ok: true }); // ACK immediately

  for (const entry of req.body?.entry ?? []) {
    for (const event of entry.messaging ?? []) {
      if (!event.message?.text) continue;
      await ingestFeedback(normalizeInstagram(event));
    }
  }
}
