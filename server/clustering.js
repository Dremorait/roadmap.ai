// server/clustering.js
import { query }                        from './db.js';
import { getEmbedding, cosineDistance } from './embeddings.js';
import { GoogleGenerativeAI }           from '@google/generative-ai';
import 'dotenv/config';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const CLUSTER_DISTANCE_THRESHOLD = 0.18;  // cosine distance — tighter = stricter grouping
const ROADMAP_NODE_THRESHOLD     = 50;    // min members to become a Roadmap Node
const FORMING_THRESHOLD          = 5;     // min members to leave "forming" status

/**
 * Core pipeline step: embed → find/create cluster → maybe promote to Roadmap Node.
 * @param {{ id: string, rawText: string, source: string }} feedback
 * @returns {Promise<string>} clusterId
 */
export async function assignCluster(feedback) {
  const { id, rawText, source } = feedback;

  // 1. Generate embedding
  const embedding = await getEmbedding(rawText);
  const vecStr    = `[${embedding.join(',')}]`;

  // 2. Persist embedding to feedback row
  await query(
    `UPDATE feedback SET embedding = $1::vector WHERE id = $2`,
    [vecStr, id]
  );

  // 3. Find nearest existing cluster centroids via pgvector ANN
  const { rows: nearClusters } = await query(`
    SELECT id, centroid, member_count, title, source_mix
    FROM   roadmap_clusters
    ORDER  BY centroid <=> $1::vector
    LIMIT  5
  `, [vecStr]);

  let assignedClusterId = null;

  for (const cluster of nearClusters) {
    // Parse stored centroid back to float[]
    const centroid = cluster.centroid
      .replace(/[[\]]/g, '')
      .split(',')
      .map(Number);

    const dist = cosineDistance(embedding, centroid);

    if (dist < CLUSTER_DISTANCE_THRESHOLD) {
      assignedClusterId = cluster.id;
      const n           = cluster.member_count;

      // Running average centroid update
      const newCentroid = centroid.map((v, i) =>
        (v * n + embedding[i]) / (n + 1)
      );

      // Update source_mix counter
      const mix = cluster.source_mix ?? {};
      mix[source] = (mix[source] ?? 0) + 1;

      await query(`
        UPDATE roadmap_clusters
        SET    centroid     = $1::vector,
               member_count = member_count + 1,
               source_mix   = $2::jsonb,
               updated_at   = NOW()
        WHERE  id = $3
      `, [`[${newCentroid.join(',')}]`, JSON.stringify(mix), cluster.id]);

      break;
    }
  }

  // 4. No suitable cluster → create a new one
  if (!assignedClusterId) {
    const title = await generateClusterTitle(rawText);

    const { rows } = await query(`
      INSERT INTO roadmap_clusters
        (centroid, member_count, title, status, source_mix)
      VALUES ($1::vector, 1, $2, 'forming', $3::jsonb)
      RETURNING id
    `, [vecStr, title, JSON.stringify({ [source]: 1 })]);

    assignedClusterId = rows[0].id;
  }

  // 5. Link feedback → cluster
  await query(
    `UPDATE feedback SET cluster_id = $1 WHERE id = $2`,
    [assignedClusterId, id]
  );

  // 6. Check promotion thresholds
  await checkClusterPromotion(assignedClusterId);

  return assignedClusterId;
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Use Gemini Flash to generate a short, human-readable cluster title
 * from the seed message text.
 */
async function generateClusterTitle(seedText) {
  try {
    const model  = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(
      `In 4–6 words max, give a product-manager-style cluster title for this customer message.
       Return ONLY the title, no quotes, no punctuation at the end.
       Message: "${seedText.slice(0, 200)}"`
    );
    return result.response.text().trim().slice(0, 80);
  } catch {
    return seedText.slice(0, 50) + '…';
  }
}

/**
 * Recalculate demand score and promote cluster to a Roadmap Node if thresholds are met.
 */
async function checkClusterPromotion(clusterId) {
  const { rows } = await query(`
    SELECT
      rc.id,
      rc.member_count,
      rc.title,
      rc.status,
      AVG(f.confidence)  AS avg_confidence,
      COUNT(f.id)        AS total,
      AVG(
        CASE
          WHEN f.triage = 'Bug Report'      THEN 0.1
          WHEN f.triage = 'Feature Request' THEN 0.6
          ELSE 0.5
        END
      ) AS urgency_weight
    FROM roadmap_clusters rc
    LEFT JOIN feedback f ON f.cluster_id = rc.id
    WHERE rc.id = $1
    GROUP BY rc.id
  `, [clusterId]);

  if (!rows.length) return;
  const c = rows[0];

  const total       = Number(c.total);
  const urgency     = Number(c.urgency_weight ?? 0.5);
  const demandScore = Math.min(100, Math.round(
    (total / ROADMAP_NODE_THRESHOLD) * 60 + urgency * 40
  ));

  const priority = demandScore >= 80 ? 'critical'
                 : demandScore >= 55 ? 'high'
                 : demandScore >= 30 ? 'medium' : 'low';

  // Determine new status
  const newStatus = c.status === 'released'   ? 'released'
                  : total >= ROADMAP_NODE_THRESHOLD ? 'backlog'
                  : total >= FORMING_THRESHOLD      ? 'forming'
                  : 'forming';

  const isNode = total >= ROADMAP_NODE_THRESHOLD;

  await query(`
    UPDATE roadmap_clusters
    SET demand_score    = $1,
        priority        = $2,
        status          = $3,
        is_roadmap_node = $4,
        updated_at      = NOW()
    WHERE id = $5
  `, [demandScore, priority, newStatus, isNode, clusterId]);
}

/**
 * Nightly job: full K-means centroid recalculation for all clusters.
 * Run via cron: 0 2 * * *
 */
export async function recalculateAllCentroids() {
  const { rows: clusters } = await query(
    `SELECT id FROM roadmap_clusters`
  );

  for (const { id } of clusters) {
    const { rows: members } = await query(
      `SELECT embedding FROM feedback WHERE cluster_id = $1 AND embedding IS NOT NULL`,
      [id]
    );
    if (!members.length) continue;

    // Average all member embeddings
    const dims    = 768;
    const centroid = new Array(dims).fill(0);
    for (const m of members) {
      const vec = m.embedding.replace(/[[\]]/g, '').split(',').map(Number);
      for (let i = 0; i < dims; i++) centroid[i] += vec[i] / members.length;
    }

    await query(
      `UPDATE roadmap_clusters SET centroid = $1::vector, updated_at = NOW() WHERE id = $2`,
      [`[${centroid.join(',')}]`, id]
    );
  }

  console.log(`✅ Recalculated centroids for ${clusters.length} clusters`);
}
