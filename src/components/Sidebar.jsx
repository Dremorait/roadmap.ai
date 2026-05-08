import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';

const NAV_ITEMS = [
  { id: 'dashboard', icon: '📡', label: 'Feedback Inbox' },
  { id: 'spec', icon: '📋', label: 'Spec Builder' },
  { id: 'roadmap', icon: '🗺️', label: 'Smart Roadmap' },
];

export default function Sidebar() {
  const { view, setView, user, logout } = useApp();

  return (
    <motion.div
      initial={{ x: -60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16,1,0.3,1] }}
      className="sidebar"
      style={{ width: 220, minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '1.5rem 0.75rem', flexShrink: 0 }}
    >
      {/* Logo */}
      <div style={{ padding: '0.5rem 0.75rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,rgba(0,212,255,0.2),rgba(157,0,255,0.2))', border: '1px solid rgba(0,212,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>🧠</div>
          <div>
            <div className="gradient-text-electric" style={{ fontSize: '0.95rem', fontWeight: 900, fontFamily: 'Montserrat, sans-serif' }}>Roadmap.ai</div>
            <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'Montserrat, sans-serif', letterSpacing: '0.06em', textTransform: 'uppercase' }}>PM Intelligence</div>
          </div>
        </div>
      </div>

      <div className="accent-line" style={{ marginBottom: '1.25rem', marginLeft: '0.75rem', marginRight: '0.75rem' }} />

      {/* Nav */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            id={`nav-${item.id}`}
            onClick={() => setView(item.id)}
            className={`nav-item ${view === item.id ? 'active' : ''}`}
            style={{ background: 'none', border: '1px solid transparent' }}
          >
            <span style={{ fontSize: '1rem' }}>{item.icon}</span>
            <span>{item.label}</span>
            {view === item.id && (
              <motion.div
                layoutId="nav-indicator"
                style={{ marginLeft: 'auto', width: 4, height: 4, borderRadius: '50%', background: '#00d4ff', boxShadow: '0 0 8px rgba(0,212,255,0.8)' }}
              />
            )}
          </button>
        ))}
      </nav>

      {/* User */}
      <div className="accent-line" style={{ margin: '1rem 0.75rem' }} />
      <div style={{ padding: '0 0.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.65rem 0.75rem', borderRadius: 10, background: 'rgba(255,255,255,0.03)', marginBottom: '0.5rem' }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#00d4ff,#9d00ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#0a0a0a', fontFamily: 'Montserrat, sans-serif', flexShrink: 0 }}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)', fontFamily: 'Montserrat, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter, sans-serif' }}>{user?.role}</div>
          </div>
        </div>
        <button id="logout-btn" onClick={logout} className="btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: '0.75rem' }}>
          Sign Out
        </button>
      </div>

      {/* Dremora Watermark */}
      <div className="accent-line" style={{ margin: '1rem 0.75rem 0.85rem' }} />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        style={{ padding: '0 0.75rem', paddingBottom: '0.25rem' }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.55rem',
          padding: '0.55rem 0.75rem',
          borderRadius: 10,
          background: 'rgba(157,0,255,0.04)',
          border: '1px solid rgba(157,0,255,0.1)',
          transition: 'all 0.25s ease',
          cursor: 'default',
        }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(157,0,255,0.08)';
            e.currentTarget.style.borderColor = 'rgba(157,0,255,0.25)';
            e.currentTarget.style.boxShadow = '0 0 16px rgba(157,0,255,0.12)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(157,0,255,0.04)';
            e.currentTarget.style.borderColor = 'rgba(157,0,255,0.1)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {/* Dremora logo image */}
          <img
            src="/dremora-icon.png"
            alt="Dremora"
            style={{
              width: 28,
              height: 28,
              objectFit: 'contain',
              flexShrink: 0,
              filter: 'brightness(1.1) drop-shadow(0 0 4px rgba(157,0,255,0.5))',
            }}
          />
          <div>
            <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.28)', fontFamily: 'Montserrat, sans-serif', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1.2 }}>Crafted by</div>
            <div style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              fontFamily: 'Montserrat, sans-serif',
              letterSpacing: '0.04em',
              background: 'linear-gradient(135deg, #c44dff, #00d4ff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              lineHeight: 1.2,
            }}>Dremora</div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
