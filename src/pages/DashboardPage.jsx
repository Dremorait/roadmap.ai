import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';

const SOURCE_CONFIG = {
  slack: { color: '#e01e5a', bg: 'rgba(224,30,90,0.12)', icon: '⚡', label: 'Slack' },
  intercom: { color: '#1f8ded', bg: 'rgba(31,141,237,0.12)', icon: '💬', label: 'Intercom' },
  zendesk: { color: '#03363d', bg: 'rgba(3,150,140,0.15)', icon: '🎫', label: 'Zendesk' },
  gmail: { color: '#ea4335', bg: 'rgba(234,67,53,0.15)', icon: '📧', label: 'Gmail' },
};

function SentimentBar({ score }) {
  const color = score < 0.35 ? '#ff4466' : score < 0.6 ? '#ffaa00' : '#00ff88';
  const label = score < 0.35 ? 'Negative' : score < 0.6 ? 'Neutral' : 'Positive';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div className="progress-bar" style={{ flex: 1, height: 4 }}>
        <motion.div
          className="progress-fill"
          style={{ background: color, width: 0 }}
          animate={{ width: `${score * 100}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
        />
      </div>
      <span style={{ fontSize: '0.65rem', color, fontFamily: 'Montserrat, sans-serif', fontWeight: 700, minWidth: 50 }}>{label}</span>
    </div>
  );
}

function FeedbackCard({ item, index }) {
  const { selectedFeedback, toggleFeedbackSelection, clusters } = useApp();
  const isSelected = selectedFeedback.includes(item.id);
  const src = SOURCE_CONFIG[item.source] || SOURCE_CONFIG.slack;
  const cluster = clusters.find(c => c.feedbackIds.includes(item.id));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4 }}
      className={`feedback-card ${isSelected ? 'selected' : ''}`}
      onClick={() => toggleFeedbackSelection(item.id)}
      style={{ padding: '1.1rem', cursor: 'pointer', userSelect: 'none' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.7rem' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: isSelected ? '#00d4ff' : 'rgba(255,255,255,0.15)', boxShadow: isSelected ? '0 0 8px rgba(0,212,255,0.8)' : 'none', flexShrink: 0, transition: 'all 0.2s' }} />
        <div style={{ padding: '0.18rem 0.55rem', borderRadius: 6, background: src.bg, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <span style={{ fontSize: '0.75rem' }}>{src.icon}</span>
          <span style={{ fontSize: '0.65rem', color: src.color, fontFamily: 'Montserrat, sans-serif', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{src.label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginLeft: 'auto' }}>
          <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)' }}>▲ {item.votes}</span>
          <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)' }}>{item.timestamp}</span>
        </div>
      </div>

      {/* Author */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
        <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,#00d4ff,#9d00ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: '#0a0a0a', fontFamily: 'Montserrat, sans-serif', flexShrink: 0 }}>
          {item.avatar}
        </div>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.75)', fontFamily: 'Montserrat, sans-serif' }}>{item.author}</span>
      </div>

      {/* Text */}
      <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.72)', lineHeight: 1.6, marginBottom: '0.8rem', fontFamily: 'Inter, sans-serif' }}>
        {item.text}
      </p>

      {/* Tags */}
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        {item.tags.map(tag => (
          <span key={tag} className="chip-electric" style={{ fontSize: '0.62rem' }}>#{tag}</span>
        ))}
      </div>

      {/* Sentiment */}
      <SentimentBar score={item.sentiment} />

      {/* Cluster badge */}
      {cluster && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.6rem', borderRadius: 8, background: `${cluster.color}18`, border: `1px solid ${cluster.color}30` }}
        >
          <span style={{ fontSize: '0.7rem' }}>{cluster.icon}</span>
          <span style={{ fontSize: '0.65rem', color: cluster.color, fontFamily: 'Montserrat, sans-serif', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{cluster.name}</span>
        </motion.div>
      )}
    </motion.div>
  );
}

export default function DashboardPage() {
  const {
    feedback, loadSampleData, addFeedback, user,
    clusters, synthesizeClusters,
    selectedFeedback, generatePRD,
    isSynthesizing,
  } = useApp();

  const [isModalOpen,  setIsModalOpen]  = useState(false);
  const [showDemo,     setShowDemo]     = useState(false);

  // Live feedback = only real pipeline items (not demo)
  const liveFeedback  = feedback.filter(f => f.isAIPipeline);
  // What to display: live items, or if demo toggled: all
  const displayFeedback = showDemo ? feedback : liveFeedback;

  const hasLive       = liveFeedback.length > 0;
  const hasClusters   = clusters.length > 0;
  const selectedItems = displayFeedback.filter(f => selectedFeedback.includes(f.id));
  const negativeCount = displayFeedback.filter(f => f.sentiment < 0.35).length;

  // User identity
  const userName   = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'User';
  const userEmail  = user?.email ?? '';
  const userAvatar = user?.user_metadata?.avatar_url ?? null;
  const initials   = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top bar */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ padding: '1rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}
      >
        {/* User identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 200 }}>
          {/* Avatar */}
          {userAvatar ? (
            <img src={userAvatar} alt={userName}
              style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover',
                border: '2px solid rgba(0,212,255,0.4)', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg,#00d4ff,#9d00ff)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Montserrat,sans-serif', fontWeight: 800, fontSize: '0.85rem', color: '#0a0a0a' }}>
              {initials}
            </div>
          )}
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 800, fontFamily: 'Montserrat,sans-serif', lineHeight: 1.2 }}>
              {userName}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter,sans-serif' }}>
              {userEmail} &nbsp;·&nbsp;
              {hasLive
                ? <span style={{ color: '#00ff88' }}>● {liveFeedback.length} live signals</span>
                : <span style={{ color: 'rgba(255,255,255,0.3)' }}>No live signals yet</span>}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Demo toggle — opt-in only */}
          <button
            id="demo-toggle-btn"
            onClick={() => { setShowDemo(d => !d); if (!showDemo) loadSampleData(); }}
            style={{
              padding: '0.45rem 0.9rem', borderRadius: 8, border: '1px solid',
              borderColor: showDemo ? 'rgba(255,170,0,0.5)' : 'rgba(255,255,255,0.1)',
              background: showDemo ? 'rgba(255,170,0,0.1)' : 'transparent',
              color: showDemo ? '#ffaa00' : 'rgba(255,255,255,0.4)',
              fontSize: '0.75rem', fontFamily: 'Montserrat,sans-serif', fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            {showDemo ? '🧪 Demo ON' : '🧪 View Demo'}
          </button>

          <button className="btn-primary" style={{ background: 'linear-gradient(135deg,#00d4ff,#4f46e5)' }}
            onClick={() => setIsModalOpen(true)}>
            ➕ Add Feedback
          </button>
          {displayFeedback.length > 0 && !hasClusters && (
            <button id="synthesize-btn" className="btn-violet" onClick={synthesizeClusters} disabled={isSynthesizing}>
              {isSynthesizing ? <><Spinner /> Clustering...</> : '🔬 Synthesize Clusters'}
            </button>
          )}
          {displayFeedback.length > 0 && selectedFeedback.length >= 2 && (
            <motion.button id="generate-spec-btn" className="btn-primary"
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              onClick={() => generatePRD(selectedItems)} style={{ position: 'relative' }}>
              <span>✨ Generate Spec</span>
              <span style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 999, padding: '0.1rem 0.4rem', fontSize: '0.7rem', marginLeft: '0.25rem' }}>{selectedFeedback.length}</span>
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* Stats row */}
      {displayFeedback.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          style={{ display: 'flex', gap: '1rem', padding: '1rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
        >
          {[
            { label: 'Live Signals', value: displayFeedback.length, color: '#00d4ff' },
            { label: 'Negative',     value: negativeCount,          color: '#ff4466' },
            { label: 'Clusters',     value: clusters.length,        color: '#9d00ff' },
            { label: 'Selected',     value: selectedFeedback.length, color: '#00ff88' },
          ].map(stat => (
            <div key={stat.label} style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', minWidth: 80 }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'Montserrat, sans-serif', color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', fontFamily: 'Montserrat, sans-serif', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{stat.label}</div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Synthesizing overlay */}
      <AnimatePresence>
        {isSynthesizing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0, background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 50, gap: '1.5rem' }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              style={{ width: 64, height: 64, borderRadius: '50%', border: '2px solid rgba(0,212,255,0.1)', borderTopColor: '#00d4ff', borderRightColor: '#9d00ff' }}
            />
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.1rem', marginBottom: '0.4rem' }}>Vector Clustering in Progress</h3>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem' }}>Grouping semantically similar feedback signals...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem 2rem' }}>
        {displayFeedback.length === 0 ? (
          <LiveEmptyState />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {displayFeedback.map((item, i) => (
              <FeedbackCard key={item.id} item={item} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* Clusters panel */}
      {hasClusters && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '1rem 2rem' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat, sans-serif', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Discovered Clusters</span>
            <div className="accent-line" style={{ flex: 1 }} />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {clusters.map(c => (
              <motion.div
                key={c.id}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{ padding: '0.5rem 1rem', borderRadius: 10, background: `${c.color}12`, border: `1px solid ${c.color}30`, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <span>{c.icon}</span>
                <span style={{ fontSize: '0.78rem', color: c.color, fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>{c.name}</span>
                <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)' }}>· {c.feedbackIds.length}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Add Feedback Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <AddFeedbackModal onClose={() => setIsModalOpen(false)} onAdd={(item) => {
            addFeedback(item);
            setIsModalOpen(false);
          }} user={user} />
        )}
      </AnimatePresence>
    </div>
  );
}

function LiveEmptyState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, textAlign: 'center', gap: '1.25rem' }}>
      <motion.div
        animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{ fontSize: '3.5rem' }}
      >📡</motion.div>
      <div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'Montserrat, sans-serif', marginBottom: '0.5rem' }}>Awaiting Live Signals</h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', maxWidth: 380, lineHeight: 1.7 }}>
          Your inbox is live and monitoring. Send an email to your connected Gmail and it will appear here automatically — classified by AI within seconds.
        </p>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.5rem' }}>
        <a href="/integrations" style={{ padding: '0.6rem 1.2rem', borderRadius: 10, background: 'linear-gradient(135deg,#00d4ff22,#9d00ff22)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff', fontSize: '0.82rem', fontFamily: 'Montserrat,sans-serif', fontWeight: 700, textDecoration: 'none' }}>
          🔌 Check Integrations
        </a>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
      style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%' }}
    />
  );
}

function AddFeedbackModal({ onClose, onAdd, user }) {
  const [text, setText] = useState('');
  const [source, setSource] = useState('slack');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    const authorName = user?.user_metadata?.full_name || 'You';
    const newItem = {
      id: `fb-${Date.now()}`,
      source: source,
      author: authorName,
      avatar: authorName.charAt(0).toUpperCase(),
      text: text,
      sentiment: 0.5, // Default neutral, could be upgraded with AI later
      sentimentLabel: 'Neutral',
      tags: ['manual-entry'],
      votes: 1,
      timestamp: 'Just now',
    };
    onAdd(newItem);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: 'absolute', inset: 0, background: 'rgba(5,5,10,0.8)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={e => e.stopPropagation()}
        style={{ width: '90%', maxWidth: 450, background: '#11111a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '1.5rem', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}
      >
        <h2 style={{ fontSize: '1.2rem', fontFamily: 'Montserrat, sans-serif', fontWeight: 800, marginBottom: '1rem' }}>Add Manual Feedback</h2>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Source</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {['slack', 'intercom', 'zendesk', 'gmail'].map(s => (
                <button
                  key={s} type="button" onClick={() => setSource(s)}
                  style={{ flex: 1, padding: '0.5rem', borderRadius: 8, background: source === s ? SOURCE_CONFIG[s].bg : 'rgba(255,255,255,0.05)', border: `1px solid ${source === s ? SOURCE_CONFIG[s].color : 'transparent'}`, color: source === s ? SOURCE_CONFIG[s].color : 'rgba(255,255,255,0.5)', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
                >
                  {SOURCE_CONFIG[s].icon} {SOURCE_CONFIG[s].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>User Feedback</label>
            <textarea
              autoFocus
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="What did the user say?"
              style={{ width: '100%', height: 120, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '0.75rem', color: '#fff', fontSize: '0.9rem', resize: 'none', outline: 'none' }}
              onFocus={e => e.target.style.borderColor = '#00d4ff'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={onClose} style={{ padding: '0.6rem 1rem', borderRadius: 8, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '0.85rem' }}>Cancel</button>
            <button type="submit" disabled={!text.trim()} style={{ padding: '0.6rem 1.5rem', borderRadius: 8, background: 'linear-gradient(135deg, #00d4ff, #4f46e5)', border: 'none', color: '#fff', fontWeight: 600, cursor: text.trim() ? 'pointer' : 'not-allowed', opacity: text.trim() ? 1 : 0.5, fontSize: '0.85rem' }}>
              Add to Inbox
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
