import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';

const SOURCE_CONFIG = {
  slack: { color: '#e01e5a', bg: 'rgba(224,30,90,0.12)', icon: '⚡', label: 'Slack' },
  intercom: { color: '#1f8ded', bg: 'rgba(31,141,237,0.12)', icon: '💬', label: 'Intercom' },
  zendesk: { color: '#03363d', bg: 'rgba(3,150,140,0.15)', icon: '🎫', label: 'Zendesk' },
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
    feedback, loadSampleData,
    clusters, synthesizeClusters,
    selectedFeedback, generatePRD,
    isSynthesizing,
  } = useApp();

  const hasData = feedback.length > 0;
  const hasClusters = clusters.length > 0;
  const selectedItems = feedback.filter(f => selectedFeedback.includes(f.id));
  const negativeCount = feedback.filter(f => f.sentiment < 0.35).length;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top bar */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ padding: '1.25rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: 'Montserrat, sans-serif', marginBottom: '0.2rem' }}>
            Feedback Inbox
          </h1>
          <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter, sans-serif' }}>
            {hasData ? `${feedback.length} signals captured · ${negativeCount} require attention` : 'Connect sources to begin ingestion'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {!hasData && (
            <button id="load-data-btn" className="btn-primary" onClick={loadSampleData}>
              📥 Load Sample Data
            </button>
          )}
          {hasData && !hasClusters && (
            <button id="synthesize-btn" className="btn-violet" onClick={synthesizeClusters} disabled={isSynthesizing}>
              {isSynthesizing ? <><Spinner /> Clustering...</> : '🔬 Synthesize Clusters'}
            </button>
          )}
          {hasData && selectedFeedback.length >= 2 && (
            <motion.button
              id="generate-spec-btn"
              className="btn-primary"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={() => generatePRD(selectedItems)}
              style={{ position: 'relative' }}
            >
              <span>✨ Generate Spec</span>
              <span style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 999, padding: '0.1rem 0.4rem', fontSize: '0.7rem', marginLeft: '0.25rem' }}>{selectedFeedback.length}</span>
            </motion.button>
          )}
          {hasData && (
            <button id="reset-btn" className="btn-ghost" onClick={loadSampleData}>↺ Refresh</button>
          )}
        </div>
      </motion.div>

      {/* Stats row */}
      {hasData && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          style={{ display: 'flex', gap: '1rem', padding: '1rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
        >
          {[
            { label: 'Total Signals', value: feedback.length, color: '#00d4ff' },
            { label: 'Negative', value: negativeCount, color: '#ff4466' },
            { label: 'Clusters', value: clusters.length, color: '#9d00ff' },
            { label: 'Selected', value: selectedFeedback.length, color: '#00ff88' },
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
        {!hasData ? (
          <EmptyState />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {feedback.map((item, i) => (
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
    </div>
  );
}

function EmptyState() {
  const { loadSampleData } = useApp();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, textAlign: 'center', gap: '1.25rem' }}>
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{ fontSize: '4rem' }}
      >📡</motion.div>
      <div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'Montserrat, sans-serif', marginBottom: '0.5rem' }}>No Signals Yet</h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', maxWidth: 360 }}>Connect Slack, Intercom, or Zendesk to begin ingesting feedback, or load sample data to explore.</p>
      </div>
      <button id="empty-load-btn" className="btn-primary" onClick={loadSampleData}>📥 Load Sample Data</button>
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
