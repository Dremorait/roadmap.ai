// server/embeddings.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Convert a text string into a 768-dim float vector using Gemini.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
export async function getEmbedding(text) {
  const model  = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  const result = await model.embedContent(text.slice(0, 2048)); // safety trim
  return result.embedding.values; // float[]  (768 dims)
}

/**
 * Batch embed up to 100 texts in one call — use for bulk ingestion.
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
export async function batchEmbed(texts) {
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  const results = await Promise.all(
    texts.map(t => model.embedContent(t.slice(0, 2048)))
  );
  return results.map(r => r.embedding.values);
}

/**
 * Cosine distance between two float arrays (0 = identical, 2 = opposite).
 */
export function cosineDistance(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  return 1 - dot / (Math.sqrt(na) * Math.sqrt(nb));
}
