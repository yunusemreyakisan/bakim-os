const path = require('path');
const dotenv = require('dotenv');

function loadTestEnv() {
  const root = path.resolve(__dirname, '../../..');
  dotenv.config({ path: path.join(root, '.env'), quiet: true });
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL tanımlı değil. Kök .env dosyasını oluşturun.');
  }
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = '/bakimos_test';
  return {
    NODE_ENV: 'test',
    DATABASE_URL: process.env.TEST_DATABASE_URL || url.toString(),
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'test-only-access-secret-32-characters-min',
    JWT_ACCESS_TTL_SECONDS: process.env.JWT_ACCESS_TTL_SECONDS || '900',
    REFRESH_TOKEN_TTL_SECONDS: process.env.REFRESH_TOKEN_TTL_SECONDS || '1209600',
    TENANT_BOOTSTRAP_TOKEN: process.env.TENANT_BOOTSTRAP_TOKEN || 'test-bootstrap-token',
    WEB_ORIGIN: process.env.WEB_ORIGIN || 'http://localhost:3000',
    CORS_ORIGINS: process.env.CORS_ORIGINS || 'http://localhost:3000',
    COOKIE_SECURE: 'false',
    COOKIE_SAMESITE: 'lax',
    BCRYPT_COST: '4',
    THROTTLE_TTL_MS: '60000',
    THROTTLE_LIMIT: '1000',
    LOGIN_THROTTLE_LIMIT: '1000',
    API_PORT: '3001',
    TRUST_PROXY: 'false',
  };
}

module.exports = { loadTestEnv };
