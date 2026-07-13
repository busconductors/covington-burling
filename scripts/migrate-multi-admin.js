var { neon } = require('@neondatabase/serverless');

async function migrate() {
  var DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) throw new Error('DATABASE_URL not configured');
  var s = neon(DATABASE_URL);

  console.log('Creating admin_users table...');
  await s`CREATE TABLE IF NOT EXISTS admin_users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name  TEXT NOT NULL,
    is_master     BOOLEAN DEFAULT false,
    permissions   JSONB DEFAULT '{}',
    created_at    TIMESTAMPTZ DEFAULT now(),
    last_login_at TIMESTAMPTZ
  )`;

  console.log('Adding user_id to admin_sessions...');
  await s`ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES admin_users(id)`;

  console.log('Migration complete.');
}

migrate().catch(function (err) { console.error(err); process.exit(1); });
