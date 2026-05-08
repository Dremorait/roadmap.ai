import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { SAMPLE_FEEDBACK, CLUSTER_THEMES, MOCK_ROADMAP_ITEMS } from '../data/mockData';

const AppContext = createContext(null);

// ── NVIDIA NIM config ────────────────────────────────────────────
const NVIDIA_API_KEY  = import.meta.env.VITE_NVIDIA_API_KEY  ?? '';
const NVIDIA_BASE_URL = '/api/nvidia'; // Proxy path (handled by vite.config.js locally and vercel.json in prod)
const MODEL           = 'meta/llama-3.3-70b-instruct';

async function nvidiaChat(messages, { maxTokens = 2048, temperature = 0.7 } = {}) {
  const res = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${NVIDIA_API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens, temperature, stream: false }),
  });
  if (!res.ok) { const e = await res.text(); throw new Error(`NVIDIA API ${res.status}: ${e}`); }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

function deriveScores(feedbackItems) {
  const tags         = [...new Set(feedbackItems.flatMap(f => f.tags))];
  const sources      = [...new Set(feedbackItems.map(f => f.source))];
  const negCount     = feedbackItems.filter(f => f.sentiment < 0.35).length;
  const totalVotes   = feedbackItems.reduce((s, f) => s + f.votes, 0);
  const avgSentiment = (feedbackItems.reduce((s, f) => s + f.sentiment, 0) / feedbackItems.length).toFixed(2);
  const impactScore  = Math.min(10, Math.round(4 + (negCount / feedbackItems.length) * 3 + (totalVotes / 30)));
  const complexity   = tags.some(t => ['api','sso','auth','enterprise'].includes(t)) ? 'High'
                     : tags.some(t => ['performance','pagination','mobile'].includes(t)) ? 'Medium' : 'Low';
  const effortLabel  = complexity === 'High' ? 'L' : complexity === 'Medium' ? 'M' : 'S';
  const priorityFlag = impactScore >= 8 ? '🔴 CRITICAL — Ship in current sprint'
                     : impactScore >= 6 ? '🟠 HIGH — Ship in next sprint'
                     : '🟡 MEDIUM — Backlog for Q-plan';
  return { tags, sources, negCount, totalVotes, avgSentiment, impactScore, complexity, effortLabel, priorityFlag };
}

// ── Supabase helpers ─────────────────────────────────────────────
const hasSupabase = () =>
  !!import.meta.env.VITE_SUPABASE_URL &&
  !!import.meta.env.VITE_SUPABASE_ANON_KEY &&
  import.meta.env.VITE_SUPABASE_ANON_KEY !== 'PASTE_YOUR_ANON_KEY_HERE';

