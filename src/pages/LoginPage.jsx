import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { AtSignIcon, KeyRoundIcon, RocketIcon } from 'lucide-react';

export default function LoginPage() {
  const { login } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('Please enter your email and password'); return; }
    setLoading(true);
    setError('');
    await new Promise(r => setTimeout(r, 1800));
    login({ email, name: email.split('@')[0], role: 'Product Manager' });
    setLoading(false);
  };

  const handleDemo = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    login({ email: 'demo@roadmap.ai', name: 'Demo User', role: 'Product Manager' });
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#070710', color: '#fff', fontFamily: 'Inter, sans-serif', position: 'relative' }}>

      {/* ══════════════════════════════════════════════════
          LEFT PANE — Brand + Testimonial + Animated Paths
      ══════════════════════════════════════════════════ */}
      <div style={{
        flex: '0 0 45%',
        position: 'relative',
        overflow: 'hidden',
        background: '#030308',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        flexDirection: 'column',
        padding: '2.5rem',
      }}
        className="hidden-mobile"
      >
        {/* Gradient wash */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse 80% 60% at 20% 50%, rgba(99,102,241,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Bottom vignette */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, #030308 0%, transparent 40%, #030308 100%)',
          pointerEvents: 'none', zIndex: 1,
        }} />

        {/* Floating paths (behind text, z=0) */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <FloatingPaths position={1} />
          <FloatingPaths position={-1} />
        </div>

        {/* Logo — top */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <LogoSVG size={36} />
          <span style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'Montserrat, sans-serif', letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #a5b4fc, #fff, #fda4af)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Roadmap.ai
          </span>
        </div>

        {/* Testimonial — bottom */}
        <div style={{ position: 'relative', zIndex: 2, marginTop: 'auto' }}>
          <blockquote style={{ maxWidth: '38ch' }}>
            <p style={{ fontSize: '1.35rem', fontWeight: 300, lineHeight: 1.6, color: 'rgba(255,255,255,0.85)', marginBottom: '1.25rem' }}>
              &ldquo;This platform has completely transformed how we ship products. The autonomous AI capabilities save our PMs countless hours every week.&rdquo;
            </p>
            <footer style={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              — Sarah Jenkins, VP of Product
            </footer>
          </blockquote>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          RIGHT PANE — Login Form
      ══════════════════════════════════════════════════ */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 2rem',
        position: 'relative',
      }}>
        {/* Subtle glows */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)', filter: 'blur(20px)' }} />
          <div style={{ position: 'absolute', bottom: '-20%', left: '-10%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(244,63,94,0.08) 0%, transparent 70%)', filter: 'blur(20px)' }} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }}
        >
          {/* Mobile-only logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '2.5rem' }} className="mobile-only-flex">
            <LogoSVG size={32} />
            <span style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'Montserrat, sans-serif' }}>Roadmap.ai</span>
          </div>

          {/* Heading */}
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.4rem', fontFamily: 'Montserrat, sans-serif' }}>
              Welcome back
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.875rem' }}>
              Sign in to your workspace to continue.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <FormInput
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<AtSignIcon size={15} />}
            />
            <FormInput
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<KeyRoundIcon size={15} />}
            />

            {error && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ color: '#f87171', fontSize: '0.8rem', textAlign: 'center' }}>
                {error}
              </motion.p>
            )}

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.01 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              style={{
                marginTop: '0.25rem',
                width: '100%',
                height: 48,
                borderRadius: 12,
                border: 'none',
                background: loading ? 'rgba(99,102,241,0.45)' : 'linear-gradient(135deg, #4f46e5, #6366f1)',
                color: '#fff',
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 700,
                fontSize: '0.9rem',
                letterSpacing: '0.05em',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                boxShadow: loading ? 'none' : '0 0 24px rgba(99,102,241,0.4)',
                transition: 'box-shadow 0.25s, background 0.25s',
              }}
            >
              {loading ? <><LoadingSpinner /> Authenticating...</> : 'Sign In'}
            </motion.button>
          </form>

          {/* Separator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '1.5rem 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            <span style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          </div>

          {/* Demo button */}
          <motion.button
            onClick={handleDemo}
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.01 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
            style={{
              width: '100%',
              height: 48,
              borderRadius: 12,
              border: '1px solid rgba(244,63,94,0.25)',
              background: 'rgba(244,63,94,0.06)',
              color: '#fda4af',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = 'rgba(244,63,94,0.12)'; e.currentTarget.style.borderColor = 'rgba(244,63,94,0.45)'; }}}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(244,63,94,0.06)'; e.currentTarget.style.borderColor = 'rgba(244,63,94,0.25)'; }}
          >
            <RocketIcon size={15} style={{ color: '#f87171' }} />
            Launch Demo Session
          </motion.button>

          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem', marginTop: '1.75rem', lineHeight: 1.7 }}>
            By continuing, you agree to our{' '}
            <a href="#" style={{ color: 'rgba(255,255,255,0.45)', textDecoration: 'underline', textUnderlineOffset: 3 }}>Terms of Service</a>
            {' '}and{' '}
            <a href="#" style={{ color: 'rgba(255,255,255,0.45)', textDecoration: 'underline', textUnderlineOffset: 3 }}>Privacy Policy</a>.
          </p>
        </motion.div>

        {/* Dremora watermark — bottom-center of the right pane */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          style={{
            position: 'absolute',
            bottom: '1.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            display: 'flex', alignItems: 'center', gap: '0.45rem',
            padding: '0.4rem 0.9rem', borderRadius: 999,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(12px)',
            cursor: 'default',
            whiteSpace: 'nowrap',
          }}
          whileHover={{ background: 'rgba(99,102,241,0.1)', borderColor: 'rgba(99,102,241,0.3)', boxShadow: '0 0 16px rgba(99,102,241,0.15)' }}
        >
          <img src="/dremora-icon.png" alt="Dremora" style={{ width: 20, height: 20, objectFit: 'contain', filter: 'drop-shadow(0 0 4px rgba(99,102,241,0.6))' }} />
          <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.28)', fontFamily: 'Montserrat, sans-serif', fontWeight: 500, letterSpacing: '0.05em' }}>Crafted by</span>
          <span style={{ fontSize: '0.7rem', fontWeight: 800, fontFamily: 'Montserrat, sans-serif', letterSpacing: '0.07em', background: 'linear-gradient(135deg, #a5b4fc, #f9a8d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            DREMORA
          </span>
        </motion.div>
      </div>



      {/* Responsive CSS */}
      <style>{`
        .hidden-mobile { display: none; }
        .mobile-only-flex { display: flex; }
        @media (min-width: 1024px) {
          .hidden-mobile { display: flex !important; }
          .mobile-only-flex { display: none !important; }
        }
      `}</style>
    </div>
  );
}

