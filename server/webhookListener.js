// server/webhookListener.js
// ── Fixes applied ────────────────────────────────────────────────────────────
//  Bug 1 fix (downstream): now loads fresh tokens from DB before calling
//            fetchNewEmails, so the auth client always has valid credentials.
//  Bug 4 fix: after fetching new emails, persists the latest historyId from
//            the history.list response back to integration_config, giving a
//            valid cursor for the next webhook delivery.
// ─────────────────────────────────────────────────────────────────────────────
import express                                    from 'express';
import crypto                                     from 'crypto';
import { normalizeInstagram, normalizeGmail,
         normalizeSlack }                         from './normalizers.js';
import { fetchNewEmails, loadTokensFromDb }        from './gmailService.js';
import { query }                                  from './db.js';
import { Queue }                                  from 'bullmq';
import 'dotenv/config';

export const ingestionQueue = new Queue('feedback-ingestion', {
  connection: { host: process.env.REDIS_HOST ?? 'localhost', port: 6379 },
});

const router = express.Router();

// ── Instagram / Meta Graph API ───────────────────────────────────────────────

/** Webhook verification handshake */
router.get('/instagram', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

/** Receive Instagram DM events */
router.post('/instagram', verifyMetaSignature, async (req, res) => {
  res.sendStatus(200); // Always ACK within 5 s to avoid Meta retries

  const entries = req.body?.entry ?? [];
  for (const entry of entries) {
    for (const event of entry.messaging ?? []) {
      if (!event.message?.text) continue;
      const feedback = normalizeInstagram(event);
      await enqueue(feedback);
    }
  }
});

// ── Gmail Pub/Sub Push Notifications ────────────────────────────────────────

router.post('/gmail', async (req, res) => {
  res.sendStatus(200); // ACK Pub/Sub immediately — must respond within 10 s

  const raw = req.body?.message?.data;
  if (!raw) return;

  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  } catch { return; }

  const { emailAddress, historyId } = decoded;
  if (!emailAddress || !historyId) return;

  const workspaceId = process.env.DEFAULT_WORKSPACE_ID ?? 'default';

  // Bug 1 fix: load fresh tokens from DB (not a stale global variable)
  let tokens;
  try {
    tokens = await loadTokensFromDb(workspaceId);
    if (!tokens) {
      console.error('❌ Gmail webhook: no active token found in DB — re-auth required');
      return;
    }
  } catch (dbErr) {
    console.error('❌ Gmail webhook: failed to load tokens from DB:', dbErr.message);
    return;
  }

  // Use whichever historyId is larger (Pub/Sub vs stored) to avoid re-processing
  const storedHistoryId = tokens.last_history_id;
  const effectiveHistoryId = storedHistoryId && BigInt(storedHistoryId) > BigInt(historyId)
    ? storedHistoryId
    : historyId;

  console.log(`📬 Gmail webhook: emailAddress=${emailAddress}, historyId=${effectiveHistoryId}`);

  // Fetch new emails using the history API
  const emails = await fetchNewEmails(emailAddress, effectiveHistoryId, tokens, workspaceId);

  for (const email of emails) {
    const feedback = normalizeGmail(email);
    await enqueue(feedback);
  }

  // Bug 4 fix: persist the latest historyId as our new cursor
  if (emails.length > 0 || effectiveHistoryId !== storedHistoryId) {
    try {
      // The next startHistoryId to use is the Pub/Sub-provided one (it's always up-to-date)
      await query(`
        UPDATE integration_config
        SET config = config || $1::jsonb, last_sync_at = NOW()
        WHERE source = 'gmail' AND workspace_id = $2
      `, [
        JSON.stringify({ last_history_id: historyId }),
        workspaceId,
      ]);
    } catch (updateErr) {
      console.error('⚠️ Failed to persist historyId:', updateErr.message);
    }
  }
});

// ── Slack Events API ─────────────────────────────────────────────────────────

router.post('/slack', async (req, res) => {
  // Slack URL verification challenge
  if (req.body?.type === 'url_verification') {
    return res.json({ challenge: req.body.challenge });
  }

  res.sendStatus(200);

  const event = req.body?.event;
  // Only handle regular user messages (not bots)
  if (!event || event.type !== 'message' || event.subtype || event.bot_id) return;

  const feedback = normalizeSlack(req.body);
  await enqueue(feedback);
});

// ── Health / Stats endpoint ──────────────────────────────────────────────────

router.get('/health', async (_req, res) => {
  const waiting   = await ingestionQueue.getWaitingCount();
  const active    = await ingestionQueue.getActiveCount();
  const failed    = await ingestionQueue.getFailedCount();
  const completed = await ingestionQueue.getCompletedCount();
  res.json({ status: 'ok', queue: { waiting, active, failed, completed } });
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function enqueue(feedback) {
  await ingestionQueue.add('ingest', feedback, {
    attempts:         3,
    backoff:          { type: 'exponential', delay: 2000 },
    removeOnComplete: 500,
    removeOnFail:     100,
  });
  console.log(`📥 Queued [${feedback.source}] ${feedback.id}`);
}

/** HMAC-SHA256 verification for Meta webhooks */
function verifyMetaSignature(req, res, next) {
  const sig      = req.headers['x-hub-signature-256'] ?? '';
  const body     = JSON.stringify(req.body);
  const expected = 'sha256=' + crypto
    .createHmac('sha256', process.env.META_APP_SECRET ?? '')
    .update(body)
    .digest('hex');

  if (sig !== expected) {
    console.warn('⚠️ Invalid Meta signature — request rejected');
    return res.sendStatus(401);
  }
  next();
}

export default router;
