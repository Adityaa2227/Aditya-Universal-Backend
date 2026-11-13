import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 15000,
    // Applied before any test file loads (dotenv never overrides these), so tests
    // can't reach a real database or use real secrets.
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      MONGODB_URI: 'mongodb://127.0.0.1:1/test',
      PORTFOLIO_MONGODB_URI: 'mongodb://127.0.0.1:1/portfolio-test',
      PORTFOLIO_JWT_SECRET: 'test-secret',
      BREVO_API_KEY: '',
      GROQ_API_KEY: '',
      GEMINI_API_KEY: '',
      CEREBRAS_API_KEY: '',
      OPENROUTER_API_KEY: '',
      IMAGEKIT_PRIVATE_KEY: '',
    },
  },
});
