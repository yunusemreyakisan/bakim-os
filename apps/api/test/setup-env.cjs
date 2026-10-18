const { loadTestEnv } = require('./load-test-env.cjs');

const env = loadTestEnv();
for (const [key, value] of Object.entries(env)) {
  process.env[key] = value;
}
