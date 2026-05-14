
import { pool } from '../server/db.js';
import { triageMessage } from '../server/triage.js';
import { assignCluster } from '../server/clustering.js';

async function run() {
  try {
    const { rows } = await pool.query('SELECT * FROM feedback');
    console.log(`Re-processing ${rows.length} emails...`);

    for (const row of rows) {
      try {
        console.log(`Processing ${row.id}...`);
        
        // Map DB columns to camelCase for the JS functions
        const feedback = {
          id: row.id,
          source: row.source,
          senderId: row.sender_id,
          senderName: row.sender_name,
          rawText: row.raw_text,
          timestamp: row.timestamp,
          metadata: row.metadata
        };

        const analysis = await triageMessage(feedback);
        await pool.query(
          'UPDATE feedback SET triage = $1, confidence = $2 WHERE id = $3',
          [analysis.classification, analysis.confidence, row.id]
        );
        
        await assignCluster(feedback);
        console.log(`✅ Success: ${row.id} -> ${analysis.classification}`);
      } catch (e) {
        console.warn(`❌ Failed ${row.id}: ${e.message}`);
      }
    }
    console.log('✅ All done!');
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
