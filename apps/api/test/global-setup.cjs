const path = require('path');
const { execFileSync } = require('child_process');
const { Client } = require('pg');
const { loadTestEnv } = require('./load-test-env.cjs');

module.exports = async function globalSetup() {
  const env = loadTestEnv();
  Object.assign(process.env, env);
  const url = new URL(env.DATABASE_URL);
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
    throw new Error('Test veritabanı adı geçersiz.');
  }
  const admin = new URL(env.DATABASE_URL);
  admin.pathname = '/postgres';
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (exists.rowCount === 0) {
    await client.query(`CREATE DATABASE "${dbName}"`);
  }
  await client.end();
  const prismaBin = path.resolve(__dirname, '../node_modules/.bin/prisma');
  execFileSync(prismaBin, ['migrate', 'deploy'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
};
