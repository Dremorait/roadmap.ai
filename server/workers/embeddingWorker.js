// server/workers/embeddingWorker.js
import { Worker, QueueEvents } from 'bullmq';
import { ingestFeedback }      from '../pipeline.js';
import 'dotenv/config';

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: 6379,
};

// ── Main worker — processes feedback-ingestion queue ────────────────
const worker = new Worker(
  'feedback-ingestion',
  async (job) => {
    const feedback = job.data;
    console.log(`⚙️  Processing job ${job.id} [${feedback.source}] ${feedback.id}`);
    await ingestFeedback(feedback);
  },
  {
    connection,
    concurrency: 10,          // 10 messages processed simultaneously
    limiter: {
      max:      50,           // max 50 jobs per window
      duration: 10_000,       // per 10 seconds — respects Gemini rate limits
    },
  }
);

// ── Queue event monitoring ───────────────────────────────────────────
const queueEvents = new QueueEvents('feedback-ingestion', { connection });

queueEvents.on('completed', ({ jobId }) => {
  console.log(`✅ Job ${jobId} completed`);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`❌ Job ${jobId} failed: ${failedReason}`);
});

worker.on('error', (err) => {
  console.error('Worker error:', err.message);
});

console.log('🚀 Embedding worker started — concurrency: 10');

// ── Graceful shutdown ────────────────────────────────────────────────
process.on('SIGTERM', async () => {
  console.log('🛑 Worker shutting down...');
  await worker.close();
  process.exit(0);
});
