// server/pipeline.js — Pillar 1+2: Parallel processing, new triage fields
import { query }         from './db.js';
import { triageMessage } from './triage.js';
import { assignCluster } from './clustering.js';
import { sendReply }     from './replyService.js';

/**
 * Main ingestion pipeline — now runs triage + embedding in parallel.
 * raw feedback → DB → parallel(triage + embed/cluster) → auto-reply
 */
export async function ingestFeedback(feedback) {
  const rawText = feedback.rawText ?? feedback.raw_text ?? '';

  // Skip if already fully processed (deduplication)
  const { rows: existing } = await query(
    `SELECT triage FROM feedback WHERE id = $1`,
    [feedback.id]
  );
  if (existing.length && existing[0].triage && existing[0].triage !== 'Spam') {
    console.log(`⏭️  Skipping already-processed feedback ${feedback.id}`);
    return;
  }

  // ── Step 1: Persist raw feedback immediately ───────────────────────────
  await query(`
    INSERT INTO feedback
      (id, source, sender_id, sender_name, raw_text, timestamp, metadata)
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
    ON CONFLICT (id) DO NOTHING
  `, [
    feedback.id,
    feedback.source,
    feedback.senderId,
    feedback.senderName,
    rawText,
    feedback.timestamp,
    JSON.stringify(feedback.metadata ?? {}),
  ]);

  // ── Step 2: Run triage + cluster in parallel (2x speedup) ─────────────
  const [triage, clusterId] = await Promise.all([
    triageMessage({ rawText, raw_text: rawText }),
    assignCluster({ id: feedback.id, rawText, source: feedback.source }).catch(e => {
      console.warn('⚠️ Cluster assign failed (non-fatal):', e.message);
      return null;
    }),
  ]);

  // ── Step 3: Persist AI-enriched fields ────────────────────────────────
  await query(`
    UPDATE feedback
    SET triage          = $1,
        confidence      = $2,
        urgency         = $3,
        product_area    = $4,
        key_phrase      = $5,
        sentiment_score = $6,
        auto_replied    = false
    WHERE id = $7
  `, [
    triage.classification,
    triage.confidence,
    triage.urgency,
    triage.product_area,
    triage.key_phrase,
    triage.sentiment_score,
    feedback.id,
  ]);

  console.log(`✅ Triaged [${feedback.id}]: ${triage.classification} (urgency ${triage.urgency}) → ${triage.product_area}`);

  // ── Step 4: Auto-reply (skip Spam, skip if no reply text) ─────────────
  if (triage.classification !== 'Spam' && triage.reply?.trim()) {
    try {
      await sendReply(feedback, triage.reply);
      await query(`UPDATE feedback SET auto_replied = true WHERE id = $1`, [feedback.id]);
      console.log(`📨 Auto-replied to ${feedback.senderId ?? feedback.id}`);
    } catch (replyErr) {
      console.warn('⚠️ Auto-reply failed (non-fatal):', replyErr.message);
    }
  }
}
