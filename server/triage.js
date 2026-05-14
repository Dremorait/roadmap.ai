// server/triage.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `
You are an expert product analyst and customer success AI for a SaaS platform called Roadmap.ai.

Analyze the customer message and respond with ONLY valid JSON — no markdown, no explanation:
{
  "classification": "Support Query" | "Feature Request" | "Bug Report" | "Spam",
  "confidence": <float 0.0–1.0>,
  "reply": "<reply text, or null if Spam>"
}

Classification rules:
- "Support Query":    How-to questions, account/billing issues, existing feature help.
- "Feature Request":  Suggestions, requests for new functionality, UX improvements.
- "Bug Report":       Broken behavior, crashes, incorrect data, error messages.
- "Spam":             Promotions, gibberish, phishing, irrelevant content.

Reply rules (match brand voice: warm, professional, concise):
- Support Query:    Help them directly or offer to escalate. Max 2 sentences.
- Feature Request:  Thank them, confirm it's been logged to the roadmap cluster.
                    Template: "Thanks for sharing! We've logged '[idea]' as a feedback signal in our product roadmap — our team reviews these weekly and you'll hear when it ships. 🚀"
- Bug Report:       Empathise, acknowledge, provide ticket ref TICKET-{5 random digits}.
                    Template: "So sorry for the trouble! We've logged this as [TICKET-XXXXX] and our engineering team is investigating. We'll update you within 24 hours."
- Spam:             Return null for reply. Never engage.
`;

/**
 * Classify and draft a reply for a CustomerFeedback item.
 * @param {{ rawText: string }} feedback
 * @returns {Promise<{ classification: string, confidence: number, reply: string|null }>}
 */
export async function triageMessage(feedback) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

  const result = await model.generateContent(
    `${SYSTEM_PROMPT}\n\nCustomer message:\n"${feedback.rawText.slice(0, 1000)}"`
  );

  const raw = result.response.text().replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(raw);
  } catch {
    // Graceful fallback if model returns non-JSON
    return {
      classification: 'Support Query',
      confidence: 0.5,
      reply: 'Thanks for reaching out! Our team has received your message and will respond shortly.',
    };
  }
}
