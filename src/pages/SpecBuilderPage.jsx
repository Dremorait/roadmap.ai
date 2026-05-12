import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useApp } from '../context/AppContext';

const SOURCE_CONFIG = {
  slack: { color: '#e01e5a', icon: '⚡', label: 'Slack' },
  intercom: { color: '#1f8ded', icon: '💬', label: 'Intercom' },
  zendesk: { color: '#03a688', icon: '🎫', label: 'Zendesk' },
  gmail: { color: '#ea4335', icon: '📧', label: 'Gmail' },
};

function TypewriterText({ text, speed = 8 }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const indexRef = useRef(0);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    indexRef.current = 0;

    const interval = setInterval(() => {
      if (indexRef.current < text.length) {
        const chunkSize = Math.floor(Math.random() * 4) + 2;
        const next = text.slice(0, indexRef.current + chunkSize);
        setDisplayed(next);
        indexRef.current += chunkSize;
      } else {
        setDone(true);
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return (
    <div className={`prd-content ${!done ? 'typewriter-cursor' : ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayed}</ReactMarkdown>
    </div>
  );
}

export default function SpecBuilderPage() {
  const { feedback, selectedFeedback, activePRD, prdText, isGeneratingPRD, generatePRD, addToRoadmap } = useApp();
  const selectedItems = feedback.filter(f => selectedFeedback.includes(f.id));
  const [exported, setExported] = useState(false);

  const handleExportMD = () => {
    if (!prdText) return;
    const blob = new Blob([prdText], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PRD-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 2500);
  };

  const handleAddToRoadmap = () => {
    const topTags = [...new Set(selectedItems.flatMap(f => f.tags))];
    const featureTitle = topTags.length
      ? `${topTags[0].charAt(0).toUpperCase() + topTags[0].slice(1)} & ${topTags[1] ? topTags[1].charAt(0).toUpperCase() + topTags[1].slice(1) + ' ' : ''}Remediation`
      : 'AI-Generated Feature Spec';
    const negCount = selectedItems.filter(f => f.sentiment < 0.35).length;
    const complexity = topTags.some(t => ['api','sso','auth','enterprise'].includes(t)) ? 'L' : topTags.some(t => ['performance','pagination','mobile'].includes(t)) ? 'M' : 'S';
    const impact = Math.min(10, Math.round(4 + (negCount / selectedItems.length) * 3 + (selectedItems.reduce((s,f)=>s+f.votes,0) / 30)));
    addToRoadmap({
      id: `rm-${Date.now()}`,
      title: featureTitle,
      priority: impact >= 8 ? 'critical' : impact >= 6 ? 'high' : 'medium',
      effort: complexity,
      impact,
      status: 'planned',
      prdId: activePRD?.id,
    });
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ padding: '1.25rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: 'Montserrat, sans-serif', marginBottom: '0.2rem' }}>Spec Builder</h1>
          <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter, sans-serif' }}>
            {prdText ? 'PRD generated · Review and ship to roadmap' : 'Select feedback signals and generate your PRD'}
          </p>
        </div>
        {prdText && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button id="export-md-btn" className="btn-ghost" onClick={handleExportMD}>
              {exported ? '✅ Exported!' : '⬇️ Export Markdown'}
            </button>
            <button id="add-roadmap-btn" className="btn-primary" onClick={handleAddToRoadmap}>
              🗺️ Ship to Roadmap
            </button>
          </div>
        )}
      </motion.div>

      {/* Split screen */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Feedback context */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          style={{ width: 320, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.06)', overflow: 'auto', padding: '1.5rem' }}
        >
          <div style={{ marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat, sans-serif', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Input Signals ({selectedItems.length})
            </span>
          </div>

          {selectedItems.length === 0 ? (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.82rem', fontFamily: 'Inter, sans-serif', textAlign: 'center', padding: '2rem 0' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📌</div>
              Select 2+ feedback cards from the Inbox to generate a spec
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {selectedItems.map((item, i) => {
                const src = SOURCE_CONFIG[item.source] || SOURCE_CONFIG.slack;
                const sentColor = item.sentiment < 0.35 ? '#ff4466' : item.sentiment < 0.6 ? '#ffaa00' : '#00ff88';
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -15 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    style={{ padding: '0.9rem', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem' }}>{src.icon}</span>
                      <span style={{ fontSize: '0.7rem', color: src.color, fontFamily: 'Montserrat, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{src.label}</span>
                      <span style={{ fontSize: '0.65rem', color: sentColor, marginLeft: 'auto', fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>
                        {Math.round(item.sentiment * 100)}%
                      </span>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.55, fontFamily: 'Inter, sans-serif' }}>{item.text}</p>
                    <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                      {item.tags.map(t => <span key={t} className="chip-electric" style={{ fontSize: '0.6rem' }}>#{t}</span>)}
                    </div>
                  </motion.div>
                );
              })}

              {!prdText && selectedItems.length >= 2 && (
                <motion.button
                  id="gen-spec-side-btn"
                  className="btn-primary"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => generatePRD(selectedItems)}
                  style={{ marginTop: '0.5rem', justifyContent: 'center' }}
                  disabled={isGeneratingPRD}
                >
                  {isGeneratingPRD ? <><GenSpinner /> Generating PRD...</> : '✨ Generate Spec'}
                </motion.button>
              )}
            </div>
          )}
        </motion.div>

        {/* Right: PRD output */}
        <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem 2rem', position: 'relative' }}>
          <AnimatePresence mode="wait">
            {isGeneratingPRD && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: '1.75rem' }}
              >
                {/* Dual-ring spinner */}
                <div style={{ position: 'relative', width: 64, height: 64 }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
                    style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(157,0,255,0.12)', borderTopColor: '#9d00ff' }}
                  />
                  <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
                    style={{ position: 'absolute', inset: 8, borderRadius: '50%', border: '2px solid rgba(0,212,255,0.12)', borderTopColor: '#00d4ff' }}
                  />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>🧠</div>
                </div>
                <div style={{ textAlign: 'center', maxWidth: 320 }}>
                  <h3 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1rem', fontWeight: 800, marginBottom: '0.6rem' }}>Drafting Technical Specification...</h3>
                  <GeneratingSteps />
                </div>
              </motion.div>
            )}

            {prdText && !isGeneratingPRD && (
              <motion.div
                key="prd"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-card-violet"
                style={{ padding: '2rem', minHeight: 400 }}
              >
                {/* PRD header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(157,0,255,0.15)', flexWrap: 'wrap' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#9d00ff', boxShadow: '0 0 8px rgba(157,0,255,0.9)', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'Montserrat, sans-serif', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      Technical Specification · {new Date().toLocaleDateString()}
                    </div>
                    <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.22)', fontFamily: 'Inter, sans-serif', marginTop: '0.15rem' }}>
                      6 sections · Executive Summary · User Stories · Functional Req · Constraints · Gherkin AC · Impact Matrix
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span className="chip-violet">Architect-Grade</span>
                    <span className="chip-green">AI</span>
                    <span className="chip-amber">Draft</span>
                  </div>
                </div>
                <TypewriterText text={prdText} speed={6} />
              </motion.div>
            )}

            {!prdText && !isGeneratingPRD && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, textAlign: 'center', gap: '1rem' }}
              >
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  style={{ fontSize: '3.5rem' }}
                >📋</motion.div>
                <h2 style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '1.1rem' }}>Your PRD will appear here</h2>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.82rem', maxWidth: 320 }}>
                  Select at least 2 feedback items from the Inbox, then click Generate Spec.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function GenSpinner() {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
      style={{ width: 14, height: 14, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#0a0a0a', borderRadius: '50%' }}
    />
  );
}

const PIPELINE_STEPS = [
  'Parsing feedback cluster vectors...',
  'Deriving user personas from sentiment...',
  'Generating functional requirements...',
  'Composing Gherkin acceptance criteria...',
  'Calculating impact vs. effort matrix...',
  'Finalising technical constraints...',
];

function GeneratingSteps() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep(s => (s + 1) % PIPELINE_STEPS.length), 420);
    return () => clearInterval(t);
  }, []);
  return (
    <motion.p
      key={step}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      style={{ color: 'rgba(0,212,255,0.75)', fontSize: '0.78rem', fontFamily: 'JetBrains Mono, monospace' }}
    >
      › {PIPELINE_STEPS[step]}
    </motion.p>
  );
}