/* ──────────────────────── Sub-components ──────────────────────── */

function FormInput({ type, placeholder, value, onChange, icon }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        position: 'absolute', top: '50%', left: '0.875rem',
        transform: 'translateY(-50%)',
        color: focused ? 'rgba(165,180,252,0.8)' : 'rgba(255,255,255,0.3)',
        pointerEvents: 'none', transition: 'color 0.2s',
        display: 'flex', alignItems: 'center',
      }}>
        {icon}
      </div>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          height: 48,
          paddingLeft: '2.5rem',
          paddingRight: '1rem',
          borderRadius: 12,
          border: `1px solid ${focused ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)'}`,
          background: focused ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.04)',
          color: '#fff',
          fontSize: '0.875rem',
          outline: 'none',
          transition: 'border-color 0.2s, background 0.2s',
          boxSizing: 'border-box',
          boxShadow: focused ? '0 0 0 3px rgba(99,102,241,0.12)' : 'none',
        }}
      />
    </div>
  );
}

function LogoSVG({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lgC" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="50%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
        <linearGradient id="lgR" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.7" />
        </linearGradient>
        <filter id="lg">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <circle cx="36" cy="36" r="33" stroke="url(#lgR)" strokeWidth="1" strokeDasharray="6 4" />
      <circle cx="36" cy="36" r="24" stroke="#6366f1" strokeWidth="0.75" strokeOpacity="0.3" />
      <polygon points="36,18 50,27 50,45 36,54 22,45 22,27" fill="url(#lgC)" filter="url(#lg)" opacity="0.95" />
      <line x1="36" y1="18" x2="36" y2="54" stroke="rgba(255,255,255,0.2)" strokeWidth="0.75" />
      <line x1="22" y1="27" x2="50" y2="45" stroke="rgba(255,255,255,0.2)" strokeWidth="0.75" />
      <line x1="50" y1="27" x2="22" y2="45" stroke="rgba(255,255,255,0.2)" strokeWidth="0.75" />
      <circle cx="36" cy="36" r="4" fill="white" opacity="0.9" filter="url(#lg)" />
      <circle cx="36" cy="3" r="2.5" fill="#818cf8" opacity="0.8" />
      <circle cx="69" cy="54" r="2" fill="#f472b6" opacity="0.7" />
      <circle cx="3" cy="54" r="2" fill="#a78bfa" opacity="0.7" />
    </svg>
  );
}

function FloatingPaths({ position }) {
  const paths = Array.from({ length: 28 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${152 - i * 5 * position} ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    opacity: 0.04 + i * 0.018,
    width: 0.4 + i * 0.03,
  }));

  return (
    <svg style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} viewBox="0 0 696 316" fill="none" preserveAspectRatio="xMidYMid slice">
      {paths.map((path) => (
        <motion.path
          key={path.id}
          d={path.d}
          stroke={`rgba(165,180,252,1)`}
          strokeWidth={path.width}
          strokeOpacity={path.opacity}
          initial={{ pathLength: 0.3, opacity: 0.5 }}
          animate={{ pathLength: 1, opacity: [0.3, 0.6, 0.3], pathOffset: [0, 1, 0] }}
          transition={{ duration: 18 + (path.id % 8) * 2, repeat: Infinity, ease: 'linear' }}
        />
      ))}
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
      style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.25)', borderTopColor: '#fff', borderRadius: '50%' }}
    />
  );
}
