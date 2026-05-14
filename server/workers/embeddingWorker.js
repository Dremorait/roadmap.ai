// server/workers/embeddingWorker.js — Pillar 1: faster concurrency, job dedup
import { Worker, QueueEvents } from 'bullmq';
import { ingestFeedback }      from '../pipeline.js';
import { query }               from '../db.js';
import 'dotenv/config';

const REDIS_CONFIG = {
  host: process.env.REDIS_HOST ?? '127.0.0.1',
  port: Number(process.env.REDIS_PORT ?? 6379),
};

// ── Main worker — processes feedback-ingestion queue ─────────────────────
const worker = new Worker(
  'feedback-ingestion',
  async (job) => {
    const feedback = job.data;
    const jobNum   = job.id;

    // Skip jobs with no usable text
    const text = feedback.rawText ?? feedback.raw_text ?? '';
    if (!text || text.trim().length < 5) {
      console.log(`⏭️  Job ${jobNum} skipped (no text)`);
      return;
    }

    console.log(`⚙️  Processing job ${jobNum} [${feedback.source ?? 'unknown'}] ${feedback.id}`);
    await ingestFeedback(feedback);
  },
  {
    connection:  REDIS_CONFIG,
    concurrency: 25,   // upgraded from 10
    removeOnComplete: { count: 200 },
    removeOnFail:     { count: 100 },
  }
);

worker.on('failed', async (job, err) => {
  console.error(`❌ Pipeline error for ${job?.data?.id}: ${err.message}`);

  // Dead-letter queue — log failed jobs so we can retry later
  if (job?.data?.id) {
    try {
      await query(`
        INSERT INTO failed_ingestion (feedback_id, error_msg, raw_payload)
        VALUES ($1, $2, $3::jsonb)
        ON CONFLICT DO NOTHING
      `, [job.data.id, err.message, JSON.stringify(job.data)]);
    } catch (dbErr) {
      // Never crash the worker over a dead-letter write failure
      console.warn('Dead-letter write failed:', dbErr.message);
    }
  }
});

worker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

worker.on('error', (err) => {
  console.error('Worker error:', err.message);
});

console.log('🚀 Embedding worker started — concurrency: 25');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Worker shutting down...');
  await worker.close();
});
