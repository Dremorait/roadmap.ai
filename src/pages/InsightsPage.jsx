// src/pages/InsightsPage.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { 
  TrendingUp, BarChart3, MessageSquare, AlertCircle, 
  Calendar, ArrowUpRight, ArrowDownRight, Target
} from 'lucide-react';

export default function InsightsPage() {
  const { insights, stats } = useApp();
  
  const summaries = insights?.summaries ?? [];
  const trends    = insights?.trends ?? [];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', padding: '2rem', background: 'radial-gradient(circle at 100% 0%, rgba(157,0,255,0.05), transparent)' }}>
      
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 900, fontFamily: 'Montserrat', marginBottom: '0.5rem' }}>AI Product Insights</h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>Deep-dive analysis into customer sentiment, trending issues, and product performance.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        
        {/* Left Column: Daily Summaries */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <Calendar size={18} style={{ color: '#00d4ff' }} />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'Montserrat' }}>Executive Digests</h2>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {summaries.length > 0 ? summaries.map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="glass-card"
                  style={{ padding: '1.25rem' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', fontFamily: 'Montserrat' }}>
                      {new Date(s.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <span style={{ fontSize: '0.7rem', color: '#00ff88', fontWeight: 700 }}>● {s.total_feedback} SIGNALS</span>
                      <span style={{ fontSize: '0.7rem', color: '#00d4ff', fontWeight: 700 }}>{Math.round(s.sentiment_avg * 100)}% SENTIMENT</span>
                    </div>
                  </div>
                  <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'rgba(255,255,255,0.8)', fontStyle: 'italic', borderLeft: '2px solid #00d4ff', paddingLeft: '1rem' }}>
                    "{s.summary}"
                  </p>
                </motion.div>
              )) : (
                <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.2)' }}>
                  No AI summaries generated yet.
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Trends & Area Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Trending Topics */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <TrendingUp size={18} style={{ color: '#9d00ff' }} />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'Montserrat' }}>Emerging Trends</h2>
            </div>
            <div className="glass-card" style={{ padding: '1rem' }}>
              {trends.length > 0 ? trends.map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 0', borderBottom: i < trends.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{t.key_phrase}</div>
                    <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>{t.today_count} occurrences today</div>
                  </div>
                  <div style={{ textAlign: 'right', color: t.spike_factor > 0 ? '#00ff88' : '#ff4466', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 800, fontSize: '0.75rem' }}>
                    {t.spike_factor > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {Math.abs(Math.round(t.spike_factor * 100))}%
                  </div>
                </div>
              )) : (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '0.8rem' }}>
                  Insufficient data for trend detection.
                </div>
              )}
            </div>
          </section>

          {/* Product Areas */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <Target size={18} style={{ color: '#00ff88' }} />
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'Montserrat' }}>Issue Distribution</h2>
            </div>
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Mocked area stats for UI showcase */}
                {[
                  { label: 'Authentication', value: 45, color: '#00d4ff' },
                  { label: 'Billing & Payments', value: 28, color: '#9d00ff' },
                  { label: 'Mobile App', value: 20, color: '#ffaa00' },
                  { label: 'API Performance', value: 15, color: '#ff4466' }
                ].map((a, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.4rem', fontWeight: 700 }}>
                      <span>{a.label}</span>
                      <span style={{ color: a.color }}>{a.value}%</span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${a.value}%` }}
                        style={{ height: '100%', background: a.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

        </div>

      </div>

    </div>
  );
}
