import type { Request, Response } from 'express';
import { logger } from '../config/logger';
import { safeErr } from './log';
import { evolutionProvider } from './evolution.provider';
import { openaiClient } from './llm';
import { handleIncoming, type HandlerDeps } from './handler';

type Handle = (msg: Parameters<typeof handleIncoming>[0], deps: HandlerDeps) => Promise<void>;

/**
 * Responde 200 de imediato e processa a mensagem em segundo plano (sem aguardar).
 * Erros são logados sem conteúdo da mensagem.
 */
export function createWebhookController(deps: HandlerDeps, handle: Handle = handleIncoming) {
  return function controller(req: Request, res: Response): void {
    res.status(200).json({ success: true });
    try {
      const msg = deps.provider.parseWebhook(req.body);
      if (!msg) return;
      handle(msg, deps).catch((err) => {
        logger.error({ err: safeErr(err), msgId: msg.id }, '[whatsapp] falha no processamento do webhook');
      });
    } catch (err) {
      logger.error({ err: safeErr(err) }, '[whatsapp] falha ao interpretar webhook');
    }
  };
}

export const whatsappWebhookController = createWebhookController({
  provider: evolutionProvider,
  llm: openaiClient,
});
