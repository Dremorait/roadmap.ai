-- ================================================================
-- Roadmap.ai — Supabase Database Schema
-- Run this entire file in: Supabase Dashboard → SQL Editor → Run
-- ================================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ── 1. PROFILES (extends Supabase auth.users) ──────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz default now()
);

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── 2. FEEDBACK ─────────────────────────────────────────────────
create table if not exists public.feedback (
  id              text primary key,
  user_id         uuid references auth.users(id) on delete cascade,
  source          text not null,          -- slack | intercom | zendesk | manual
  author          text,
  avatar          text,
  text            text not null,
  sentiment       numeric(4,2) default 0.5,
  sentiment_label text,
  tags            text[]  default '{}',
  votes           integer default 0,
  cluster_id      text,
  timestamp_label text,
  created_at      timestamptz default now()
);

-- ── 3. CLUSTERS ─────────────────────────────────────────────────
create table if not exists public.clusters (
  id          text primary key,
  user_id     uuid references auth.users(id) on delete cascade,
  name        text not null,
  color       text,
  icon        text,
  feedback_ids text[] default '{}',
  created_at  timestamptz default now()
);

-- ── 4. PRDs (Spec documents) ────────────────────────────────────
create table if not exists public.prds (
  id           text primary key,
  user_id      uuid references auth.users(id) on delete cascade,
  text         text not null,
  feedback_ids text[] default '{}',
  created_at   timestamptz default now()
);

-- ── 5. ROADMAP ITEMS ────────────────────────────────────────────
create table if not exists public.roadmap_items (
  id        text primary key,
  user_id   uuid references auth.users(id) on delete cascade,
  title     text not null,
  priority  text default 'medium',   -- critical | high | medium | low
  effort    text default 'M',        -- S | M | L | XL
  impact    integer default 5,
  status    text default 'planned',  -- planned | in-progress | review | shipped
  prd_id    text references public.prds(id) on delete set null,
  created_at timestamptz default now()
);

-- ── 6. Row Level Security (RLS) ──────────────────────────────────
alter table public.profiles      enable row level security;
alter table public.feedback      enable row level security;
alter table public.clusters      enable row level security;
alter table public.prds          enable row level security;
alter table public.roadmap_items enable row level security;

-- Profiles: users can only see/edit their own
create policy "Own profile" on public.profiles
  for all using (auth.uid() = id);

-- Feedback: users can only see/edit their own
create policy "Own feedback" on public.feedback
  for all using (auth.uid() = user_id);

-- Clusters: users can only see/edit their own
create policy "Own clusters" on public.clusters
  for all using (auth.uid() = user_id);

-- PRDs: users can only see/edit their own
create policy "Own prds" on public.prds
  for all using (auth.uid() = user_id);

-- Roadmap items: users can only see/edit their own
create policy "Own roadmap" on public.roadmap_items
  for all using (auth.uid() = user_id);

-- ================================================================
-- Done! All tables and policies are created.
-- ================================================================
