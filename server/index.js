// server/index.js  — Main Express server entry point (Enhanced)
import express                from 'express';
import cors                   from 'cors';
import compression            from 'compression';
import rateLimit              from 'express-rate-limit';
import 'dotenv/config';

import webhookRouter          from './webhookListener.js';
import authRouter             from './routes/auth.js';
import { pool, query }        from './db.js';
import { registerGmailWatch, loadTokensFromDb } from './gmailService.js';
import { recalculateAllCentroids } from './clustering.js';
import { generateDailySummary, detectTrendingTopics } from './insightEngine.js';
import { sendReply }          from './replyService.js';

import './workers/embeddingWorker.js';

const app  = express();
const PORT = process.env.PORT ?? 4000;

// ── Middleware ───────────────────────────────────────────────────────
app.use(compression()); // Pillar 4: Gzip/Brotli compression
app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }));
app.use(express.json());

// Rate limiting — protect against brute force/DOS
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// ── Webhook routes ───────────────────────────────────────────────────
app.use('/webhook', webhookRouter);

// ── Auth routes (Gmail OAuth flow) ───────────────────────────────────
app.use('/auth', authRouter);

// ── REST API ─────────────────────────────────────────────────────────

/** GET /api/clusters — all roadmap node candidates */
app.get('/api/clusters', async (_req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        rc.id, rc.title, rc.summary, rc.member_count,
        rc.demand_score, rc.priority, rc.status,
        rc.source_mix, rc.tags, rc.is_roadmap_node,
        rc.created_at, rc.updated_at,
        COUNT(f.id)          AS total_feedback,
        AVG(f.sentiment_score) AS avg_sentiment
      FROM roadmap_clusters rc
      LEFT JOIN feedback f ON f.cluster_id = rc.id
      GROUP BY rc.id
      ORDER BY rc.demand_score DESC, rc.member_count DESC
      LIMIT 100
    `);
    res.json({ clusters: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/feedback — advanced feedback query with filters + search */
app.get('/api/feedback', async (req, res) => {
  const limit  = Math.min(Number(req.query.limit  ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);
  const { source, triage, area, search, urgency_min } = req.query;

  let sql = `
    SELECT id, source, sender_name, raw_text, triage, confidence, urgency,
           product_area, key_phrase, sentiment_score, auto_replied, 
           cluster_id, timestamp, created_at
    FROM feedback
    WHERE 1=1
  `;
  const params = [limit, offset];
  let pIdx = 3;

  if (source) { sql += ` AND source = $${pIdx++}`; params.push(source); }
  if (triage) { sql += ` AND triage = $${pIdx++}`; params.push(triage); }
  if (area)   { sql += ` AND product_area = $${pIdx++}`; params.push(area); }
  if (urgency_min) { sql += ` AND urgency >= $${pIdx++}`; params.push(Number(urgency_min)); }
  if (search) { 
    sql += ` AND (raw_text ILIKE $${pIdx} OR key_phrase ILIKE $${pIdx} OR sender_name ILIKE $${pIdx})`;
    params.push(`%${search}%`);
    pIdx++;
  }

  sql += ` ORDER BY created_at DESC LIMIT $1 OFFSET $2`;

  try {
    const { rows } = await query(sql, params);
    res.json({ feedback: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/insights — trending topics and latest summary */
app.get('/api/insights', async (_req, res) => {
  try {
    const trends = await detectTrendingTopics();
    const { rows: summaries } = await query(`
      SELECT * FROM daily_summaries ORDER BY date DESC LIMIT 7
    `);
    res.json({ trends, summaries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/feedback/:id/reply — manual AI reply trigger */
app.post('/api/feedback/:id/reply', async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;

  try {
    const { rows } = await query(`SELECT * FROM feedback WHERE id = $1`, [id]);
    if (!rows.length) return res.status(404).json({ error: 'Feedback not found' });
    
    const feedback = rows[0];
    // Map to the shape expected by sendReply
    const mappedFeedback = {
      id: feedback.id,
      source: feedback.source,
      senderId: feedback.sender_id,
      senderName: feedback.sender_name,
      metadata: feedback.metadata
    };

    await sendReply(mappedFeedback, text);
    await query(`UPDATE feedback SET auto_replied = true WHERE id = $1`, [id]);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/stats — dashboard summary numbers */
app.get('/api/stats', async (_req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        COUNT(*)                                         AS total_feedback,
        COUNT(*) FILTER (WHERE triage = 'Bug Report')   AS bugs,
        COUNT(*) FILTER (WHERE triage = 'Feature Request') AS features,
        COUNT(*) FILTER (WHERE triage = 'Spam')         AS spam,
        COUNT(*) FILTER (WHERE auto_replied = true)     AS auto_replied,
        AVG(sentiment_score)                            AS avg_sentiment,
        (SELECT COUNT(*) FROM roadmap_clusters WHERE is_roadmap_node = true) AS roadmap_nodes
      FROM feedback
    `);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/admin/generate-summary — force daily summary gen */
app.post('/api/admin/generate-summary', async (_req, res) => {
  try {
    const result = await generateDailySummary();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/admin/recalculate — trigger nightly centroid job manually */
app.post('/api/admin/recalculate', async (_req, res) => {
  recalculateAllCentroids().catch(console.error);
  res.json({ status: 'Centroid recalculation started in background' });
});

// ── Server startup ───────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`\n🚀 Roadmap.ai server running on port ${PORT}`);

  // Verify DB connection
  try {
    await pool.query('SELECT 1');
    console.log('✅ Database connected');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
  }

  // Renew Gmail watch on startup
  if (process.env.GOOGLE_PUBSUB_TOPIC) {
    try {
      const tokens = await loadTokensFromDb();
      if (tokens?.refresh_token) {
        await registerGmailWatch(tokens);
      }
    } catch (err) {
      console.warn('⚠️ Gmail watch registration skipped:', err.message);
    }
  }
});

export default app;
