import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

vi.mock('../../config/env', () => ({
  env: { WHATSAPP_WEBHOOK_SECRET: 'segredo-correto' },
  whatsappEnabled: true,
}));

import { mountWhatsappWebhook } from '../webhook.route';

let server: Server;
let url: string;
const globalErr = vi.fn();

beforeAll(async () => {
  const app = express();
  mountWhatsappWebhook(app);
  app.use((err: unknown, _req: any, res: any, _next: any) => { globalErr(err); res.status(500).json({ success: false }); });
  await new Promise<void>((r) => { server = app.listen(0, r); });
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/whatsapp/webhook`;
});
afterAll(() => { server.close(); });

const post = (body: string, secret?: string) =>
  fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(secret ? { 'x-webhook-secret': secret } : {}) },
    body,
  });

describe('rota do webhook (ordem guarda -> parse)', () => {
  it('sem segredo e JSON malformado: 401 (corpo nunca é parseado)', async () => {
    const r = await post('{ruim');
    expect(r.status).toBe(401);
    expect(globalErr).not.toHaveBeenCalled();
  });
  it('autenticado com JSON malformado: 400 em pt-BR', async () => {
    const r = await post('{ruim', 'segredo-correto');
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ success: false, error: 'JSON inválido' });
    expect(globalErr).not.toHaveBeenCalled();
  });
  it('autenticado com JSON válido: 200', async () => {
    const r = await post('{"a":1}', 'segredo-correto');
    expect(r.status).toBe(200);
  });
});
