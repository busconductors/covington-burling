const { neon } = require('@neondatabase/serverless');

let sql = null;

function getSql() {
  if (!sql) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not configured');
    sql = neon(process.env.DATABASE_URL);
    console.log('Neon: initialized');
  }
  return sql;
}

module.exports = { getSql };
