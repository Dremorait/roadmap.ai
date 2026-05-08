import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { Calendar, Code, FileText, User, Clock, Layers } from 'lucide-react';
import RadialOrbitalTimeline from '../components/ui/radial-orbital-timeline';

const COLUMNS = [
  { id: 'planned', label: 'Planned', color: '#00d4ff', icon: '📌' },
  { id: 'in-progress', label: 'In Progress', color: '#ffaa00', icon: '⚡' },
  { id: 'review', label: 'Review', color: '#9d00ff', icon: '🔍' },
  { id: 'shipped', label: 'Shipped', color: '#00ff88', icon: '🚀' },
];

const PRIORITY_CONFIG = {
  critical: { color: '#ff4466', label: 'Critical', bg: 'rgba(255,68,102,0.12)' },
  high: { color: '#ffaa00', label: 'High', bg: 'rgba(255,170,0,0.12)' },
  medium: { color: '#00d4ff', label: 'Medium', bg: 'rgba(0,212,255,0.12)' },
  low: { color: 'rgba(255,255,255,0.4)', label: 'Low', bg: 'rgba(255,255,255,0.04)' },
};

const EFFORT_CONFIG = {
  S: { color: '#00ff88', label: 'S' },
  M: { color: '#ffaa00', label: 'M' },
  L: { color: '#ff4466', label: 'L' },
  XL: { color: '#9d00ff', label: 'XL' },
};

// Map roadmap status → timeline status
const statusMap = {
  shipped: 'completed',
  'in-progress': 'in-progress',
  review: 'in-progress',
  planned: 'pending',
};

// Map priority → energy (%)
const priorityToEnergy = { critical: 100, high: 75, medium: 50, low: 25 };

// Icon pool for orbital nodes
const ICON_POOL = [Calendar, Code, FileText, User, Clock, Layers];

function buildTimelineData(roadmapItems) {
  return roadmapItems.map((item, index) => ({
    id: item.id,
    title: item.title,
    date:
      item.status === 'shipped' ? '✓ Done'
      : item.status === 'in-progress' ? '⚡ Active'
      : item.status === 'review' ? '🔍 Review'
      : '📌 Planned',
    content: `Priority: ${(item.priority || 'medium').toUpperCase()} · Effort: ${item.effort || 'M'} · Impact: ${item.impact || 5}/10`,
    category: item.status,
    icon: ICON_POOL[index % ICON_POOL.length],
    relatedIds: [],
    status: statusMap[item.status] || 'pending',
    energy: priorityToEnergy[item.priority] ?? (item.impact ? item.impact * 10 : 50),
  }));
}

