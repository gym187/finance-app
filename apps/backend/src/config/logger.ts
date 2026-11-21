import pino from 'pino';
import { env } from './env';

/**
 * Caminhos censurados nos logs (sintaxe de `redact` do pino; colchetes para cabeçalhos com hífen).
 * Usado pelo pino-http em app.ts: o serializer padrão loga todos os cabeçalhos.
 */
export const LOG_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-webhook-secret"]',
  'req.body.password',
  'res.headers["set-cookie"]',
];

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  ...(env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
    },
  }),
});
