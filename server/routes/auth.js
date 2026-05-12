// server/routes/auth.js
// Self-serve OAuth flow — visit /auth/google in browser to connect Gmail
import express        from 'express';
import { google }     from 'googleapis';
import { query }      from '../db.js';
import 'dotenv/config';

const router = express.Router();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_OAUTH_CLIENT_ID,
  process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  process.env.GOOGLE_OAUTH_REDIRECT_URI  // e.g. https://your-backend.onrender.com/auth/google/callback
);

const SCOPES = [
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

// ── Step 1: Redirect user to Google consent screen ──────────────────
router.get('/google', (_req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type:  'offline',
    scope:        SCOPES,
    prompt:       'consent',   // forces refresh token to be returned every time
  });
  res.redirect(url);
});

// ── Step 2: Google redirects here with ?code=… ──────────────────────
router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.send(htmlPage('❌ Authorization Failed', `<p style="color:#ff4466">${error}</p>`, false));
  }

  try {
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user's email for display
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    // Save tokens to DB for persistence across server restarts
    await query(`
      INSERT INTO integration_config (workspace_id, source, is_active, config, last_sync_at)
      VALUES ($1, 'gmail', true, $2::jsonb, NOW())
      ON CONFLICT (workspace_id, source)
      DO UPDATE SET
        config       = $2::jsonb,
        is_active    = true,
        last_sync_at = NOW()
    `, [
      process.env.DEFAULT_WORKSPACE_ID ?? 'default',
      JSON.stringify({
        email:         profile.email,
        accessToken:   tokens.access_token,
        refreshToken:  tokens.refresh_token,
        expiryDate:    tokens.expiry_date,
      }),
    ]);

    // Set tokens on global oauth client for immediate use
    process.env.GOOGLE_REFRESH_TOKEN = tokens.refresh_token;

    // Register Gmail watch immediately
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const watch = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName:         process.env.GOOGLE_PUBSUB_TOPIC,
        labelIds:          ['INBOX'],
        labelFilterAction: 'include',
      },
    });

    const expiry = new Date(Number(watch.data.expiration)).toLocaleString();

    res.send(htmlPage(
      '✅ Gmail Connected!',
      `
        <p style="color:rgba(255,255,255,0.7);margin-bottom:1rem">
          Successfully connected <strong style="color:#00d4ff">${profile.email}</strong>
        </p>
        <div style="background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.2);
                    border-radius:12px;padding:1rem;font-size:0.85rem;color:rgba(255,255,255,0.6);
                    font-family:monospace;margin-bottom:1rem">
          📡 Gmail watch active until: ${expiry}<br>
          🔑 Refresh token saved to database<br>
          📥 Webhook endpoint: ${process.env.GOOGLE_PUBSUB_TOPIC ?? 'Not configured'}
        </div>
        <p style="color:rgba(255,255,255,0.4);font-size:0.8rem">
          You can close this tab. Emails to ${profile.email} will now flow into the AI pipeline automatically.
        </p>
      `,
      true
    ));

  } catch (err) {
    console.error('OAuth callback error:', err.message);
    res.send(htmlPage(
      '❌ Connection Failed',
      `<p style="color:#ff4466;font-family:monospace;font-size:0.85rem">${err.message}</p>
       <p style="color:rgba(255,255,255,0.4);margin-top:1rem">
         Check that your GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and
         GOOGLE_OAUTH_REDIRECT_URI environment variables are set correctly on Render.
       </p>`,
      false
    ));
  }
});

// ── Status check ─────────────────────────────────────────────────────
router.get('/google/status', async (_req, res) => {
  try {
    const { rows } = await query(`
      SELECT config, last_sync_at
      FROM integration_config
      WHERE source = 'gmail' AND workspace_id = $1
    `, [process.env.DEFAULT_WORKSPACE_ID ?? 'default']);

    if (!rows.length) return res.json({ connected: false });

    const cfg = rows[0].config;
    res.json({
      connected:   true,
      email:       cfg.email,
      lastSync:    rows[0].last_sync_at,
      hasRefreshToken: !!cfg.refreshToken,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Branded HTML page helper ─────────────────────────────────────────
function htmlPage(title, body, success) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title} — Roadmap.ai</title>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0d0d0d;
      color: #fff;
      font-family: 'Montserrat', sans-serif;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: #111119;
      border: 1px solid ${success ? 'rgba(0,255,136,0.2)' : 'rgba(255,68,68,0.2)'};
      border-radius: 20px;
      padding: 2.5rem;
      max-width: 480px;
      width: 90%;
      box-shadow: 0 0 40px ${success ? 'rgba(0,255,136,0.08)' : 'rgba(255,68,68,0.08)'};
    }
    .logo { font-size: 2rem; margin-bottom: 1rem; }
    h1 { font-size: 1.3rem; font-weight: 900; margin-bottom: 1.25rem;
         color: ${success ? '#00ff88' : '#ff4466'}; }
    a.btn {
      display: inline-block; margin-top: 1.25rem;
      background: linear-gradient(135deg, #00d4ff, #9d00ff);
      color: #fff; text-decoration: none; font-weight: 700;
      padding: 0.7rem 1.5rem; border-radius: 10px; font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🧠</div>
    <h1>${title}</h1>
    ${body}
    <a class="btn" href="/">← Back to Roadmap.ai</a>
  </div>
</body>
</html>`;
}

export default router;
