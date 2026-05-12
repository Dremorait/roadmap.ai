// api/webhook/gmail.js  — Vercel Serverless Function
// Google Pub/Sub pushes here when a new Gmail arrives
import { normalizeGmail }  from '../lib/normalizers.js';
import { ingestFeedback }  from '../lib/pipeline.js';
import { fetchNewEmails }  from '../lib/gmailService.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Parse the Pub/Sub message BEFORE sending any response
  // (Vercel terminates the function as soon as res.end() is called)
  const raw = req.body?.message?.data;
  if (!raw) {
    console.log('webhook: no message.data in body', JSON.stringify(req.body));
    return res.status(200).json({ ok: true, skipped: 'no data' });
  }

  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  } catch (e) {
    console.error('webhook: base64 decode failed', e.message);
    return res.status(200).json({ ok: true, skipped: 'decode error' });
  }

  const { emailAddress, historyId } = decoded;
  console.log('webhook: received for', emailAddress, 'historyId', historyId);

  if (!emailAddress || !historyId) {
    console.log('webhook: missing emailAddress or historyId', decoded);
    return res.status(200).json({ ok: true, skipped: 'missing fields' });
  }

  try {
    const emails = await fetchNewEmails(emailAddress, historyId);
    console.log(`webhook: fetched ${emails.length} new email(s)`);

    for (const email of emails) {
      const feedback = normalizeGmail(email);
      await ingestFeedback(feedback);
      console.log('webhook: ingested email from', email.from?.address);
    }
  } catch (err) {
    console.error('webhook: pipeline error', err.message);
  }

  // ACK LAST — after all processing is done
  return res.status(200).json({ ok: true });
}
