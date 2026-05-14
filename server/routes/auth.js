// server/routes/auth.js
// ── Fixes applied ────────────────────────────────────────────────────────────
//  Bug 2: After OAuth, immediately backfill the inbox (up to 50 recent emails)
//          so the dashboard is never empty on first connect.
//  Bug 4: The historyId returned by gmail.users.watch() is now saved into
//          integration_config so the webhook handler has a valid cursor.
// ─────────────────────────────────────────────────────────────────────────────
import express                          from 'express';
import { google }                       from 'googleapis';
import { query }                        from '../db.js';
import { fetchInboxHistory,
         registerGmailWatch,
         parseGmailMessage }            from '../gmailService.js';
import { ingestionQueue }               from '../webhookListener.js';
import { normalizeGmail }               from '../normalizers.js';
import 'dotenv/config';

const router = express.Router();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_OAUTH_CLIENT_ID,
  process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  process.env.GOOGLE_OAUTH_REDIRECT_URI,
);

const SCOPES = [
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

// ── Step 1: Redirect to Google consent screen ────────────────────────────────
router.get('/google', (_req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope:       SCOPES,
    prompt:      'consent',   // always forces refresh_token to be issued
  });
  res.redirect(url);
});

// ── Step 2: Handle OAuth callback ────────────────────────────────────────────
router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.send(htmlPage('❌ Authorization Failed',
      `<p style="color:#ff4466">${error}</p>`, false));
  }

  try {
    // Exchange auth code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Validate we received a refresh token
    if (!tokens.refresh_token) {
      throw new Error(
        'No refresh_token returned by Google. ' +
        'Revoke app access at myaccount.google.com/permissions and try again.'
      );
    }

    // Get connected user's email
    const oauth2              = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile }   = await oauth2.userinfo.get();
    const workspaceId         = process.env.DEFAULT_WORKSPACE_ID ?? 'default';

    // ── Register Gmail watch → get back the initial historyId ──────────────
    // Bug 4 fix: save the historyId so the webhook handler has a valid cursor
    const watchData       = await registerGmailWatch(tokens, workspaceId);
    const lastHistoryId   = watchData.historyId;
    const watchExpiry     = watchData.expiration;

    // ── Persist tokens + historyId to DB ───────────────────────────────────
    await query(`
      INSERT INTO integration_config (workspace_id, source, is_active, config, last_sync_at)
      VALUES ($1, 'gmail', true, $2::jsonb, NOW())
      ON CONFLICT (workspace_id, source)
      DO UPDATE SET
        config       = $2::jsonb,
        is_active    = true,
        last_sync_at = NOW()
    `, [
      workspaceId,
      JSON.stringify({
        email:          profile.email,
        access_token:   tokens.access_token,
        refresh_token:  tokens.refresh_token,
        expiry_date:    tokens.expiry_date,
        last_history_id: lastHistoryId,   // Bug 4 fix
        watch_expiry:    watchExpiry,
      }),
    ]);

    // ── Bug 2 fix: Initial inbox backfill ──────────────────────────────────
    // Run in background so OAuth callback page responds immediately
    setImmediate(async () => {
      try {
        console.log(`🔄 Starting inbox backfill for ${profile.email}...`);
        const emails = await fetchInboxHistory(tokens, workspaceId, 50);

        let queued = 0;
        for (const email of emails) {
          const feedback = normalizeGmail(email);
          await ingestionQueue.add('ingest', feedback, {
            attempts:         3,
            backoff:          { type: 'exponential', delay: 2000 },
            removeOnComplete: 500,
            removeOnFail:     100,
          });
          queued++;
        }

        console.log(`✅ Inbox backfill complete: ${queued} emails queued for AI processing`);

        // Update last_sync_at after backfill
        await query(`
          UPDATE integration_config
          SET last_sync_at = NOW()
          WHERE source = 'gmail' AND workspace_id = $1
        `, [workspaceId]);
      } catch (backfillErr) {
        console.error('❌ Inbox backfill error:', backfillErr.message);
      }
    });

    // Respond to user immediately
    const expiry = new Date(Number(watchExpiry)).toLocaleString();
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
          📥 Backfilling last 50 inbox emails in background…<br>
          📌 Webhook endpoint: ${process.env.GOOGLE_PUBSUB_TOPIC ?? 'Not configured'}
        </div>
        <p style="color:rgba(255,255,255,0.4);font-size:0.8rem">
          You can close this tab. Emails will now flow into the AI pipeline automatically.
          Check the dashboard in ~30 seconds to see your backfilled emails.
        </p>
      `,
      true
    ));

  } catch (err) {
    console.error('❌ OAuth callback error:', err.message);
    res.send(htmlPage(
      '❌ Connection Failed',
      `<p style="color:#ff4466;font-family:monospace;font-size:0.85rem">${err.message}</p>
       <p style="color:rgba(255,255,255,0.4);margin-top:1rem">
         Check your GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and
         GOOGLE_OAUTH_REDIRECT_URI environment variables.
       </p>`,
      false
    ));
  }
});

// ── Status check ─────────────────────────────────────────────────────────────
router.get('/google/status', async (_req, res) => {
  try {
    const { rows } = await query(`
      SELECT config, last_sync_at
      FROM integration_config
      WHERE source = 'gmail' AND workspace_id = $1
    `, [process.env.DEFAULT_WORKSPACE_ID ?? 'default']);

    if (!rows.length) return res.json({ connected: false });

    const cfg = rows[0].config;
    const watchExpiry = cfg.watch_expiry ? new Date(Number(cfg.watch_expiry)) : null;

    res.json({
      connected:       true,
      email:           cfg.email,
      lastSync:        rows[0].last_sync_at,
      hasRefreshToken: !!cfg.refresh_token,
      watchExpiry:     watchExpiry?.toISOString() ?? null,
      watchActive:     watchExpiry ? watchExpiry > new Date() : false,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Disconnect Gmail ──────────────────────────────────────────────────────────
router.delete('/google', async (_req, res) => {
  try {
    await query(`
      UPDATE integration_config
      SET is_active = false, last_sync_at = NOW()
      WHERE source = 'gmail' AND workspace_id = $1
    `, [process.env.DEFAULT_WORKSPACE_ID ?? 'default']);

    res.json({ disconnected: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Branded HTML helper ───────────────────────────────────────────────────────
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
      background: #0d0d0d; color: #fff;
      font-family: 'Montserrat', sans-serif;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: #111119;
      border: 1px solid ${success ? 'rgba(0,255,136,0.2)' : 'rgba(255,68,68,0.2)'};
      border-radius: 20px; padding: 2.5rem; max-width: 480px; width: 90%;
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
    <a class="btn" href="${process.env.FRONTEND_URL ?? '/'}">← Back to Roadmap.ai</a>
  </div>
  <script>
    // Auto-close tab on success and notify opener window
    ${success ? `
    if (window.opener) {
      window.opener.postMessage({ type: 'GMAIL_CONNECTED' }, '*');
      setTimeout(() => window.close(), 2000);
    }
    ` : ''}
  </script>
</body>
</html>`;
}

export default router;
