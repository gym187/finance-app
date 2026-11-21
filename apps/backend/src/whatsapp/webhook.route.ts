import express, { type ErrorRequestHandler, type Express } from 'express';
import { webhookGuard } from './webhook.guard';
import { whatsappWebhookController } from './webhook.controller';

// JSON malformado de chamador autenticado: 400 (sem detalhes), em vez de cair no errorHandler global (500)
const bodyErrorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (err && (err.type === 'entity.parse.failed' || err.type === 'entity.too.large')) {
    res.status(err.type === 'entity.too.large' ? 413 : 400).json({
      success: false,
      error: err.type === 'entity.too.large' ? 'Corpo da requisição muito grande' : 'JSON inválido',
    });
    return;
  }
  next(err);
};

// A guarda vem ANTES do parse do body: chamadores não autenticados nunca têm o corpo lido.
export function mountWhatsappWebhook(app: Express): void {
  app.post(
    '/api/whatsapp/webhook',
    webhookGuard,
    express.json({ limit: '2mb' }),
    whatsappWebhookController,
    bodyErrorHandler
  );
}
