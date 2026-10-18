import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(1_209_600),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_DOMAIN: z.string().optional().default(''),
  CORS_ORIGINS: z.string().min(1).default('http://localhost:3000'),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  TENANT_BOOTSTRAP_TOKEN: z.string().min(16),
  BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12),
  THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60_000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
  LOGIN_THROTTLE_LIMIT: z.coerce.number().int().positive().default(5),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
  STORAGE_ROOT: z.string().min(1).default('./var/storage'),
  SENTRY_DSN: z.string().optional().default(''),
});

export type AppConfig = {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  jwtAccessSecret: string;
  jwtAccessTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  cookieSecure: boolean;
  cookieSameSite: 'lax' | 'strict' | 'none';
  cookieDomain: string | undefined;
  corsOrigins: string[];
  webOrigin: string;
  bootstrapToken: string;
  bcryptCost: number;
  throttleTtlMs: number;
  throttleLimit: number;
  loginThrottleLimit: number;
  trustProxy: boolean;
  storageRoot: string;
  sentryDsn: string | undefined;
};

export const APP_CONFIG = Symbol('APP_CONFIG');

export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Ortam değişkenleri geçersiz: ${details}`);
  }
  const value = parsed.data;
  if (value.NODE_ENV === 'production') {
    if (
      value.JWT_ACCESS_SECRET.includes('dev-only') ||
      value.TENANT_BOOTSTRAP_TOKEN.includes('dev-only')
    ) {
      throw new Error('Üretim ortamında örnek sırlar kullanılamaz.');
    }
    if (value.COOKIE_SECURE !== 'true') {
      throw new Error('Üretim ortamında COOKIE_SECURE=true olmalıdır.');
    }
  }
  const domain = value.COOKIE_DOMAIN.trim();
  return {
    nodeEnv: value.NODE_ENV,
    port: value.API_PORT,
    databaseUrl: value.DATABASE_URL,
    jwtAccessSecret: value.JWT_ACCESS_SECRET,
    jwtAccessTtlSeconds: value.JWT_ACCESS_TTL_SECONDS,
    refreshTokenTtlSeconds: value.REFRESH_TOKEN_TTL_SECONDS,
    cookieSecure: value.COOKIE_SECURE === 'true',
    cookieSameSite: value.COOKIE_SAMESITE,
    cookieDomain: domain.length > 0 ? domain : undefined,
    corsOrigins: value.CORS_ORIGINS.split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    webOrigin: value.WEB_ORIGIN.replace(/\/$/, ''),
    bootstrapToken: value.TENANT_BOOTSTRAP_TOKEN,
    bcryptCost: value.BCRYPT_COST,
    throttleTtlMs: value.THROTTLE_TTL_MS,
    throttleLimit: value.THROTTLE_LIMIT,
    loginThrottleLimit: value.LOGIN_THROTTLE_LIMIT,
    trustProxy: value.TRUST_PROXY === 'true',
    storageRoot: value.STORAGE_ROOT,
    sentryDsn: value.SENTRY_DSN.trim() || undefined,
  };
}
