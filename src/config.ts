import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_BASE_URL: z.string().url().default('http://localhost:3000'),
  B24_CLIENT_ID: z.string().min(1),
  B24_CLIENT_SECRET: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  MASTER_ENCRYPTION_KEY_BASE64: z.string().min(32),
  VIBECODE_API_KEY: z.string().optional(),
  VIBECODE_BASE_URL: z.string().url().default('https://vibecode.bitrix24.tech'),
  AI_MODEL: z.string().default('bitrix/bitrixgpt-5'),
  AI_SIMPLE_MODEL: z.string().default('bitrix/bitrixgpt-5'),
  SUPABASE_STORAGE_PUBLIC_BASE_URL: z.string().url().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default('comm-hub-attachments'),
  SUPABASE_STORAGE_SERVICE_KEY: z.string().optional(),
  DISABLE_WORKERS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

export type AppConfig = z.infer<typeof envSchema>;

export function getConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse(env);
}

export function getOptionalConfig(env: NodeJS.ProcessEnv = process.env): Partial<AppConfig> {
  return envSchema.partial().parse(env);
}
