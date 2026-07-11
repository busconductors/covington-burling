// Migration script: creates the inbound_emails table for Mailgun inbound email storage.
// Usage: node scripts/migrate-inbound-emails.js
// Requires DATABASE_URL in environment (set in .env.local).

const path = require('path');
const fs = require('fs');

// Load .env.local manually (the app doesn't use dotenv at runtime — Vercel injects env vars).
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx);
    let value = trimmed.slice(eqIdx + 1);
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not found in environment. Check .env.local.');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function main() {
  console.log('Connecting to Neon...');

  // Step 1: Create table
  await sql`CREATE TABLE IF NOT EXISTS inbound_emails (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id    TEXT UNIQUE,
    from_email    TEXT NOT NULL,
    from_name     TEXT,
    subject       TEXT,
    body_html     TEXT,
    body_plain    TEXT,
    received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at    TIMESTAMPTZ DEFAULT now(),
    read          BOOLEAN DEFAULT false,
    attachments   JSONB DEFAULT '[]'
  )`;
  console.log('Table created successfully.');

  // Step 1b: Create indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_inbound_emails_received_at ON inbound_emails (received_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_inbound_emails_message_id ON inbound_emails (message_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_inbound_emails_read ON inbound_emails (read)`;
  console.log('Indexes created successfully.');

  // Step 2: Verify table exists and is empty
  const [row] = await sql`SELECT count(*) AS cnt FROM inbound_emails`;
  const count = Number(row.cnt);
  console.log(`Verification: SELECT count(*) FROM inbound_emails => ${count}`);
  if (count === 0) {
    console.log('SUCCESS: inbound_emails table is ready for data.');
  } else {
    console.log('WARNING: Table contains data (should be empty for new migration).');
  }

  // Also verify column structure
  const cols = await sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'inbound_emails'
    ORDER BY ordinal_position
  `;
  console.log('\nColumn structure:');
  for (const col of cols) {
    console.log(`  ${col.column_name.padEnd(18)} ${col.data_type.padEnd(20)} nullable=${col.is_nullable} default=${col.column_default || '(none)'}`);
  }

  process.exit(0);
}

main().catch(function (err) {
  console.error('Migration failed:', err);
  process.exit(1);
});
