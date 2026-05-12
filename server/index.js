// server/index.js  — Main Express server entry point
import express                from 'express';
import cors                   from 'cors';
import 'dotenv/config';
import webhookRouter          from './webhookListener.js';
import { pool, query }        from './db.js';
import { registerGmailWatch } from './gmailService.js';
import { recalculateAllCentroids } from './clustering.js';

const app  = express();
const PORT = process.env.PORT ?? 4000;

// ── Middleware ───────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }));
app.use(express.json());

// ── Webhook routes ───────────────────────────────────────────────────
app.use('/webhook', webhookRouter);

// ── REST API — Clusters (for frontend Integrations page) ─────────────

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
        AVG(f.confidence)    AS avg_confidence
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

/** GET /api/feedback — recent feedback with pagination */
app.get('/api/feedback', async (req, res) => {
  const limit  = Math.min(Number(req.query.limit  ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);
  const source = req.query.source;

  try {
    const { rows } = await query(`
      SELECT id, source, sender_name, raw_text, triage, confidence,
             auto_replied, cluster_id, timestamp, created_at
      FROM   feedback
      ${source ? 'WHERE source = $3' : ''}
      ORDER  BY created_at DESC
      LIMIT  $1 OFFSET $2
    `, source ? [limit, offset, source] : [limit, offset]);

    res.json({ feedback: rows });
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
        (SELECT COUNT(*) FROM roadmap_clusters WHERE is_roadmap_node = true) AS roadmap_nodes
      FROM feedback
    `);
    res.json(rows[0]);
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

  // Register Gmail watch on startup (renews every 7 days)
  if (process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_PUBSUB_TOPIC) {
    try {
      await registerGmailWatch();
    } catch (err) {
      console.warn('⚠️ Gmail watch registration skipped:', err.message);
    }
  }
});

export default app;
