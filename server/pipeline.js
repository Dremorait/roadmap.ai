// server/pipeline.js
import { query }         from './db.js';
import { triageMessage } from './triage.js';
import { assignCluster } from './clustering.js';
import { sendReply }     from './replyService.js';

/**
 * Main ingestion pipeline:
 * raw feedback → DB → triage → cluster → auto-reply
 *
 * @param {object} feedback  CustomerFeedback (normalized)
 */
export async function ingestFeedback(feedback) {
  try {
    // ── Step 1: Persist raw feedback immediately ─────────────────
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
      feedback.rawText,
      feedback.timestamp,
      JSON.stringify(feedback.metadata ?? {}),
    ]);

    // ── Step 2: AI Triage ────────────────────────────────────────
    const { classification, confidence, reply } = await triageMessage(feedback);

    await query(`
      UPDATE feedback
      SET triage = $1, confidence = $2
      WHERE id = $3
    `, [classification, confidence, feedback.id]);

    // ── Step 3: Drop spam early — nothing more to do ─────────────
    if (classification === 'Spam') {
      console.log(`🗑️  Spam discarded [${feedback.source}] ${feedback.id}`);
      return;
    }

    // ── Step 4: Embed → assign to cluster ────────────────────────
    const clusterId = await assignCluster({
      id:     feedback.id,
      rawText: feedback.rawText,
      source:  feedback.source,
    });

    console.log(
      `🧩 [${feedback.source}] ${feedback.id} → ${classification} → cluster ${clusterId}`
    );

    // ── Step 5: Send auto-reply ───────────────────────────────────
    if (reply) {
      await sendReply(feedback, reply);
      await query(
        `UPDATE feedback SET auto_replied = true WHERE id = $1`,
        [feedback.id]
      );
    }

  } catch (err) {
    console.error(`❌ Pipeline error for ${feedback.id}:`, err.message);

    // Dead-letter queue — store for manual review
    try {
      await query(`
        INSERT INTO failed_ingestion (feedback_id, error_msg, raw_payload, created_at)
        VALUES ($1, $2, $3::jsonb, NOW())
      `, [feedback.id, err.message, JSON.stringify(feedback)]);
    } catch (dlErr) {
      console.error('Dead-letter write failed:', dlErr.message);
    }
  }
}
