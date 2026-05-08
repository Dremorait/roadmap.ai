import { createContext, useContext, useState, useCallback } from 'react';
import { SAMPLE_FEEDBACK, CLUSTER_THEMES, MOCK_ROADMAP_ITEMS } from '../data/mockData';

const AppContext = createContext(null);

// ── NVIDIA NIM config ────────────────────────────────────────────
const NVIDIA_API_KEY  = import.meta.env.VITE_NVIDIA_API_KEY  ?? '';
const NVIDIA_BASE_URL = import.meta.env.VITE_NVIDIA_BASE_URL ?? 'https://integrate.api.nvidia.com/v1';
const MODEL           = 'meta/llama-3.3-70b-instruct';

/**
 * Call NVIDIA NIM chat/completions.
 * Returns the assistant message text, or throws on network / API error.
 */
async function nvidiaChat(messages, { maxTokens = 2048, temperature = 0.7 } = {}) {
  const res = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${NVIDIA_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: false,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NVIDIA API ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// ── Local score helpers (kept for roadmap card population) ────────
function deriveScores(feedbackItems) {
  const tags        = [...new Set(feedbackItems.flatMap(f => f.tags))];
  const sources     = [...new Set(feedbackItems.map(f => f.source))];
  const negCount    = feedbackItems.filter(f => f.sentiment < 0.35).length;
  const totalVotes  = feedbackItems.reduce((s, f) => s + f.votes, 0);
  const avgSentiment= (feedbackItems.reduce((s, f) => s + f.sentiment, 0) / feedbackItems.length).toFixed(2);
  const impactScore = Math.min(10, Math.round(4 + (negCount / feedbackItems.length) * 3 + (totalVotes / 30)));
  const complexity  = tags.some(t => ['api','sso','auth','enterprise'].includes(t)) ? 'High'
                    : tags.some(t => ['performance','pagination','mobile'].includes(t)) ? 'Medium' : 'Low';
  const effortLabel = complexity === 'High' ? 'L' : complexity === 'Medium' ? 'M' : 'S';
  const priorityFlag= impactScore >= 8 ? '🔴 CRITICAL — Ship in current sprint'
                    : impactScore >= 6 ? '🟠 HIGH — Ship in next sprint'
                    : '🟡 MEDIUM — Backlog for Q-plan';
  return { tags, sources, negCount, totalVotes, avgSentiment, impactScore, complexity, effortLabel, priorityFlag };
}

export function AppProvider({ children }) {
  const [view, setView]                       = useState('login');
  const [user, setUser]                       = useState(null);
  const [feedback, setFeedback]               = useState([]);
  const [clusters, setClusters]               = useState([]);
  const [selectedFeedback, setSelectedFeedback] = useState([]);
  const [activePRD, setActivePRD]             = useState(null);
  const [roadmapItems, setRoadmapItems]       = useState(MOCK_ROADMAP_ITEMS);
  const [isSynthesizing, setIsSynthesizing]   = useState(false);
  const [isGeneratingPRD, setIsGeneratingPRD] = useState(false);
  const [prdText, setPrdText]                 = useState('');
  const [typewriterDone, setTypewriterDone]   = useState(false);
  const [apiError, setApiError]               = useState(null);

  // ── Load sample data ───────────────────────────────────────────
  const loadSampleData = useCallback(() => {
    setFeedback(SAMPLE_FEEDBACK.map(f => ({ ...f })));
    setClusters([]);
    setSelectedFeedback([]);
    setApiError(null);
  }, []);

  const toggleFeedbackSelection = useCallback((id) => {
    setSelectedFeedback(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  // ── AI: Cluster Synthesis ──────────────────────────────────────
  const synthesizeClusters = useCallback(async () => {
    setIsSynthesizing(true);
    setApiError(null);

    try {
      if (NVIDIA_API_KEY) {
        const feedbackSummary = feedback
          .map(f => `[${f.id}] (${f.source}) "${f.text.slice(0, 120)}" — tags: ${f.tags.join(', ')} — sentiment: ${f.sentiment}`)
          .join('\n');

        const systemPrompt = `You are a senior product analyst. Cluster the following user feedback items into 3–5 thematic groups. 
For each cluster return ONLY a valid JSON array (no markdown, no explanation) in this exact shape:
[
  { "id": "c-001", "name": "Short Cluster Name", "color": "#hexcolor", "icon": "emoji", "feedbackIds": ["fb-001", "fb-003"] }
]
Use distinct hex colours per cluster. Use single relevant emoji icons.`;

        const content = await nvidiaChat([
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: `Feedback items to cluster:\n${feedbackSummary}` },
        ], { maxTokens: 512, temperature: 0.3 });

        // Parse JSON — strip any accidental markdown fences
        const jsonStr = content.replace(/```json|```/g, '').trim();
        const aiClusters = JSON.parse(jsonStr);

        setClusters(aiClusters);
        setFeedback(prev => prev.map(f => {
          const cluster = aiClusters.find(c => c.feedbackIds.includes(f.id));
          return cluster ? { ...f, clusterId: cluster.id } : f;
        }));
      } else {
        // Fallback: use mock clusters
        await new Promise(r => setTimeout(r, 2200));
        setClusters(CLUSTER_THEMES);
        setFeedback(prev => prev.map(f => {
          const cluster = CLUSTER_THEMES.find(c => c.feedbackIds.includes(f.id));
          return cluster ? { ...f, clusterId: cluster.id } : f;
        }));
      }
    } catch (err) {
      console.error('Cluster synthesis error:', err);
      setApiError(`Cluster AI failed — using fallback clusters. (${err.message})`);
      // Graceful fallback
      setClusters(CLUSTER_THEMES);
      setFeedback(prev => prev.map(f => {
        const cluster = CLUSTER_THEMES.find(c => c.feedbackIds.includes(f.id));
        return cluster ? { ...f, clusterId: cluster.id } : f;
      }));
    } finally {
      setIsSynthesizing(false);
    }
  }, [feedback]);

  // ── AI: PRD Generation ─────────────────────────────────────────
  const generatePRD = useCallback(async (feedbackItems) => {
    setIsGeneratingPRD(true);
    setPrdText('');
    setTypewriterDone(false);
    setView('spec');
    setApiError(null);

    const scores = deriveScores(feedbackItems);

    try {
      if (NVIDIA_API_KEY) {
        const feedbackBlock = feedbackItems
          .map(f => `- [${f.source.toUpperCase()}] "${f.text}" | sentiment: ${f.sentiment} | votes: ${f.votes} | tags: ${f.tags.join(', ')}`)
          .join('\n');

        const systemPrompt = `You are an architect-grade product manager writing a Technical Specification document.
Write a complete, professional PRD in GitHub-flavoured Markdown with EXACTLY these 6 sections:

# Technical Specification — <Feature Title>

---

## 1. Executive Summary
(problem statement, user persona, key metrics)

## 2. User Stories
(5 user stories in "As a… I want… so that…" format)

## 3. Functional Requirements
(7+ SHALL statements with concrete technical details)

## 4. Technical Constraints & Logic
(API contracts, DB schemas, state management, performance budgets)

## 5. Acceptance Criteria
(Gherkin Given/When/Then for each major requirement)

## 6. Impact vs. Effort Matrix
(A markdown table with: Impact Score, Complexity, Effort Estimate, Risk Level, Composite Priority)

Be specific, use real technical terms. Impact score: ${scores.impactScore}/10. Complexity: ${scores.complexity}. Priority: ${scores.priorityFlag}.`;

        const prd = await nvidiaChat([
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: `Generate the PRD based on this user feedback:\n${feedbackBlock}` },
        ], { maxTokens: 2048, temperature: 0.65 });

        const prdId = `prd-${Date.now()}`;
        setActivePRD({ id: prdId, text: prd, feedbackIds: feedbackItems.map(f => f.id), createdAt: new Date() });
        setPrdText(prd);
      } else {
        // Fallback: template-based PRD (original logic)
        await new Promise(r => setTimeout(r, 2000));
        const { tags, sources, negCount, totalVotes, avgSentiment, impactScore, complexity, effortLabel, priorityFlag } = scores;
        const primaryTag   = tags[0] ?? 'performance';
        const secondaryTag = tags[1] ?? 'reliability';
        const persona      = negCount > feedbackItems.length / 2
          ? 'Power users managing high-volume datasets in a B2B SaaS context'
          : 'Operational team leads requiring workflow automation and data portability';

        const prd = `# Technical Specification — ${primaryTag.charAt(0).toUpperCase() + primaryTag.slice(1)} & ${secondaryTag.charAt(0).toUpperCase() + secondaryTag.slice(1)} Remediation

---

## 1. Executive Summary

**Problem Statement:** The product exhibits measurable degradation across **${tags.slice(0,3).join(', ')}** workflows, evidenced by ${negCount} high-signal negative reports (avg. sentiment ${avgSentiment}) totalling **${totalVotes} weighted votes** from **${sources.join(', ')}** channels.

**User Persona:** ${persona}.

---

## 2. User Stories

- As a **power user**, I want the system to handle **${primaryTag}**-intensive operations without UI blocking.
- As a **team lead**, I want to export filtered record sets to \`CSV\` and \`XLSX\` with column-level control.
- As a **mobile field operative**, I want the application to render without crash on iOS Safari 16+.
- As an **IT administrator**, I want SAML 2.0 / OIDC-compliant SSO via Okta or Azure AD.
- As a **backend integration owner**, I want all API endpoints to respond within SLA thresholds.

---

## 3. Functional Requirements

- The system **shall** implement client-side virtual scrolling for all table views exceeding **100 rows**.
- The system **shall** expose a \`POST /api/v2/exports\` endpoint returning a \`jobId\` with polling support.
- The system **shall** deliver export completion notification via email when row count exceeds **10,000 records**.
- The system **shall** limit synchronous responses to a maximum page size of **500 rows**.
- The system **shall** reduce initial dashboard TTI to **< 2,000ms** on a 4G baseline.
- The system **shall** implement SAML 2.0 and OIDC flows via a pluggable auth adapter.
- The system **shall** surface structured \`4xx\` errors with \`error_code\`, \`message\`, and \`retry_after_ms\`.

---

## 4. Technical Constraints & Logic

- **API Contract:** \`GET /api/v2/records\` must support \`cursor\`, \`limit\` (max: 500), \`sort_by\`, and \`filter[]\`.
- **Export Job Schema:** \`id UUID\`, \`status ENUM(queued|processing|done|failed)\`, \`filter_snapshot JSONB\`.
- **Performance Budget:** LCP must not regress beyond **2.5s**. Bundle delta **< 18KB gzipped**.
- **Rate Limiting:** Export endpoint rate-limited to **5 requests/user/hour** at the API gateway layer.

---

## 5. Acceptance Criteria

**FR-01 — Virtual Scrolling**
- **Given** a table with 1,000+ records **When** user scrolls **Then** DOM contains ≤ 30 rendered nodes.

**FR-02 — Async Export**
- **Given** filters resulting in < 10,000 rows **When** user clicks Export **Then** file downloads within 8 seconds.

**FR-03 — SSO Login**
- **Given** Okta is configured **When** user clicks SSO **Then** they authenticate and return with a valid session.

---

## 6. Impact vs. Effort Matrix

| Dimension | Score | Notes |
|---|---|---|
| **Impact Score** | **${impactScore} / 10** | ${negCount} negative signals, ${totalVotes} weighted votes |
| **Complexity** | **${complexity}** | Cross-cutting changes required |
| **Effort Estimate** | **${effortLabel}** | Sprint estimate |
| **Composite Priority** | **${priorityFlag}** | — |
`;
        const prdId = `prd-${Date.now()}`;
        setActivePRD({ id: prdId, text: prd, feedbackIds: feedbackItems.map(f => f.id), createdAt: new Date() });
        setPrdText(prd);
      }
    } catch (err) {
      console.error('PRD generation error:', err);
      setApiError(`AI generation failed — check console for details. (${err.message})`);
    } finally {
      setIsGeneratingPRD(false);
      setTypewriterDone(true);
    }
  }, []);

  // ── Roadmap actions ────────────────────────────────────────────
  const addToRoadmap = useCallback((item) => {
    setRoadmapItems(prev => {
      if (prev.find(r => r.id === item.id)) return prev;
      return [...prev, item];
    });
    setView('roadmap');
  }, []);

  const moveRoadmapItem = useCallback((itemId, newStatus) => {
    setRoadmapItems(prev =>
      prev.map(r => r.id === itemId ? { ...r, status: newStatus } : r)
    );
  }, []);

  // ── Auth ───────────────────────────────────────────────────────
  const login = useCallback((userData) => {
    setUser(userData);
    setView('dashboard');
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setView('login');
    setFeedback([]);
    setClusters([]);
    setSelectedFeedback([]);
    setActivePRD(null);
    setPrdText('');
    setApiError(null);
  }, []);

  return (
    <AppContext.Provider value={{
      view, setView,
      user, login, logout,
      feedback, loadSampleData,
      clusters,
      selectedFeedback, toggleFeedbackSelection, setSelectedFeedback,
      activePRD, prdText,
      roadmapItems, addToRoadmap, moveRoadmapItem,
      isSynthesizing, synthesizeClusters,
      isGeneratingPRD, generatePRD,
      typewriterDone,
      apiError,
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