export function AppProvider({ children }) {
  const [view, setView]                         = useState('login');
  const [user, setUser]                         = useState(null);
  const [authLoading, setAuthLoading]           = useState(true);
  const [feedback, setFeedback]                 = useState([]);
  const [clusters, setClusters]                 = useState([]);
  const [selectedFeedback, setSelectedFeedback] = useState([]);
  const [activePRD, setActivePRD]               = useState(null);
  const [roadmapItems, setRoadmapItems]         = useState(MOCK_ROADMAP_ITEMS);
  const [isSynthesizing, setIsSynthesizing]     = useState(false);
  const [isGeneratingPRD, setIsGeneratingPRD]   = useState(false);
  const [prdText, setPrdText]                   = useState('');
  const [typewriterDone, setTypewriterDone]     = useState(false);
  const [apiError, setApiError]                 = useState(null);

  // ── Auth: listen for session changes ──────────────────────────
  useEffect(() => {
    if (!hasSupabase()) { setAuthLoading(false); return; }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        setView('dashboard');
        loadUserData(session.user.id);
      }
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        setView('dashboard');
        loadUserData(session.user.id);
      } else {
        setUser(null);
        setView('login');
        clearLocalState();
      }
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load all user data from Supabase ──────────────────────────
  const loadUserData = async (userId) => {
    try {
      const [fbRes, clRes, rmRes] = await Promise.all([
        supabase.from('feedback').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('clusters').select('*').eq('user_id', userId),
        supabase.from('roadmap_items').select('*').eq('user_id', userId).order('created_at'),
      ]);

      if (fbRes.data?.length)  setFeedback(fbRes.data.map(dbToFeedback));
      if (clRes.data?.length)  setClusters(clRes.data.map(dbToCluster));
      if (rmRes.data?.length)  setRoadmapItems(rmRes.data.map(dbToRoadmap));
      else                     setRoadmapItems(MOCK_ROADMAP_ITEMS);
    } catch (err) {
      console.error('loadUserData error:', err);
    }
  };

  // ── DB ↔ State shape converters ───────────────────────────────
  const dbToFeedback = r => ({
    id: r.id, source: r.source, author: r.author, avatar: r.avatar,
    text: r.text, sentiment: Number(r.sentiment),
    sentimentLabel: r.sentiment_label, tags: r.tags ?? [],
    votes: r.votes, clusterId: r.cluster_id, timestamp: r.timestamp_label,
  });
  const dbToCluster = r => ({
    id: r.id, name: r.name, color: r.color, icon: r.icon,
    feedbackIds: r.feedback_ids ?? [],
  });
  const dbToRoadmap = r => ({
    id: r.id, title: r.title, priority: r.priority, effort: r.effort,
    impact: r.impact, status: r.status, prdId: r.prd_id,
  });

  // ── Clear local state on logout ───────────────────────────────
  const clearLocalState = () => {
    setFeedback([]); setClusters([]); setSelectedFeedback([]);
    setActivePRD(null); setPrdText(''); setApiError(null);
    setRoadmapItems(MOCK_ROADMAP_ITEMS);
  };

  // ── Auth actions ──────────────────────────────────────────────
  const login = useCallback(async ({ email, password }) => {
    if (!hasSupabase()) {
      // Offline demo mode
      setUser({ id: 'demo', email, user_metadata: { full_name: 'Demo User' } });
      setView('dashboard');
      return { error: null };
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };
    setUser(data.user);
    setView('dashboard');
    return { error: null };
  }, []);

  const signUp = useCallback(async ({ email, password, fullName }) => {
    if (!hasSupabase()) return { error: new Error('Supabase not configured') };
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName } },
    });
    if (error) return { error };
    return { data, error: null };
  }, []);

  const logout = useCallback(async () => {
    if (hasSupabase()) await supabase.auth.signOut();
    clearLocalState();
    setUser(null);
    setView('login');
  }, []);

  // ── Load sample data ──────────────────────────────────────────
  const loadSampleData = useCallback(async () => {
    const items = SAMPLE_FEEDBACK.map(f => ({ ...f }));
    setFeedback(items);
    setClusters([]);
    setSelectedFeedback([]);
    setApiError(null);

    // Persist to Supabase if logged in
    if (hasSupabase() && user) {
      const rows = items.map(f => ({
        id: f.id, user_id: user.id, source: f.source,
        author: f.author, avatar: f.avatar, text: f.text,
        sentiment: f.sentiment, sentiment_label: f.sentimentLabel,
        tags: f.tags, votes: f.votes, cluster_id: null,
        timestamp_label: f.timestamp,
      }));
      // Upsert so re-loading doesn't duplicate
      await supabase.from('feedback').upsert(rows, { onConflict: 'id' });
    }
  }, [user]);

  const toggleFeedbackSelection = useCallback((id) => {
    setSelectedFeedback(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  // ── AI: Cluster Synthesis ────────────────────────────────────
  const synthesizeClusters = useCallback(async () => {
    setIsSynthesizing(true);
    setApiError(null);

    try {
      let aiClusters;

      if (NVIDIA_API_KEY) {
        const feedbackSummary = feedback
          .map(f => `[${f.id}] (${f.source}) "${f.text.slice(0, 120)}" — tags: ${f.tags.join(', ')} — sentiment: ${f.sentiment}`)
          .join('\n');

        const content = await nvidiaChat([
          { role: 'system', content: `You are a senior product analyst. Cluster the user feedback into 3–5 thematic groups. Return ONLY a valid JSON array (no markdown, no explanation):
[{ "id": "c-001", "name": "Short Name", "color": "#hexcolor", "icon": "emoji", "feedbackIds": ["fb-001"] }]` },
          { role: 'user', content: `Cluster this feedback:\n${feedbackSummary}` },
        ], { maxTokens: 512, temperature: 0.3 });

        const jsonStr = content.replace(/```json|```/g, '').trim();
        aiClusters = JSON.parse(jsonStr);
      } else {
        await new Promise(r => setTimeout(r, 2200));
        aiClusters = CLUSTER_THEMES;
      }

      setClusters(aiClusters);
      const updatedFeedback = feedback.map(f => {
        const cluster = aiClusters.find(c => c.feedbackIds.includes(f.id));
        return cluster ? { ...f, clusterId: cluster.id } : f;
      });
      setFeedback(updatedFeedback);

      // Persist clusters + updated feedback to Supabase
      if (hasSupabase() && user) {
        await supabase.from('clusters').upsert(
          aiClusters.map(c => ({ id: c.id, user_id: user.id, name: c.name, color: c.color, icon: c.icon, feedback_ids: c.feedbackIds })),
          { onConflict: 'id' }
        );
        for (const f of updatedFeedback) {
          if (f.clusterId) {
            await supabase.from('feedback').update({ cluster_id: f.clusterId }).eq('id', f.id).eq('user_id', user.id);
          }
        }
      }
    } catch (err) {
      console.error('Cluster error:', err);
      setApiError(`Cluster AI failed — using fallback. (${err.message})`);
      setClusters(CLUSTER_THEMES);
      setFeedback(prev => prev.map(f => {
        const cluster = CLUSTER_THEMES.find(c => c.feedbackIds.includes(f.id));
        return cluster ? { ...f, clusterId: cluster.id } : f;
      }));
    } finally {
      setIsSynthesizing(false);
    }
  }, [feedback, user]);

  // ── AI: PRD Generation ────────────────────────────────────────
  const generatePRD = useCallback(async (feedbackItems) => {
    setIsGeneratingPRD(true);
    setPrdText('');
    setTypewriterDone(false);
    setView('spec');
    setApiError(null);

    const scores = deriveScores(feedbackItems);

    try {
      let prd;

      if (NVIDIA_API_KEY) {
        const feedbackBlock = feedbackItems
          .map(f => `- [${f.source.toUpperCase()}] "${f.text}" | sentiment: ${f.sentiment} | votes: ${f.votes} | tags: ${f.tags.join(', ')}`)
          .join('\n');

        prd = await nvidiaChat([
          { role: 'system', content: `You are an architect-grade product manager. Write a complete PRD in GitHub-flavoured Markdown with EXACTLY these 6 sections:
# Technical Specification — <Feature Title>
## 1. Executive Summary
## 2. User Stories (5 stories)
## 3. Functional Requirements (7+ SHALL statements)
## 4. Technical Constraints & Logic (API contracts, schemas, perf budgets)
## 5. Acceptance Criteria (Gherkin Given/When/Then)
## 6. Impact vs. Effort Matrix (markdown table)
Impact: ${scores.impactScore}/10. Complexity: ${scores.complexity}. Priority: ${scores.priorityFlag}.` },
          { role: 'user', content: `Generate the PRD from this feedback:\n${feedbackBlock}` },
        ], { maxTokens: 2048, temperature: 0.65 });
      } else {
        await new Promise(r => setTimeout(r, 2000));
        const { tags, sources, negCount, totalVotes, avgSentiment, impactScore, complexity, effortLabel, priorityFlag } = scores;
        const pt = tags[0] ?? 'performance', st = tags[1] ?? 'reliability';
        const persona = negCount > feedbackItems.length / 2
          ? 'Power users managing high-volume datasets in a B2B SaaS context'
          : 'Operational team leads requiring workflow automation and data portability';
        prd = `# Technical Specification — ${pt.charAt(0).toUpperCase()+pt.slice(1)} & ${st.charAt(0).toUpperCase()+st.slice(1)} Remediation\n\n---\n\n## 1. Executive Summary\n\n**Problem Statement:** ${negCount} high-signal negative reports (avg. sentiment ${avgSentiment}) totalling **${totalVotes} weighted votes** from **${sources.join(', ')}**.\n\n**User Persona:** ${persona}.\n\n---\n\n## 2. User Stories\n\n- As a **power user**, I want ${pt}-intensive operations without UI blocking.\n- As a **team lead**, I want CSV/XLSX export with column control.\n- As a **mobile operative**, I want crash-free iOS Safari 16+.\n- As an **IT admin**, I want SAML 2.0 / OIDC SSO.\n- As a **backend owner**, I want API endpoints within SLA.\n\n---\n\n## 3. Functional Requirements\n\n- System **shall** implement virtual scrolling for 100+ row tables.\n- System **shall** expose \`POST /api/v2/exports\` with async job queue.\n- System **shall** send email when export exceeds 10,000 rows.\n- System **shall** enforce cursor-based pagination, max 500 rows.\n- System **shall** achieve TTI < 2,000ms (Lighthouse CI).\n- System **shall** implement SAML 2.0 + OIDC auth adapter.\n- System **shall** return structured 4xx errors with \`error_code\`, \`retry_after_ms\`.\n\n---\n\n## 4. Technical Constraints & Logic\n\n- **API:** \`GET /api/v2/records?cursor=&limit=500&sort_by=&filter[]\`\n- **Export Schema:** \`id UUID, status ENUM(queued|processing|done|failed), filter_snapshot JSONB\`\n- **Perf Budget:** LCP ≤ 2.5s, bundle delta < 18KB gzipped.\n- **Rate Limit:** 5 exports/user/hour at API gateway.\n\n---\n\n## 5. Acceptance Criteria\n\n**FR-01**\n- **Given** 1,000+ rows **When** user scrolls **Then** ≤ 30 DOM nodes, ≥ 55fps.\n\n**FR-02**\n- **Given** < 10k rows **When** Export clicked **Then** file downloads within 8s.\n\n**FR-03**\n- **Given** Okta configured **When** SSO login **Then** valid session, no duplicate account.\n\n---\n\n## 6. Impact vs. Effort Matrix\n\n| Dimension | Score | Notes |\n|---|---|---|\n| **Impact Score** | **${impactScore}/10** | ${negCount} negative signals, ${totalVotes} votes |\n| **Complexity** | **${complexity}** | Cross-cutting changes |\n| **Effort** | **${effortLabel}** | Sprint estimate |\n| **Priority** | **${priorityFlag}** | — |\n`;
      }

      const prdId = `prd-${Date.now()}`;
      const prdRecord = { id: prdId, text: prd, feedbackIds: feedbackItems.map(f => f.id), createdAt: new Date() };
      setActivePRD(prdRecord);
      setPrdText(prd);

      // Persist PRD to Supabase
      if (hasSupabase() && user) {
        await supabase.from('prds').insert({
          id: prdId, user_id: user.id, text: prd,
          feedback_ids: feedbackItems.map(f => f.id),
        });
      }
    } catch (err) {
      console.error('PRD error:', err);
      setApiError(`PRD generation failed. (${err.message})`);
    } finally {
      setIsGeneratingPRD(false);
      setTypewriterDone(true);
    }
  }, [user]);

  // ── Roadmap ───────────────────────────────────────────────────
  const addToRoadmap = useCallback(async (item) => {
    setRoadmapItems(prev => {
      if (prev.find(r => r.id === item.id)) return prev;
      return [...prev, item];
    });
    setView('roadmap');

    if (hasSupabase() && user) {
      await supabase.from('roadmap_items').upsert({
        id: item.id, user_id: user.id, title: item.title,
        priority: item.priority, effort: item.effort,
        impact: item.impact, status: item.status, prd_id: item.prdId ?? null,
      }, { onConflict: 'id' });
    }
  }, [user]);

  const moveRoadmapItem = useCallback(async (itemId, newStatus) => {
    setRoadmapItems(prev =>
      prev.map(r => r.id === itemId ? { ...r, status: newStatus } : r)
    );
    if (hasSupabase() && user) {
      await supabase.from('roadmap_items').update({ status: newStatus }).eq('id', itemId).eq('user_id', user.id);
    }
  }, [user]);

  // ── Manual feedback input ─────────────────────────────────────
  const addFeedback = useCallback(async (item) => {
    setFeedback(prev => [item, ...prev]);
    if (hasSupabase() && user) {
      await supabase.from('feedback').insert({
        id: item.id, user_id: user.id, source: item.source,
        author: item.author, avatar: item.avatar, text: item.text,
        sentiment: item.sentiment, sentiment_label: item.sentimentLabel,
        tags: item.tags, votes: item.votes,
        timestamp_label: item.timestamp, cluster_id: null,
      });
    }
  }, [user]);

  return (
    <AppContext.Provider value={{
      view, setView,
      user, login, signUp, logout, authLoading,
      feedback, loadSampleData, addFeedback,
      clusters,
      selectedFeedback, toggleFeedbackSelection, setSelectedFeedback,
      activePRD, prdText,
      roadmapItems, addToRoadmap, moveRoadmapItem,
      isSynthesizing, synthesizeClusters,
      isGeneratingPRD, generatePRD,
      typewriterDone,
      apiError,
      hasSupabase: hasSupabase(),
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
