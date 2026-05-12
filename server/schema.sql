-- ============================================================
-- Roadmap.ai — Complete Database Schema
-- Run this ONCE on your PostgreSQL database
-- Requires: pgvector extension
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Unified Feedback Table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS feedback (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source         TEXT NOT NULL
                   CHECK (source IN ('instagram','gmail','slack','zendesk','intercom')),
  sender_id      TEXT NOT NULL,
  sender_name    TEXT,
  raw_text       TEXT NOT NULL,
  timestamp      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata       JSONB        DEFAULT '{}',

  -- AI-enriched fields (populated by pipeline)
  embedding      vector(768),
  cluster_id     UUID,
  triage         TEXT CHECK (triage IN
                   ('Support Query','Feature Request','Bug Report','Spam')),
  confidence     FLOAT,
  auto_replied   BOOLEAN DEFAULT false,

  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Fast ANN vector search (IVFFlat — good up to ~2M rows)
CREATE INDEX IF NOT EXISTS feedback_embedding_idx
  ON feedback USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS feedback_cluster_idx   ON feedback(cluster_id);
CREATE INDEX IF NOT EXISTS feedback_source_idx    ON feedback(source);
CREATE INDEX IF NOT EXISTS feedback_triage_idx    ON feedback(triage);
CREATE INDEX IF NOT EXISTS feedback_created_idx   ON feedback(created_at DESC);

-- ── Roadmap Clusters / Nodes ────────────────────────────────
CREATE TABLE IF NOT EXISTS roadmap_clusters (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title            TEXT NOT NULL,
  summary          TEXT,

  -- Centroid = running average of all member embeddings
  centroid         vector(768),
  member_count     INT     DEFAULT 0,
  demand_score     FLOAT   DEFAULT 0,

  priority         TEXT DEFAULT 'low'
                     CHECK (priority IN ('critical','high','medium','low')),
  status           TEXT DEFAULT 'forming'
                     CHECK (status IN ('forming','backlog','in_progress','released')),
  is_roadmap_node  BOOLEAN DEFAULT false,

  tags             TEXT[]  DEFAULT '{}',
  source_mix       JSONB   DEFAULT '{}',  -- { instagram: N, gmail: N, ... }

  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cluster_centroid_idx
  ON roadmap_clusters USING ivfflat (centroid vector_cosine_ops)
  WITH (lists = 50);

CREATE INDEX IF NOT EXISTS cluster_node_idx
  ON roadmap_clusters(is_roadmap_node)
  WHERE is_roadmap_node = true;

CREATE INDEX IF NOT EXISTS cluster_status_idx
  ON roadmap_clusters(status);

-- Add FK after both tables exist
ALTER TABLE feedback
  ADD CONSTRAINT IF NOT EXISTS fk_feedback_cluster
  FOREIGN KEY (cluster_id) REFERENCES roadmap_clusters(id)
  ON DELETE SET NULL;

-- ── Dead-Letter Queue (failed ingestion) ────────────────────
CREATE TABLE IF NOT EXISTS failed_ingestion (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feedback_id   UUID,
  error_msg     TEXT,
  raw_payload   JSONB,
  retries       INT DEFAULT 0,
  resolved      BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Integration Config (per-workspace settings) ─────────────
CREATE TABLE IF NOT EXISTS integration_config (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id  UUID NOT NULL,
  source        TEXT NOT NULL
                  CHECK (source IN ('instagram','gmail','slack','zendesk','intercom')),
  is_active     BOOLEAN DEFAULT false,
  config        JSONB DEFAULT '{}',   -- API keys, channel IDs, etc (encrypted in prod)
  last_sync_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (workspace_id, source)
);

-- ── Helper view: Roadmap Nodes with full stats ──────────────
CREATE OR REPLACE VIEW roadmap_nodes_view AS
  SELECT
    rc.id,
    rc.title,
    rc.summary,
    rc.member_count,
    rc.demand_score,
    rc.priority,
    rc.status,
    rc.source_mix,
    rc.tags,
    rc.created_at,
    rc.updated_at,
    COUNT(f.id)                                              AS total_feedback,
    COUNT(*) FILTER (WHERE f.triage = 'Bug Report')         AS bug_count,
    COUNT(*) FILTER (WHERE f.triage = 'Feature Request')    AS feature_count,
    COUNT(*) FILTER (WHERE f.auto_replied = true)           AS auto_replied_count
  FROM roadmap_clusters rc
  LEFT JOIN feedback f ON f.cluster_id = rc.id
  WHERE rc.is_roadmap_node = true
  GROUP BY rc.id
  ORDER BY rc.demand_score DESC;
