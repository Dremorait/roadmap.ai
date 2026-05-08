import { motion, AnimatePresence } from 'framer-motion';
import { AppProvider, useApp } from './context/AppContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SpecBuilderPage from './pages/SpecBuilderPage';
import RoadmapPage from './pages/RoadmapPage';
import Sidebar from './components/Sidebar';

const PAGE_VARIANTS = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

function ApiErrorToast() {
  const { apiError } = useApp();
  return (
    <AnimatePresence>
      {apiError && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(255,68,68,0.12)',
            border: '1px solid rgba(255,68,68,0.35)',
            borderRadius: 12,
            padding: '0.65rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            zIndex: 9999,
            backdropFilter: 'blur(12px)',
            maxWidth: 520,
          }}
        >
          <span style={{ fontSize: '1rem' }}>⚠️</span>
          <span style={{ fontSize: '0.78rem', color: 'rgba(255,180,180,0.9)', fontFamily: 'Inter, sans-serif', lineHeight: 1.4 }}>
            {apiError}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AppShell() {
  const { view } = useApp();

  if (view === 'login') {
    return <LoginPage />;
  }

  const pages = {
    dashboard: <DashboardPage />,
    spec: <SpecBuilderPage />,
    roadmap: <RoadmapPage />,
  };

  return (
    <div className="grid-bg" style={{ display: 'flex', minHeight: '100vh', position: 'relative' }}>
      <div className="noise-overlay" />

      {/* Ambient orbs */}
      <div style={{ position: 'fixed', top: '10%', right: '5%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,212,255,0.04) 0%, transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '15%', left: '20%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(157,0,255,0.05) 0%, transparent 70%)', filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0 }} />

      <Sidebar />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 1 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            variants={PAGE_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            {pages[view]}
          </motion.div>
        </AnimatePresence>
      </main>

      <ApiErrorToast />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
