// src/pages/DashboardPage.jsx — Elite Redesign
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { 
  Search, Filter, Mail, MessageSquare, AlertTriangle, 
  Send, CheckCircle, Clock, Trash2, ChevronDown, 
  TrendingUp, BarChart3, Zap, Globe
} from 'lucide-react';

const SOURCE_CONFIG = {
  slack:    { color: '#e01e5a', icon: '⚡', label: 'Slack' },
  intercom: { color: '#1f8ded', icon: '💬', label: 'Intercom' },
  zendesk:  { color: '#03363d', icon: '🎫', label: 'Zendesk' },
  gmail:    { color: '#ea4335', icon: '📧', label: 'Gmail' },
};

const TRIAGE_MAP = {
  'Bug Report':      { class: 'triage-bug', icon: <AlertTriangle size={12} /> },
  'Feature Request': { class: 'triage-feature', icon: <Zap size={12} /> },
  'Support Query':   { class: 'triage-support', icon: <MessageSquare size={12} /> },
  'Spam':            { class: 'triage-spam', icon: <Trash2 size={12} /> },
};

function FeedbackCard({ item, index }) {
  const { toggleFeedbackSelection, selectedFeedback, sendManualReply, isReplyLoading } = useApp();
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState(item.suggestedReply || '');
  
  const isSelected = selectedFeedback.includes(item.id);
  const src        = SOURCE_CONFIG[item.source] || SOURCE_CONFIG.slack;
  const triage     = TRIAGE_MAP[item.triage] || TRIAGE_MAP['Support Query'];
  
  const handleReply = async () => {
    if (!replyText.trim()) return;
    const res = await sendManualReply(item.id, replyText);
    if (res.success) {
      setShowReply(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 1), duration: 0.4 }}
      className={`feedback-card ${isSelected ? 'selected' : ''} slide-in-up`}
      style={{ padding: '1rem', cursor: 'pointer' }}
      onClick={() => toggleFeedbackSelection(item.id)}
    >
      <div className="scanline" />
      
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <div className={`triage-badge ${triage.class}`} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          {triage.icon}
          {item.triage || 'Unclassified'}
        </div>
        
        {item.urgency > 7 && (
          <div style={{ background: '#ff4466', color: '#fff', fontSize: '0.6rem', padding: '0.15rem 0.4rem', borderRadius: 4, fontWeight: 800 }}>
            URGENT
          </div>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem', opacity: 0.4 }}>
          <Clock size={10} />
          <span style={{ fontSize: '0.65rem' }}>{item.timestamp}</span>
        </div>
      </div>

      {/* Main Text */}
      <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'rgba(255,255,255,0.85)', marginBottom: '0.8rem', fontWeight: 500 }}>
        {item.text}
      </p>

      {/* Author & Meta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: 'auto' }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#00d4ff,#9d00ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, color: '#000' }}>
          {item.avatar}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{item.author}</div>
          <div style={{ fontSize: '0.6rem', color: src.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {src.icon} {src.label}
          </div>
        </div>
        
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.65rem', color: item.sentiment > 0.6 ? '#00ff88' : item.sentiment < 0.4 ? '#ff4466' : '#ffaa00', fontWeight: 700 }}>
            {Math.round(item.sentiment * 100)}% POS
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '0.5rem' }}>
        <button 
          onClick={(e) => { e.stopPropagation(); setShowReply(!showReply); }}
          className="btn-ghost" style={{ flex: 1, fontSize: '0.7rem' }}
        >
          <MessageSquare size={12} />
          {item.autoReplied ? 'Replied ✓' : 'Reply with AI'}
        </button>
        <button className="btn-ghost" style={{ padding: '0.5rem' }}>
          <TrendingUp size={12} />
        </button>
      </div>

      {/* Inline Reply Area */}
      <AnimatePresence>
        {showReply && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden', marginTop: '0.75rem' }}
            onClick={e => e.stopPropagation()}
          >
            <textarea 
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="Draft your reply..."
              style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '0.5rem', color: '#fff', fontSize: '0.8rem', minHeight: 80, resize: 'none' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button 
                onClick={handleReply}
                disabled={isReplyLoading || !replyText.trim()}
                className="btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.7rem' }}
              >
                {isReplyLoading ? 'Sending...' : <><Send size={12} /> Send Reply</>}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function DashboardPage() {
  const { 
    feedback, stats, insights, feedbackLoading, 
    filters, setFilters, synthesizeClusters, isSynthesizing,
    selectedFeedback, generatePRD
  } = useApp();

  const [search, setSearch] = useState(filters.search);

  // Stats cards data
  const statsCards = [
    { label: 'Total Signals', value: stats?.total_feedback ?? 0, icon: <Globe size={18} />, color: '#00d4ff' },
    { label: 'Critical Bugs', value: stats?.bugs ?? 0, icon: <AlertTriangle size={18} />, color: '#ff4466' },
    { label: 'Avg Sentiment', value: `${Math.round((stats?.avg_sentiment ?? 0.5) * 100)}%`, icon: <TrendingUp size={18} />, color: '#00ff88' },
    { label: 'Auto Replied', value: stats?.auto_replied ?? 0, icon: <CheckCircle size={18} />, color: '#9d00ff' },
  ];

  const handleSearch = (e) => {
    const val = e.target.value;
    setSearch(val);
    // Debounce filter update
    const timer = setTimeout(() => setFilters(prev => ({ ...prev, search: val })), 500);
    return () => clearTimeout(timer);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'radial-gradient(circle at 50% -20%, rgba(0,212,255,0.05), transparent)' }}>
      
      {/* Ticker Bar */}
      <div style={{ background: 'rgba(0,212,255,0.03)', borderBottom: '1px solid rgba(0,212,255,0.1)', padding: '0.4rem 1rem', display: 'flex', gap: '2rem', overflow: 'hidden', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', gap: '2rem', animation: 'shimmer 20s linear infinite' }}>
          {insights?.trends?.map((t, i) => (
            <span key={i} style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat' }}>
              🔥 TRENDING: <span style={{ color: '#00d4ff' }}>{t.key_phrase}</span> (+{Math.round(t.spike_factor * 100)}%)
            </span>
          ))}
          {(!insights?.trends || insights.trends.length === 0) && (
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)' }}>
              🛰️ SIGNAL MONITOR ACTIVE · AWAITING NEW PATTERNS · LATENCY 2.4s
            </span>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'flex', gap: '1rem', padding: '1.5rem 2rem 0.5rem' }}>
        {statsCards.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            style={{ flex: 1, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 12, background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', fontFamily: 'Montserrat' }}>{s.value}</div>
              <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filter & Search Bar */}
      <div style={{ padding: '1rem 2rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 250 }}>
          <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} size={16} />
          <input 
            type="text"
            placeholder="Search signals, authors, or topics..."
            value={search}
            onChange={handleSearch}
            className="cyber-input"
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <select 
            value={filters.source}
            onChange={e => setFilters(f => ({ ...f, source: e.target.value }))}
            className="cyber-input" style={{ width: 'auto', fontSize: '0.75rem', fontWeight: 700 }}
          >
            <option value="">All Sources</option>
            <option value="gmail">Gmail</option>
            <option value="slack">Slack</option>
            <option value="intercom">Intercom</option>
          </select>
          
          <select 
            value={filters.triage}
            onChange={e => setFilters(f => ({ ...f, triage: e.target.value }))}
            className="cyber-input" style={{ width: 'auto', fontSize: '0.75rem', fontWeight: 700 }}
          >
            <option value="">All Triage</option>
            <option value="Bug Report">Bugs</option>
            <option value="Feature Request">Features</option>
            <option value="Support Query">Support</option>
          </select>

          <button 
            onClick={synthesizeClusters}
            disabled={isSynthesizing}
            className="btn-violet" style={{ height: 42 }}
          >
            {isSynthesizing ? 'Clustering...' : <><Zap size={14} /> Synthesize</>}
          </button>

          {selectedFeedback.length > 0 && (
            <button 
              onClick={() => generatePRD(feedback.filter(f => selectedFeedback.includes(f.id)))}
              className="btn-primary" style={{ height: 42 }}
            >
              <BarChart3 size={14} /> Spec ({selectedFeedback.length})
            </button>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0.5rem 2rem 2rem' }}>
        {feedbackLoading && feedback.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem' }}>
            <div className="pulse-dot" style={{ width: 40, height: 40 }} />
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', fontWeight: 700 }}>SYNCING WITH DATA STREAM...</div>
          </div>
        ) : (
          <div className="masonry-grid">
            {feedback.map((item, i) => (
              <FeedbackCard key={item.id} item={item} index={i} />
            ))}
          </div>
        )}
        
        {!feedbackLoading && feedback.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.3 }}>
            <Mail size={48} style={{ marginBottom: '1rem' }} />
            <div style={{ fontWeight: 800 }}>NO SIGNALS DETECTED</div>
            <div style={{ fontSize: '0.75rem' }}>Check your filters or wait for new data</div>
          </div>
        )}
      </div>
    </div>
  );
}