function KanbanCard({ item }) {
  const { moveRoadmapItem } = useApp();
  const priority = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.medium;
  const effort = EFFORT_CONFIG[item.effort] || EFFORT_CONFIG.M;
  const [dragging, setDragging] = useState(false);

  const handleDragStart = (e) => {
    e.dataTransfer.setData('itemId', item.id);
    setDragging(true);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: dragging ? 0.5 : 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.88 }}
      className="kanban-card"
      draggable
      onDragStart={handleDragStart}
      onDragEnd={() => setDragging(false)}
      style={{ opacity: dragging ? 0.5 : 1 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
        <div style={{ padding: '0.15rem 0.5rem', borderRadius: 6, background: priority.bg, fontSize: '0.65rem', color: priority.color, fontFamily: 'Montserrat, sans-serif', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {priority.label}
        </div>
        <div style={{ marginLeft: 'auto', width: 24, height: 24, borderRadius: '50%', background: `${effort.color}18`, border: `1px solid ${effort.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: effort.color, fontFamily: 'Montserrat, sans-serif', fontWeight: 800 }}>
          {effort.label}
        </div>
      </div>

      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'Montserrat, sans-serif', color: 'rgba(255,255,255,0.88)', marginBottom: '0.6rem', lineHeight: 1.4 }}>
        {item.title}
      </h4>

      <div style={{ marginBottom: '0.6rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
          <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', fontFamily: 'Montserrat, sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Impact</span>
          <span style={{ fontSize: '0.6rem', color: '#00d4ff', fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>{item.impact}/10</span>
        </div>
        <div className="progress-bar">
          <motion.div
            className="progress-fill"
            initial={{ width: 0 }}
            animate={{ width: `${item.impact * 10}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
        {COLUMNS.filter(c => c.id !== item.status).map(col => (
          <button
            key={col.id}
            onClick={() => moveRoadmapItem(item.id, col.id)}
            style={{ fontSize: '0.6rem', padding: '0.2rem 0.5rem', borderRadius: 6, background: `${col.color}10`, border: `1px solid ${col.color}25`, color: col.color, fontFamily: 'Montserrat, sans-serif', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.target.style.background = `${col.color}20`; e.target.style.transform = 'scale(1.05)'; }}
            onMouseLeave={e => { e.target.style.background = `${col.color}10`; e.target.style.transform = 'scale(1)'; }}
          >
            → {col.label}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function KanbanColumn({ col, items }) {
  const { moveRoadmapItem } = useApp();
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('itemId');
    if (itemId) moveRoadmapItem(itemId, col.id);
    setDragOver(false);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: '0.75rem', transition: 'all 0.2s' }}
    >
      <div style={{ padding: '0.75rem 1rem', borderRadius: 12, background: dragOver ? `${col.color}08` : 'rgba(255,255,255,0.03)', border: `1px solid ${dragOver ? col.color + '30' : 'rgba(255,255,255,0.05)'}`, display: 'flex', alignItems: 'center', gap: '0.6rem', transition: 'all 0.2s' }}>
        <span style={{ fontSize: '1rem' }}>{col.icon}</span>
        <span style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: '0.82rem', color: col.color }}>{col.label}</span>
        <div style={{ marginLeft: 'auto', width: 20, height: 20, borderRadius: '50%', background: `${col.color}18`, border: `1px solid ${col.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: col.color, fontFamily: 'Montserrat, sans-serif', fontWeight: 800 }}>
          {items.length}
        </div>
      </div>

      <div
        style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.65rem', minHeight: 100, padding: dragOver ? '0.5rem' : '0', borderRadius: 12, border: dragOver ? `2px dashed ${col.color}40` : '2px dashed transparent', transition: 'all 0.2s', background: dragOver ? `${col.color}04` : 'transparent' }}
      >
        <AnimatePresence>
          {items.map(item => (
            <KanbanCard key={item.id} item={item} />
          ))}
        </AnimatePresence>
        {items.length === 0 && !dragOver && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80, color: 'rgba(255,255,255,0.15)', fontSize: '0.75rem', fontFamily: 'Inter, sans-serif', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: 10 }}>
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

export default function RoadmapPage() {
  const { roadmapItems } = useApp();
  const [activeView, setActiveView] = useState('kanban');
  const totalItems = roadmapItems.length;
  const shipped = roadmapItems.filter(r => r.status === 'shipped').length;
  const progress = totalItems > 0 ? Math.round((shipped / totalItems) * 100) : 0;

  const timelineData = buildTimelineData(roadmapItems);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ padding: '1.25rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: 'Montserrat, sans-serif', marginBottom: '0.2rem' }}>Smart Roadmap</h1>
          <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter, sans-serif' }}>
            {activeView === 'kanban'
              ? `Drag features across lanes · ${totalItems} items · ${progress}% shipped`
              : `Orbital timeline · ${totalItems} nodes · click any node to explore`}
          </p>
        </div>

        {/* View Toggle */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '0.25rem', gap: '0.25rem' }}>
          {[
            { id: 'kanban', label: '⬛ Kanban' },
            { id: 'timeline', label: '🌐 Orbital' },
          ].map(v => (
            <button
              key={v.id}
              onClick={() => setActiveView(v.id)}
              style={{
                padding: '0.4rem 0.9rem',
                borderRadius: 8,
                border: 'none',
                fontSize: '0.72rem',
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 700,
                letterSpacing: '0.03em',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: activeView === v.id ? 'linear-gradient(135deg, #00d4ff, #9d00ff)' : 'transparent',
                color: activeView === v.id ? '#0a0a0a' : 'rgba(255,255,255,0.4)',
              }}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Progress bar (kanban only) */}
        {activeView === 'kanban' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 220 }}>
            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat, sans-serif', fontWeight: 600, whiteSpace: 'nowrap' }}>Sprint Progress</span>
            <div className="progress-bar" style={{ flex: 1 }}>
              <motion.div
                className="progress-fill"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
              />
            </div>
            <span style={{ fontSize: '0.75rem', color: '#00d4ff', fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>{progress}%</span>
          </div>
        )}
      </motion.div>

      {/* Content area */}
      <AnimatePresence mode="wait">
        {activeView === 'kanban' ? (
          <motion.div
            key="kanban"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ flex: 1, overflow: 'auto', padding: '1.5rem 2rem' }}
          >
            <div style={{ display: 'flex', gap: '1rem', minWidth: 'max-content', alignItems: 'flex-start', minHeight: '100%' }}>
              {COLUMNS.map(col => (
                <KanbanColumn
                  key={col.id}
                  col={col}
                  items={roadmapItems.filter(r => r.status === col.id)}
                />
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="timeline"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ flex: 1, overflow: 'hidden' }}
          >
            {timelineData.length > 0 ? (
              <RadialOrbitalTimeline timelineData={timelineData} />
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', height: '100%' }}>
                No roadmap items yet — add items in the Spec Builder to see them here.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
