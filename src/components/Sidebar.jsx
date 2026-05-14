// src/components/Sidebar.jsx
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { 
  Inbox, BarChart3, Map, Layout, LineChart, 
  Settings, LogOut, ChevronRight
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard',    icon: <Inbox size={18} />,     label: 'Feedback Inbox' },
  { id: 'insights',     icon: <LineChart size={18} />, label: 'AI Insights' },
  { id: 'spec',         icon: <Layout size={18} />,    label: 'Spec Builder'   },
  { id: 'roadmap',      icon: <Map size={18} />,       label: 'Smart Roadmap'  },
  { id: 'integrations', icon: <Settings size={18} />,  label: 'Integrations' },
];

export default function Sidebar() {
  const { view, setView, user, logout, stats } = useApp();

  const userName  = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'User';
  const initials  = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      style={{ width: 260, minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0a0a0c', borderRight: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, padding: '1.5rem' }}
    >
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2.5rem', padding: '0 0.5rem' }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #00d4ff, #9d00ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(0,212,255,0.3)' }}>
          <Zap size={20} color="#000" strokeWidth={3} />
        </div>
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: 900, fontFamily: 'Montserrat', letterSpacing: '-0.02em', background: 'linear-gradient(to right, #fff, rgba(255,255,255,0.6))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Roadmap.ai</div>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#00d4ff', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: -2 }}>Market Killer v2</div>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.8rem 1rem', borderRadius: 12,
              background: view === item.id ? 'rgba(0,212,255,0.08)' : 'transparent',
              border: '1px solid',
              borderColor: view === item.id ? 'rgba(0,212,255,0.15)' : 'transparent',
              color: view === item.id ? '#00d4ff' : 'rgba(255,255,255,0.4)',
              cursor: 'pointer', transition: 'all 0.2s', position: 'relative'
            }}
          >
            {item.icon}
            <span style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'Montserrat', flex: 1, textAlign: 'left' }}>{item.label}</span>
            
            {item.id === 'dashboard' && stats?.bugs > 0 && (
              <span style={{ background: '#ff4466', color: '#fff', fontSize: '0.6rem', padding: '0.1rem 0.4rem', borderRadius: 6, fontWeight: 800 }}>{stats.bugs}</span>
            )}
            
            {view === item.id && (
              <motion.div layoutId="active" style={{ position: 'absolute', left: 0, width: 3, height: 20, background: '#00d4ff', borderRadius: '0 4px 4px 0', boxShadow: '0 0 10px #00d4ff' }} />
            )}
          </button>
        ))}
      </div>

      {/* User Info */}
      <div style={{ marginTop: 'auto', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', marginBottom: '1rem' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #00d4ff, #9d00ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, color: '#000' }}>
            {initials}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userName}</div>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>{user?.email}</div>
          </div>
        </div>
        <button onClick={logout} className="btn-ghost" style={{ width: '100%', justifyContent: 'center', gap: '0.5rem' }}>
          <LogOut size={14} /> Sign Out
        </button>
      </div>

      {/* Dremora Watermark */}
      <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.3, justifyContent: 'center' }}>
        <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.05em' }}>POWERED BY</span>
        <img src="/dremora-icon.png" alt="Dremora" style={{ width: 16, height: 16 }} />
      </div>
    </motion.div>
  );
}
