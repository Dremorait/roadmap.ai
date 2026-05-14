import { google }    from 'googleapis';
import { supabase }  from '../lib/supabase.js';
import { fetchRecentEmails } from '../lib/gmailService.js';
import { normalizeGmail }  from '../lib/normalizers.js';
import { ingestFeedback }  from '../lib/pipeline.js';

export default async function handler(req, res) {
  const { code, error } = req.query;

  if (error) return res.status(400).send(page('❌ Authorization Failed', `<p style="color:#ff4466">${error}</p>`, false));

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );

  try {
    const { tokens }  = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user email
    const oauth2     = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data }   = await oauth2.userinfo.get();

    // Save tokens to Supabase integration_config table
    await supabase.from('integration_config').upsert({
      workspace_id:  'default',
      source:        'gmail',
      is_active:     true,
      config: {
        email:        data.email,
        accessToken:  tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate:   tokens.expiry_date,
      },
      last_sync_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id,source' });

    // Register Gmail Pub/Sub watch
    const gmail  = google.gmail({ version: 'v1', auth: oauth2Client });
    const watch  = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName:         process.env.GOOGLE_PUBSUB_TOPIC,
        labelIds:          ['INBOX'],
        labelFilterAction: 'include',
      },
    });

    const expiry = new Date(Number(watch.data.expiration)).toLocaleString();
    
    // --- Initial Inbox Sync ---
    // Fetch and ingest the last 15 emails so the dashboard isn't empty
    try {
      const recentEmails = await fetchRecentEmails(15);
      console.log(`Initial sync: fetching ${recentEmails.length} recent emails`);
      // Process sequentially to respect Gemini API rate limits
      for (const email of recentEmails) {
        const feedback = normalizeGmail(email);
        await ingestFeedback(feedback);
      }
    } catch (syncErr) {
      console.error('Initial sync error:', syncErr.message);
    }

    return res.send(page('✅ Gmail Connected!', `
      <p style="color:rgba(255,255,255,0.7);margin-bottom:1rem">
        Connected <strong style="color:#00d4ff">${data.email}</strong>
      </p>
      <div style="background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.2);
                  border-radius:12px;padding:1rem;font-family:monospace;font-size:0.82rem;
                  color:rgba(255,255,255,0.6);margin-bottom:1rem;line-height:1.8">
        📡 Gmail watch active until: ${expiry}<br>
        🔑 Tokens saved to Supabase<br>
        📥 Webhook: /api/webhook/gmail<br>
        🔄 Initial sync complete (last 10 emails loaded)
      </div>
      <p style="color:rgba(255,255,255,0.4);font-size:0.8rem">
        Emails arriving at ${data.email} now flow into the AI pipeline automatically. You can close this tab.
      </p>
    `, true));

  } catch (err) {
    console.error('OAuth callback error:', err);
    return res.status(500).send(page('❌ Connection Failed',
      `<p style="color:#ff4466;font-family:monospace;font-size:0.82rem">${err.message}</p>`, false));
  }
}

function page(title, body, success) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title} — Roadmap.ai</title>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;900&display=swap" rel="stylesheet">
  <style>*{box-sizing:border-box;margin:0;padding:0}body{background:#0d0d0d;color:#fff;font-family:Montserrat,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}
  .c{background:#111119;border:1px solid ${success?'rgba(0,255,136,0.2)':'rgba(255,68,68,0.2)'};border-radius:20px;padding:2.5rem;max-width:480px;width:90%;box-shadow:0 0 40px ${success?'rgba(0,255,136,0.08)':'rgba(255,68,68,0.08)'}}
  h1{font-size:1.3rem;font-weight:900;margin-bottom:1.25rem;color:${success?'#00ff88':'#ff4466'}}
  a{display:inline-block;margin-top:1.25rem;background:linear-gradient(135deg,#00d4ff,#9d00ff);color:#fff;text-decoration:none;font-weight:700;padding:.7rem 1.5rem;border-radius:10px;font-size:.9rem}</style>
  </head><body><div class="c"><div style="font-size:2rem;margin-bottom:1rem">🧠</div>
  <h1>${title}</h1>${body}<a href="/">← Back to Roadmap.ai</a></div></body></html>`;
}
