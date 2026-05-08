# 🚀 Roadmap.ai — Deployment Guide

> **Stack:** React 19 · Vite 8 · TailwindCSS 4 · Framer Motion · Supabase · React Router v7

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Local Development](#2-local-development)
3. [Environment Variables](#3-environment-variables)
4. [Supabase Auth Setup](#4-supabase-auth-setup)
5. [Production Build](#5-production-build)
6. [Deploy to Vercel *(Recommended)*](#6-deploy-to-vercel-recommended)
7. [Deploy to VPS / Self-Host](#7-deploy-to-vps--self-host)
8. [Custom Domain](#8-custom-domain)
9. [Pre-Launch Checklist](#9-pre-launch-checklist)
10. [Tech Stack Reference](#10-tech-stack-reference)

---

## 1. Prerequisites

Make sure these are installed on your machine:

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 18.x | [nodejs.org](https://nodejs.org) |
| npm | ≥ 9.x | Bundled with Node.js |
| Git | Any | [git-scm.com](https://git-scm.com) |

---

## 2. Local Development

```bash
# Clone / navigate to project
cd c:\xampp\htdocs\Roadmap.ai

# Install dependencies
npm install

# Start dev server (hot-reload enabled)
npm run dev
```

Dev server runs at → **http://localhost:5173**

Other useful commands:

```bash
npm run build      # Production build → outputs to /dist
npm run preview    # Preview the production build locally
npm run lint       # Run ESLint checks
```

---

## 3. Environment Variables

Create a `.env` file in the **project root** (same level as `package.json`):

```env
# ── Supabase ──────────────────────────────────────────────
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key-here

# ── App Config (optional) ─────────────────────────────────
VITE_APP_NAME=Roadmap.ai
VITE_APP_URL=https://yourdomain.com
```

> [!CAUTION]
> **Never commit `.env` to Git.** Verify `.gitignore` contains `.env` before your first push.
> API keys exposed in public repos are scraped and abused within minutes.

Check `.gitignore` includes:

```
.env
.env.local
.env.*.local
```

---

## 4. Supabase Auth Setup

`@supabase/supabase-js` is already installed in this project.

### 4.1 — Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Choose a region close to your users (e.g., `ap-south-1` for India)
3. Copy your **Project URL** and **anon public key** from:
   `Project Settings → API → Project URL / Project API Keys`

### 4.2 — Enable Auth Providers

In Supabase dashboard → **Authentication → Providers**:

- ✅ **Email** — enable "Email/Password" sign-in
- ✅ **Google** *(optional)* — register OAuth app in Google Cloud Console

### 4.3 — Supabase Client (`src/lib/supabase.js`)

```js
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

### 4.4 — Sign In / Sign Up

```js
// Sign Up
const { data, error } = await supabase.auth.signUp({ email, password })

// Sign In
const { data, error } = await supabase.auth.signInWithPassword({ email, password })

// Sign Out
await supabase.auth.signOut()

// Get current session
const { data: { session } } = await supabase.auth.getSession()
```

### 4.5 — Row-Level Security (Multi-Tenant)

If running as a SaaS with multiple businesses, enable RLS in Supabase:

```sql
-- Example: users can only see their own roadmaps
ALTER TABLE roadmaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own roadmaps"
  ON roadmaps FOR ALL
  USING (auth.uid() = user_id);
```

---

## 5. Production Build

```bash
npm run build
```

Output goes to `/dist` — a fully static folder (HTML + JS + CSS). Build stats:

| Asset | Approx Size |
|-------|------------|
| `index.js` (gzip) | ~571 KB |
| `index.css` (gzip) | ~42 KB |
| Build time | ~600ms |

> [!TIP]
> Run `npm run preview` after building to test the production bundle locally at `http://localhost:4173` before deploying.

---

## 6. Deploy to Vercel *(Recommended)*

Vercel is the fastest way to get a live URL — zero server management, free SSL, global CDN, auto-deploys on every `git push`.

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "feat: initial Roadmap.ai production build"

# Create a private repo at github.com/new, then:
git remote add origin https://github.com/YOUR_USERNAME/roadmap-ai.git
git branch -M main
git push -u origin main
```

### Step 2 — Import to Vercel

1. Go to [vercel.com](https://vercel.com) → sign up / log in with GitHub
2. Click **"Add New Project"**
3. Select your `roadmap-ai` repository
4. Vercel auto-detects **Vite** — no configuration needed
5. Click **Deploy** → live in ~60 seconds ✅

### Step 3 — Add Environment Variables in Vercel

`Project → Settings → Environment Variables` → add:

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://your-project.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `your-anon-key` |

After adding vars → **Redeploy** (Deployments tab → ⋯ → Redeploy).

### Step 4 — Automatic Deploys

Every `git push` to `main` → Vercel auto-deploys. Pull requests get preview URLs automatically.

---

## 7. Deploy to VPS / Self-Host

Use this if you want full control or need to save costs at scale (DigitalOcean, Hostinger, Contabo, etc.).

### Option A — Static with `serve` (Simplest)

```bash
# On the server (Ubuntu/Debian)
npm install -g serve
npm run build
serve -s dist -l 3000
```

App runs on port `3000`. Point Nginx to it:

### Option B — Nginx Reverse Proxy

Install Nginx and create a config:

```nginx
# /etc/nginx/sites-available/roadmap-ai
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    root /var/www/roadmap-ai/dist;
    index index.html;

    # Handle React Router (SPA fallback)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|svg|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/javascript;
}
```

Enable and restart:

```bash
sudo ln -s /etc/nginx/sites-available/roadmap-ai /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step — Free SSL with Certbot

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
# Auto-renews every 90 days
```

### Deployment Script (CI/CD on VPS)

```bash
#!/bin/bash
# deploy.sh — run on server after pulling new code
set -e
echo "⏳ Pulling latest code..."
git pull origin main
echo "📦 Installing dependencies..."
npm ci
echo "🏗️ Building..."
npm run build
echo "✅ Deploy complete!"
```

---

## 8. Custom Domain

### On Vercel

1. `Project → Settings → Domains`
2. Add your domain (e.g., `roadmap-ai.io`)
3. Copy the DNS records Vercel provides
4. Go to your domain registrar (Namecheap / GoDaddy / Cloudflare)
5. Add the DNS records → SSL is automatic within 60 seconds

**Recommended registrars:**
- [Namecheap](https://namecheap.com) — `.io` ~$35/yr, `.app` ~$14/yr
- [Cloudflare Registrar](https://cloudflare.com/registrar) — at-cost pricing, free DNS management

---

## 9. Pre-Launch Checklist

### Security
- [ ] `.env` is in `.gitignore` and never committed
- [ ] Supabase RLS policies enabled on all tables
- [ ] Demo bypass credentials (`demo@roadmap.ai`) removed or feature-flagged
- [ ] Environment variables set in Vercel/VPS (not hardcoded)

### Auth & Functionality
- [ ] Real Supabase auth integrated (not mock login)
- [ ] Sign up → email confirmation → sign in flow tested
- [ ] Sign out clears session correctly
- [ ] Protected routes redirect unauthenticated users

### Build & Performance
- [ ] `npm run build` completes without errors or warnings
- [ ] `npm run preview` tested locally
- [ ] No console errors in production build
- [ ] Page load < 3 seconds on slow 3G (test in Chrome DevTools)

### SEO & Meta
- [ ] `<title>` and `<meta name="description">` set in `index.html`
- [ ] Favicon uploaded (`public/favicon.ico`)
- [ ] Open Graph tags added for social sharing

### Monitoring
- [ ] Error tracking set up → [Sentry.io](https://sentry.io) (free tier: 5,000 errors/mo)
- [ ] Analytics set up → [Plausible](https://plausible.io) or [PostHog](https://posthog.com)

### Domain & SSL
- [ ] Custom domain connected (not `.vercel.app`)
- [ ] SSL certificate active (HTTPS enforced)
- [ ] `www` redirect configured

---

## 10. Tech Stack Reference

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend Framework | React | 19.x |
| Build Tool | Vite | 8.x |
| Styling | TailwindCSS | 4.x |
| Animations | Framer Motion | 12.x |
| Routing | React Router DOM | 7.x |
| Auth & DB | Supabase | 2.x |
| Drag & Drop | dnd-kit | 6.x |
| Icons | Lucide React | 1.x |
| 3D / Canvas | Three.js | 0.184.x |
| Hosting | Vercel | — |

---

## Estimated Costs at Launch

| Service | Free Tier | Paid |
|---------|-----------|------|
| Vercel | Free (hobby) | $20/mo (Pro, custom domains) |
| Supabase | Free (500MB DB, 50k users) | $25/mo (Pro) |
| Domain | — | ~$10–$35/yr |
| Sentry | Free (5k errors/mo) | $26/mo (Team) |
| **Total** | **$0** to start | **~$45–$80/mo** at scale |

---

*Generated for Roadmap.ai · Vite + React + Supabase · May 2026*
