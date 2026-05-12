// api/lib/pipeline.js  — core ingestion pipeline for Vercel API routes
// Uses Supabase instead of raw pg, processes inline (no Redis/BullMQ)
import { supabase }                           from './supabase.js';
import { triageMessage, getEmbedding,
         generateClusterTitle, cosineDistance } from './gemini.js';
import { v4 as uuid }                          from 'uuid';

const CLUSTER_THRESHOLD      = 0.18;
const ROADMAP_NODE_THRESHOLD = 50;

export async function ingestFeedback(feedback) {
  const id = feedback.id ?? uuid();

  try {
    // ── 1. Persist raw feedback ───────────────────────────────────
    await supabase.from('feedback').upsert({
      id,
      source:      feedback.source,
      sender_id:   feedback.senderId,
      sender_name: feedback.senderName,
      raw_text:    feedback.rawText,
      timestamp:   feedback.timestamp,
      metadata:    feedback.metadata ?? {},
    }, { onConflict: 'id' });

    // ── 2. AI Triage ──────────────────────────────────────────────
    const { classification, confidence, reply } = await triageMessage(feedback.rawText);

    await supabase.from('feedback')
      .update({ triage: classification, confidence })
      .eq('id', id);

    if (classification === 'Spam') return { id, classification, reply: null };

    // ── 3. Embed + Cluster ────────────────────────────────────────
    const embedding   = await getEmbedding(feedback.rawText);
    const vecStr      = `[${embedding.join(',')}]`;
    const clusterId   = await assignToCluster(id, feedback.source, embedding, vecStr, feedback.rawText);

    await supabase.from('feedback')
      .update({ embedding: vecStr, cluster_id: clusterId })
      .eq('id', id);

    // ── 4. Send auto-reply ────────────────────────────────────────
    if (reply) await sendReply(feedback, reply);

    return { id, classification, clusterId, reply };

  } catch (err) {
    console.error(`Pipeline error [${id}]:`, err.message);
    // Dead-letter
    await supabase.from('failed_ingestion').insert({
      feedback_id: id, error_msg: err.message,
      raw_payload: feedback,
    }).catch(() => {});
    throw err;
  }
}

// ── Cluster assignment ───────────────────────────────────────────────
async function assignToCluster(feedbackId, source, embedding, vecStr, rawText) {
  // Find nearest cluster using pgvector (requires supabase RPC or raw SQL)
  const { data: clusters } = await supabase.rpc('find_nearest_clusters', {
    query_embedding: vecStr,
    match_count:     5,
  });

  let assignedId = null;

  for (const cluster of clusters ?? []) {
    const centroid = JSON.parse(cluster.centroid.replace(/[[\]]/g, '')
      .split(',').map(Number));
    // centroid comes as string from Supabase — parse it
    const centroidArr = cluster.centroid
      .replace(/[[\]]/g, '').split(',').map(Number);
    const dist = cosineDistance(embedding, centroidArr);

    if (dist < CLUSTER_THRESHOLD) {
      assignedId   = cluster.id;
      const n      = cluster.member_count;
      const newCentroid = centroidArr.map((v, i) =>
        (v * n + embedding[i]) / (n + 1)
      );
      const mix = cluster.source_mix ?? {};
      mix[source] = (mix[source] ?? 0) + 1;

      await supabase.from('roadmap_clusters')
        .update({
          centroid:     `[${newCentroid.join(',')}]`,
          member_count: n + 1,
          source_mix:   mix,
          updated_at:   new Date().toISOString(),
        })
        .eq('id', assignedId);
      break;
    }
  }

  // No matching cluster → create new one
  if (!assignedId) {
    const title = await generateClusterTitle(rawText);
    const { data } = await supabase.from('roadmap_clusters')
      .insert({
        centroid:     vecStr,
        member_count: 1,
        title,
        status:      'forming',
        source_mix:  { [source]: 1 },
      })
      .select('id')
      .single();
    assignedId = data.id;
  }

  // Check Roadmap Node promotion
  await checkPromotion(assignedId);
  return assignedId;
}

async function checkPromotion(clusterId) {
  const { data } = await supabase
    .from('roadmap_clusters')
    .select('member_count')
    .eq('id', clusterId)
    .single();

  if (!data || data.member_count < ROADMAP_NODE_THRESHOLD) return;

  const demandScore = Math.min(100, Math.round((data.member_count / ROADMAP_NODE_THRESHOLD) * 70 + 30));
  const priority    = demandScore >= 80 ? 'critical'
                    : demandScore >= 55 ? 'high'
                    : demandScore >= 30 ? 'medium' : 'low';

  await supabase.from('roadmap_clusters')
    .update({ is_roadmap_node: true, demand_score: demandScore, priority, status: 'backlog' })
    .eq('id', clusterId);
}

// ── Platform reply dispatcher ────────────────────────────────────────
async function sendReply(feedback, replyText) {
  if (feedback.source === 'gmail' && feedback.metadata?.threadId) {
    // Gmail reply via API route — handled separately to avoid circular imports
    console.log(`📧 Gmail reply queued for ${feedback.senderId}`);
  } else if (feedback.source === 'instagram') {
    const token = process.env.META_PAGE_ACCESS_TOKEN;
    if (!token) return;
    await fetch(
      `https://graph.facebook.com/v19.0/me/messages?access_token=${token}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: feedback.senderId },
          message:   { text: replyText },
          messaging_type: 'RESPONSE',
        }),
      }
    );
  }
}
