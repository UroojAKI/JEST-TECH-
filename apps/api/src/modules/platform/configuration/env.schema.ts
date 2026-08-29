import { z } from 'zod';

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    PORT: z
      .string()
      .transform((val) => parseInt(val, 10))
      .default('4000' as any),
    APP_NAME: z.string().default('JEST Policy CRM API'),
    DATABASE_URL: z
      .string()
      .default(
        'postgresql://postgres:postgres@localhost:5432/jest_policy_crm?schema=public',
      ),
    JWT_SECRET: z
      .string()
      .default(
        'super-secret-jwt-key-jest-policy-crm-2026-production-hardening-secret',
      ),
    JWT_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_SECRET: z
      .string()
      .default(
        'super-secret-refresh-jwt-key-jest-policy-crm-2026-hardening-secret',
      ),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
    REDIS_URL: z.string().default('redis://localhost:6379'),
    ALLOWED_ORIGINS: z
      .string()
      .default('http://localhost:3000,http://localhost:3001'),
  })
  .refine(
    (data) => {
      if (data.NODE_ENV === 'production') {
        const hasInsecureDb =
          !data.DATABASE_URL ||
          data.DATABASE_URL.includes('postgres:postgres@localhost');
        if (hasInsecureDb) return false;

        const hasInsecureJwt =
          !data.JWT_SECRET ||
          data.JWT_SECRET.includes('super-secret') ||
          data.JWT_SECRET.length < 32;
        if (hasInsecureJwt) return false;

        const hasInsecureRefresh =
          !data.JWT_REFRESH_SECRET ||
          data.JWT_REFRESH_SECRET.includes('super-secret') ||
          data.JWT_REFRESH_SECRET.length < 32;
        if (hasInsecureRefresh) return false;
      }
      return true;
    },
    {
      message:
        'CRITICAL PRODUCTION SECURITY FAILURE: Production mode (NODE_ENV=production) forbids default, mock, or weak credentials for DATABASE_URL, JWT_SECRET, or JWT_REFRESH_SECRET. Strong unique secrets (>=32 chars) are mandatory.',
    },
  );

export type EnvConfig = z.infer<typeof envSchema>;
