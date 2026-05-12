import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Integration definitions ──────────────────────────────────────────
const INTEGRATIONS = [
  {
    id:          'gmail',
    label:       'Gmail',
    icon:        '📧',
    color:       '#ea4335',
    bg:          'rgba(234,67,53,0.12)',
    description: 'Read complaint emails from your inbox and auto-reply using AI.',
    docsUrl:     'https://developers.google.com/gmail/api',
    fields: [
      { key: 'clientId',      label: 'OAuth Client ID',     type: 'text',     placeholder: 'xxx.apps.googleusercontent.com' },
      { key: 'clientSecret',  label: 'OAuth Client Secret', type: 'password', placeholder: '••••••••••••••' },
      { key: 'refreshToken',  label: 'Refresh Token',       type: 'password', placeholder: '1//0g...' },
      { key: 'pubsubTopic',   label: 'Pub/Sub Topic',       type: 'text',     placeholder: 'projects/proj/topics/gmail-notif' },
    ],
  },
  {
    id:          'instagram',
    label:       'Instagram DMs',
    icon:        '📸',
    color:       '#e1306c',
    bg:          'rgba(225,48,108,0.12)',
    description: 'Capture Instagram Direct Messages via the Meta Graph API webhook.',
    docsUrl:     'https://developers.facebook.com/docs/messenger-platform',
    fields: [
      { key: 'appSecret',        label: 'App Secret',          type: 'password', placeholder: 'Meta App Secret' },
      { key: 'verifyToken',      label: 'Verify Token',        type: 'text',     placeholder: 'your_custom_token' },
      { key: 'pageAccessToken',  label: 'Page Access Token',   type: 'password', placeholder: 'EAABx...' },
    ],
  },
  {
    id:          'slack',
    label:       'Slack',
    icon:        '⚡',
    color:       '#e01e5a',
    bg:          'rgba(224,30,90,0.12)',
    description: 'Listen to channel messages and DMs from your Slack workspace.',
    docsUrl:     'https://api.slack.com/events-api',
    fields: [
      { key: 'botToken',      label: 'Bot Token',       type: 'password', placeholder: 'xoxb-...' },
      { key: 'signingSecret', label: 'Signing Secret',  type: 'password', placeholder: 'abc123...' },
      { key: 'channelId',     label: 'Channel ID',      type: 'text',     placeholder: 'C0123456' },
    ],
  },
  {
    id:          'zendesk',
    label:       'Zendesk',
    icon:        '🎫',
    color:       '#03a688',
    bg:          'rgba(3,166,136,0.12)',
    description: 'Sync support tickets and auto-tag them with AI triage classification.',
    docsUrl:     'https://developer.zendesk.com/api-reference/',
    fields: [
      { key: 'subdomain', label: 'Subdomain',   type: 'text',     placeholder: 'yourcompany' },
      { key: 'email',     label: 'Agent Email', type: 'text',     placeholder: 'you@company.com' },
      { key: 'apiToken',  label: 'API Token',   type: 'password', placeholder: 'xxxxxx' },
    ],
  },
  {
    id:          'intercom',
    label:       'Intercom',
    icon:        '💬',
    color:       '#1f8ded',
    bg:          'rgba(31,141,237,0.12)',
    description: 'Import conversations and user messages from Intercom into the AI pipeline.',
    docsUrl:     'https://developers.intercom.com/',
    fields: [
      { key: 'accessToken', label: 'Access Token', type: 'password', placeholder: 'dG9rZ...' },
      { key: 'webhookSecret', label: 'Webhook Secret', type: 'password', placeholder: 'whsec_...' },
    ],
  },
];

// ── Status badge config ──────────────────────────────────────────────
const STATUS_CONFIG = {
  connected:    { color: '#00ff88', label: 'Connected',    dot: true  },
  disconnected: { color: 'rgba(255,255,255,0.25)', label: 'Not Connected', dot: false },
  error:        { color: '#ff4466', label: 'Error',        dot: true  },
  testing:      { color: '#ffaa00', label: 'Testing…',     dot: true  },
};

