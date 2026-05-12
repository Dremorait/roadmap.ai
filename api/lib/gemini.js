// api/lib/gemini.js  — Gemini AI utilities for API routes
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── Triage: classify message + draft reply ───────────────────────────
export async function triageMessage(text) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const prompt = `
You are a customer success AI for a SaaS platform called Roadmap.ai.
Analyze this customer message and respond with ONLY valid JSON (no markdown):
{
  "classification": "Support Query" | "Feature Request" | "Bug Report" | "Spam",
  "confidence": <float 0.0-1.0>,
  "reply": "<reply text or null for Spam>"
}

Rules:
- Support Query: how-to, account, billing questions
- Feature Request: new feature suggestions, UX improvements
- Bug Report: crashes, broken features, errors
- Spam: promotional, gibberish, irrelevant

Reply style: warm, professional, concise (2 sentences max).
For Feature Requests: "Thanks! We've logged this to our roadmap cluster and will update you when it ships 🚀"
For Bug Reports: include ticket ref TICKET-${Math.floor(10000 + Math.random() * 90000)}
For Spam: return null

Customer message: "${text.slice(0, 800)}"`;

  const result = await model.generateContent(prompt);
  const raw = result.response.text().replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(raw);
  } catch {
    return { classification: 'Support Query', confidence: 0.5,
             reply: 'Thanks for reaching out! Our team will respond shortly.' };
  }
}

// ── Embedding: convert text to 768-dim vector ────────────────────────
export async function getEmbedding(text) {
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  const result = await model.embedContent(text.slice(0, 2048));
  return result.embedding.values; // float[] of 768 dims
}

// ── Generate a short cluster title from seed text ───────────────────
export async function generateClusterTitle(seedText) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(
      `In 4-6 words, give a product-manager cluster title for: "${seedText.slice(0, 200)}". Return ONLY the title.`
    );
    return result.response.text().trim().slice(0, 80);
  } catch {
    return seedText.slice(0, 50) + '…';
  }
}

// ── Cosine distance between two vectors ─────────────────────────────
export function cosineDistance(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  return 1 - dot / (Math.sqrt(na) * Math.sqrt(nb));
}
