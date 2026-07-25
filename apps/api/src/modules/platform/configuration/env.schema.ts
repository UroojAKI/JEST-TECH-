import { z } from 'zod';

export const envSchema = z.object({
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
    .default('postgresql://postgres:postgres@localhost:5432/jest_policy_crm?schema=public'),
  JWT_SECRET: z
    .string()
    .default('super-secret-jwt-key-jest-policy-crm-2026-production-hardening-secret'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z
    .string()
    .default('super-secret-refresh-jwt-key-jest-policy-crm-2026-hardening-secret'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  REDIS_URL: z
    .string()
    .default('redis://localhost:6379'),
  ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:3001'),
});

export type EnvConfig = z.infer<typeof envSchema>;