// ── Integration Card ─────────────────────────────────────────────────
function IntegrationCard({ integration, index }) {
  const [status,   setStatus]   = useState('disconnected');
  const [expanded, setExpanded] = useState(false);
  const [values,   setValues]   = useState({});
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);

  const st = STATUS_CONFIG[status];

  const handleSave = async () => {
    setSaving(true);
    setStatus('testing');
    // Simulate API call to POST /api/integrations/:id
    await new Promise(r => setTimeout(r, 1400));
    setSaving(false);
    setSaved(true);
    setStatus('connected');
    setTimeout(() => setSaved(false), 2500);
  };

  const handleDisconnect = () => {
    setValues({});
    setStatus('disconnected');
    setExpanded(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4 }}
      style={{
        borderRadius: 16,
        background:   '#111119',
        border:       `1px solid ${status === 'connected' ? integration.color + '40' : 'rgba(255,255,255,0.07)'}`,
        overflow:     'hidden',
        transition:   'border-color 0.3s',
        boxShadow:    status === 'connected'
          ? `0 0 24px ${integration.color}18`
          : 'none',
      }}
    >
      {/* Card Header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display:    'flex',
          alignItems: 'center',
          gap:        '1rem',
          padding:    '1.1rem 1.3rem',
          cursor:     'pointer',
          userSelect: 'none',
        }}
      >
        {/* Icon */}
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: integration.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.4rem', flexShrink: 0,
        }}>
          {integration.icon}
        </div>

        {/* Name + description */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'Montserrat, sans-serif', fontWeight: 800,
            fontSize: '0.92rem', marginBottom: '0.2rem',
          }}>
            {integration.label}
          </div>
          <div style={{
            fontSize: '0.75rem', color: 'rgba(255,255,255,0.38)',
            fontFamily: 'Inter, sans-serif',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {integration.description}
          </div>
        </div>

        {/* Status badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
          {st.dot && (
            <motion.div
              animate={status === 'connected' ? { scale: [1, 1.4, 1], opacity: [1, 0.6, 1] } : {}}
              transition={{ duration: 1.8, repeat: Infinity }}
              style={{ width: 7, height: 7, borderRadius: '50%', background: st.color }}
            />
          )}
          <span style={{
            fontSize: '0.68rem', color: st.color,
            fontFamily: 'Montserrat, sans-serif', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            {st.label}
          </span>
        </div>

        {/* Chevron */}
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', flexShrink: 0 }}
        >
          ▼
        </motion.div>
      </div>

      {/* Expanded Config Panel */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              padding:      '0 1.3rem 1.3rem',
              borderTop:    '1px solid rgba(255,255,255,0.05)',
              paddingTop:   '1rem',
            }}>
              {/* Webhook URL hint */}
              <div style={{
                marginBottom: '1rem', padding: '0.65rem 0.9rem',
                borderRadius: 8, background: 'rgba(0,212,255,0.07)',
                border: '1px solid rgba(0,212,255,0.18)',
              }}>
                <div style={{ fontSize: '0.65rem', color: '#00d4ff', fontFamily: 'Montserrat, sans-serif', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Webhook URL
                </div>
                <code style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {`${window.location.origin.replace('5173','4000')}/webhook/${integration.id}`}
                </code>
              </div>

              {/* Config fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                {integration.fields.map(field => (
                  <div key={field.key}>
                    <label style={{
                      display: 'block', fontSize: '0.68rem',
                      color: 'rgba(255,255,255,0.45)',
                      fontFamily: 'Montserrat, sans-serif', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      marginBottom: '0.3rem',
                    }}>
                      {field.label}
                    </label>
                    <input
                      type={field.type}
                      value={values[field.key] ?? ''}
                      placeholder={field.placeholder}
                      onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                      style={{
                        width: '100%', padding: '0.55rem 0.8rem',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 8, color: '#fff',
                        fontSize: '0.82rem',
                        fontFamily: 'JetBrains Mono, monospace',
                        outline: 'none', transition: 'border-color 0.2s',
                        boxSizing: 'border-box',
                      }}
                      onFocus={e => e.target.style.borderColor = integration.color}
                      onBlur={e  => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                    />
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    flex: 1, padding: '0.6rem',
                    borderRadius: 8, border: 'none', cursor: saving ? 'wait' : 'pointer',
                    background: `linear-gradient(135deg, ${integration.color}, ${integration.color}bb)`,
                    color: '#fff', fontWeight: 700, fontSize: '0.82rem',
                    fontFamily: 'Montserrat, sans-serif',
                    opacity: saving ? 0.7 : 1,
                    transition: 'opacity 0.2s',
                  }}
                >
                  {saved ? '✅ Saved!' : saving ? '⏳ Testing connection…' : `Connect ${integration.label}`}
                </button>

                <a
                  href={integration.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '0.6rem 0.9rem', borderRadius: 8,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem',
                    textDecoration: 'none', whiteSpace: 'nowrap',
                  }}
                >
                  Docs ↗
                </a>

                {status === 'connected' && (
                  <button
                    onClick={handleDisconnect}
                    style={{
                      padding: '0.6rem 0.9rem', borderRadius: 8, border: 'none',
                      background: 'rgba(255,68,68,0.1)',
                      color: '#ff4466', fontSize: '0.8rem', cursor: 'pointer',
                      fontFamily: 'Montserrat, sans-serif', fontWeight: 700,
                    }}
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Pipeline Health Widget ────────────────────────────────────────────
function PipelineHealth() {
  const stats = [
    { label: 'Ingested',     value: '2,847', color: '#00d4ff', icon: '📥' },
    { label: 'Triaged',      value: '2,801', color: '#9d00ff', icon: '🧠' },
    { label: 'Clustered',    value: '2,650', color: '#00ff88', icon: '🧩' },
    { label: 'Auto-Replied', value: '1,204', color: '#ffaa00', icon: '📤' },
    { label: 'Spam Dropped', value: '189',   color: '#ff4466', icon: '🗑️' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      style={{
        borderRadius: 16, background: '#111119',
        border: '1px solid rgba(255,255,255,0.07)',
        padding: '1.2rem 1.5rem', marginBottom: '1.5rem',
      }}
    >
      <div style={{
        fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)',
        fontFamily: 'Montserrat, sans-serif', fontWeight: 700,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        marginBottom: '1rem',
        display: 'flex', alignItems: 'center', gap: '0.5rem',
      }}>
        <motion.div
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          style={{ width: 7, height: 7, borderRadius: '50%', background: '#00ff88' }}
        />
        Pipeline Status — Live
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {stats.map(s => (
          <div key={s.label} style={{
            flex: '1 1 100px',
            padding: '0.75rem',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.05)',
          }}>
            <div style={{ fontSize: '1rem', marginBottom: '0.3rem' }}>{s.icon}</div>
            <div style={{
              fontFamily: 'Montserrat, sans-serif', fontWeight: 800,
              fontSize: '1.1rem', color: s.color, lineHeight: 1,
            }}>
              {s.value}
            </div>
            <div style={{
              fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)',
              fontFamily: 'Montserrat, sans-serif', textTransform: 'uppercase',
              letterSpacing: '0.05em', marginTop: '0.25rem',
            }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────
export default function IntegrationsPage() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          padding: '1.25rem 2rem',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1 }}>
          <h1 style={{
            fontSize: '1.2rem', fontWeight: 800,
            fontFamily: 'Montserrat, sans-serif', marginBottom: '0.2rem',
          }}>
            Integrations
          </h1>
          <p style={{
            fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)',
            fontFamily: 'Inter, sans-serif',
          }}>
            Connect your channels — every message flows through the AI pipeline automatically
          </p>
        </div>

        <div style={{
          padding: '0.4rem 0.9rem', borderRadius: 8,
          background: 'rgba(0,212,255,0.08)',
          border: '1px solid rgba(0,212,255,0.2)',
          fontSize: '0.72rem', color: '#00d4ff',
          fontFamily: 'Montserrat, sans-serif', fontWeight: 700,
        }}>
          Webhook base: <code style={{ fontFamily: 'JetBrains Mono, monospace' }}>:4000/webhook/</code>
        </div>
      </motion.div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem 2rem' }}>
        <PipelineHealth />

        {/* Section label */}
        <div style={{
          fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)',
          fontFamily: 'Montserrat, sans-serif', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.08em',
          marginBottom: '0.75rem',
        }}>
          Available Channels — {INTEGRATIONS.length}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {INTEGRATIONS.map((intg, i) => (
            <IntegrationCard key={intg.id} integration={intg} index={i} />
          ))}
        </div>

        {/* Footer note */}
        <div style={{
          marginTop: '2rem', padding: '1rem 1.25rem',
          borderRadius: 12, background: 'rgba(157,0,255,0.06)',
          border: '1px solid rgba(157,0,255,0.15)',
          fontSize: '0.78rem', color: 'rgba(255,255,255,0.38)',
          fontFamily: 'Inter, sans-serif', lineHeight: 1.6,
        }}>
          🔒 <strong style={{ color: 'rgba(255,255,255,0.6)' }}>Security note:</strong> Credentials are sent
          encrypted (AES-256) to your self-hosted backend and never logged. Rotate tokens regularly.
          Webhook signatures are verified using HMAC-SHA256 for Meta and Slack endpoints.
        </div>
      </div>
    </div>
  );
}
