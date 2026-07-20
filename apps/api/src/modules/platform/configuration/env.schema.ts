import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default('3000' as any),
  APP_NAME: z.string().default('JEST Policy CRM API'),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  JWT_SECRET: z
    .string()
    .min(
      32,
      'JWT_SECRET must be at least 32 characters long for production security',
    ),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters long'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  REDIS_URL: z
    .string()
    .url('REDIS_URL must be a valid URL')
    .default('redis://localhost:6379'),
  ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:3001'),
});

export type EnvConfig = z.infer<typeof envSchema>;
