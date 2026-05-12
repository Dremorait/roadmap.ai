// server/db.js
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('❌ Unexpected DB pool error:', err.message);
});

export async function query(text, params) {
  const start = Date.now();
  const res   = await pool.query(text, params);
  const dur   = Date.now() - start;
  if (dur > 500) console.warn(`⚠️ Slow query (${dur}ms):`, text.slice(0, 60));
  return res;
}
