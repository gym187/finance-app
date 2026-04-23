import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './config/logger';
import { csrfProtect } from './middleware/csrf.middleware';
import routes from './routes';
import { errorHandler } from './middleware/error.middleware';

const app = express();

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} não permitida pelo CORS`));
      }
    },
    credentials: true,
  })
);

// ─── HTTP request logging ─────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    customLogLevel: (_req, res) => (res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
    customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
    redact: ['req.headers.authorization', 'req.body.password'],
  })
);

// ─── Rate limiting (apenas em produção) ──────────────────────────────────────
if (env.NODE_ENV === 'production') {
  // Global: 300 req / 15 min por IP
  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
      message: { success: false, error: 'Muitas requisições. Tente novamente em 15 minutos.' },
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  // Login e register: 20 tentativas / 15 min (não inclui /profile ou /refresh)
  app.use(
    ['/api/auth/login', '/api/auth/register'],
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 20,
      message: { success: false, error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  // Password reset: 5 req / 15 min
  app.use(
    ['/api/auth/forgot-password', '/api/auth/reset-password'],
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      message: { success: false, error: 'Muitas tentativas de redefinição. Tente novamente em 15 minutos.' },
      standardHeaders: true,
      legacyHeaders: false,
    })
  );
}

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── CSRF protection (mutating requests with active session) ──────────────────
app.use(csrfProtect);

// ─── API routes ───────────────────────────────────────────────────────────────
app.use('/api', routes);

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Rota não encontrada' });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

export { app };
