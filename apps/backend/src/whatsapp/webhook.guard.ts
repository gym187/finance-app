import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { env, whatsappEnabled } from '../config/env';

const DEDUPE_TTL_MS = 10 * 60 * 1000;
const seen = new Map<string, number>();

/** Retorna true se o id já foi visto nos últimos 10 min; senão registra e retorna false. */
export function seenBefore(id: string, now: number = Date.now()): boolean {
  // varredura preguiçosa: remove expirados (Map preserva ordem de inserção)
  for (const [key, ts] of seen) {
    if (now - ts > DEDUPE_TTL_MS) seen.delete(key);
    else break;
  }
  const ts = seen.get(id);
  if (ts !== undefined && now - ts <= DEDUPE_TTL_MS) return true;
  seen.delete(id);
  seen.set(id, now);
  return false;
}

function secretMatches(received: unknown, expected: string | undefined): boolean {
  if (typeof received !== 'string' || !expected) return false;
  const a = crypto.createHash('sha256').update(received).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export function webhookGuard(req: Request, res: Response, next: NextFunction): void {
  if (!whatsappEnabled) {
    res.status(404).json({ success: false, error: 'Rota não encontrada' });
    return;
  }
  // Requisições vindas pelo túnel da Cloudflare (internet pública) não são o Evolution interno
  if (req.headers['cf-ray'] || req.headers['cf-connecting-ip']) {
    res.status(404).json({ success: false, error: 'Rota não encontrada' });
    return;
  }
  if (!secretMatches(req.headers['x-webhook-secret'], env.WHATSAPP_WEBHOOK_SECRET)) {
    res.status(401).json({ success: false, error: 'Não autorizado' });
    return;
  }
  next();
}
