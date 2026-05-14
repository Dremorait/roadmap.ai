// server/triage.js — Pillar 1+2: gemini-2.0-flash, structured JSON, richer fields
import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    classification: {
      type: 'STRING',
      enum: ['Support Query', 'Feature Request', 'Bug Report', 'Spam'],
    },
    confidence:   { type: 'NUMBER' },
    urgency:      { type: 'NUMBER' },        // 1–10
    product_area: {
      type: 'STRING',
      enum: ['Authentication', 'Billing', 'Performance', 'UI/UX', 'API', 'Notifications', 'Data', 'Integrations', 'Other'],
    },
    key_phrase:     { type: 'STRING' },      // ≤ 6 words capturing the core issue
    sentiment_score:{ type: 'NUMBER' },      // 0.0 (very negative) → 1.0 (very positive)
    reply:          { type: 'STRING' },      // AI-drafted reply, or empty string for Spam
  },
  required: ['classification', 'confidence', 'urgency', 'product_area', 'key_phrase', 'sentiment_score', 'reply'],
};

const SYSTEM_PROMPT = `You are an expert product analyst and customer success AI for a SaaS platform called Roadmap.ai.

Analyze the customer message and return structured JSON.

Classification rules:
- "Support Query":    How-to questions, account/billing issues, existing feature help.
- "Feature Request":  Suggestions, requests for new functionality, UX improvements.
- "Bug Report":       Broken behavior, crashes, incorrect data, error messages.
- "Spam":             Promotions, gibberish, phishing, irrelevant content (newsletters, payment receipts, OTPs).

Reply rules (match brand voice: warm, professional, concise):
- Support Query:    Help them directly or offer to escalate. Max 2 sentences.
- Feature Request:  Thank them, confirm it's been logged. Template: "Thanks for sharing! We've logged '[idea]' to our product roadmap — our team reviews these weekly. 🚀"
- Bug Report:       Empathise, acknowledge, provide ref TICKET-{5 random digits}. Template: "Sorry for the trouble! We've logged this as [TICKET-XXXXX] and our engineering team is investigating. We'll update you within 24 hours."
- Spam:             Return empty string "".

Urgency rules (1–10):
- 10: System down, data loss, security breach
- 7–9: Core feature broken, blocks user workflow
- 4–6: Minor bug, UX friction, feature request
- 1–3: Informational, spam, low-priority

Sentiment score: 0.0 = extremely negative/angry, 0.5 = neutral, 1.0 = very positive/happy.`;

/**
 * Classify and draft a reply for a CustomerFeedback item.
 * @param {{ rawText: string, subject?: string }} feedback
 * @returns {Promise<{ classification, confidence, urgency, product_area, key_phrase, sentiment_score, reply }>}
 */
export async function triageMessage(feedback) {
  const text = feedback.rawText ?? feedback.raw_text ?? '';
  if (!text || text.trim().length < 5) {
    return {
      classification: 'Spam', confidence: 0.95, urgency: 1,
      product_area: 'Other', key_phrase: 'empty message',
      sentiment_score: 0.5, reply: '',
    };
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: SCHEMA,
        temperature: 0.1,
        maxOutputTokens: 512,
      },
    });

    const prompt = `${SYSTEM_PROMPT}\n\nCustomer message:\n"${text.slice(0, 1200)}"`;
    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text());

    return {
      classification:  parsed.classification  ?? 'Support Query',
      confidence:      Number(parsed.confidence ?? 0.75),
      urgency:         Number(parsed.urgency    ?? 5),
      product_area:    parsed.product_area      ?? 'Other',
      key_phrase:      parsed.key_phrase        ?? '',
      sentiment_score: Number(parsed.sentiment_score ?? 0.5),
      reply:           parsed.reply             ?? '',
    };
  } catch (err) {
    console.error('⚠️ Triage error (using fallback):', err.message);
    // Graceful fallback — never crash the pipeline
    return {
      classification: 'Support Query', confidence: 0.5, urgency: 5,
      product_area: 'Other', key_phrase: text.slice(0, 40),
      sentiment_score: 0.5,
      reply: 'Thanks for reaching out! Our team has received your message and will respond shortly.',
    };
  }
}
