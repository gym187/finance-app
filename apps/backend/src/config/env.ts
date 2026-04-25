import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001'),
  DATABASE_URL: z.string({ required_error: 'DATABASE_URL é obrigatória' }),
  JWT_SECRET: z
    .string({ required_error: 'JWT_SECRET é obrigatório' })
    .min(32, 'JWT_SECRET deve ter pelo menos 32 caracteres'),
  JWT_REFRESH_SECRET: z
    .string({ required_error: 'JWT_REFRESH_SECRET é obrigatório' })
    .min(32, 'JWT_REFRESH_SECRET deve ter pelo menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  COOKIE_SECURE: z.string().default('false'),
  COOKIE_DOMAIN: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  WEBHOOK_URL: z.string().url().optional().or(z.literal('')),
  // Email
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('AppFin <noreply@appfin.dev>'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  // Web Push (VAPID)
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_EMAIL: z.string().default('admin@appfin.dev'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Variáveis de ambiente inválidas:');
  console.error(_env.error.format());
  process.exit(1);
}

export const env = _env.data;
