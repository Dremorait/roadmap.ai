// server/insightEngine.js
import { query } from './db.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Generate a daily executive summary of all feedback.
 * Intended to be run once a day or on-demand.
 */
export async function generateDailySummary() {
  try {
    // 1. Get stats for today
    const { rows: stats } = await query(`
      SELECT 
        COUNT(*) as total,
        AVG(sentiment_score) as avg_sentiment,
        COUNT(*) FILTER (WHERE triage = 'Bug Report') as bugs,
        COUNT(*) FILTER (WHERE triage = 'Feature Request') as features
      FROM feedback 
      WHERE created_at >= CURRENT_DATE
    `);

    if (stats[0].total === 0) return { message: 'No feedback today' };

    // 2. Get top key phrases
    const { rows: phrases } = await query(`
      SELECT key_phrase, COUNT(*) as count 
      FROM feedback 
      WHERE created_at >= CURRENT_DATE AND key_phrase IS NOT NULL
      GROUP BY key_phrase 
      ORDER BY count DESC 
      LIMIT 10
    `);

    // 3. Use AI to generate a professional summary
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const prompt = `You are a senior product manager. Generate a 3-sentence executive summary for today's customer feedback.
    Stats: ${stats[0].total} total signals, ${stats[0].bugs} bugs, ${stats[0].features} feature requests.
    Top issues: ${phrases.map(p => p.key_phrase).join(', ')}.
    
    Tone: Professional, data-driven, concise.`;

    const result = await model.generateContent(prompt);
    const summaryText = result.response.text();

    // 4. Save to DB
    await query(`
      INSERT INTO daily_summaries (date, summary, top_issues, sentiment_avg, total_feedback)
      VALUES (CURRENT_DATE, $1, $2, $3, $4)
      ON CONFLICT (date) DO UPDATE SET
        summary = EXCLUDED.summary,
        top_issues = EXCLUDED.top_issues,
        sentiment_avg = EXCLUDED.sentiment_avg,
        total_feedback = EXCLUDED.total_feedback
    `, [summaryText, JSON.stringify(phrases), stats[0].avg_sentiment, stats[0].total]);

    return { success: true, summary: summaryText };
  } catch (err) {
    console.error('Insight Engine Error:', err.message);
    throw err;
  }
}

/**
 * Detect topics that spiked in the last 24h compared to the previous 7 days.
 */
export async function detectTrendingTopics() {
  const { rows } = await query(`
    WITH recent AS (
      SELECT key_phrase, COUNT(*) as count 
      FROM feedback 
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY key_phrase
    ),
    historical AS (
      SELECT key_phrase, COUNT(*) / 7.0 as avg_daily_count
      FROM feedback 
      WHERE created_at >= NOW() - INTERVAL '8 days' AND created_at < NOW() - INTERVAL '24 hours'
      GROUP BY key_phrase
    )
    SELECT 
      r.key_phrase, 
      r.count as today_count, 
      COALESCE(h.avg_daily_count, 0) as historical_avg,
      (r.count - COALESCE(h.avg_daily_count, 0)) / NULLIF(COALESCE(h.avg_daily_count, 0), 0) as spike_factor
    FROM recent r
    LEFT JOIN historical h ON r.key_phrase = h.key_phrase
    WHERE r.count >= 2
    ORDER BY spike_factor DESC
    LIMIT 5
  `);
  
  return rows;
}
