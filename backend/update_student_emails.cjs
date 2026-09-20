const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_UBD6HgbY2XMe@ep-bitter-glitter-azqe7m88-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('Connecting to Neon PostgreSQL database...');
    
    // Update all student email addresses to <ENROLLMENT_NUMBER>@mail.ljku.edu.in
    const res = await client.query(`
      UPDATE students
      SET email = LOWER(enrollment_number) || '@mail.ljku.edu.in',
          updated_at = NOW()
      RETURNING enrollment_number, email;
    `);

    console.log(`✅ Successfully updated emails for ${res.rowCount} students!`);
    if (res.rows.length > 0) {
      console.log('Sample updated records:');
      console.log(res.rows.slice(0, 5));
    }
  } catch (err) {
    console.error('❌ Failed to update student emails:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
