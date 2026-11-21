import { describe, it, expect, vi, beforeEach } from 'vitest';

const cfg = vi.hoisted(() => ({ enabled: true }));

vi.mock('../../config/env', () => ({
  env: { WHATSAPP_WEBHOOK_SECRET: 'segredo-correto' },
  get whatsappEnabled() {
    return cfg.enabled;
  },
}));

import { webhookGuard, seenBefore } from '../webhook.guard';

function run(headers: Record<string, unknown>) {
  const req: any = { headers };
  const res: any = {
    statusCode: 0,
    body: undefined,
    status(c: number) { this.statusCode = c; return this; },
    json(b: unknown) { this.body = b; return this; },
  };
  const next = vi.fn();
  webhookGuard(req, res, next);
  return { res, next };
}

describe('webhookGuard', () => {
  beforeEach(() => { cfg.enabled = true; });

  it('401 sem segredo', () => {
    const { res, next } = run({});
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(next).not.toHaveBeenCalled();
  });
  it('401 com segredo errado (mesmo tamanho e tamanho diferente)', () => {
    expect(run({ 'x-webhook-secret': 'segredo-incorreto' }).res.statusCode).toBe(401);
    expect(run({ 'x-webhook-secret': 'x' }).res.statusCode).toBe(401);
  });
  it('401 com header em array', () => {
    expect(run({ 'x-webhook-secret': ['segredo-correto'] }).res.statusCode).toBe(401);
  });
  it('next() com segredo certo', () => {
    const { res, next } = run({ 'x-webhook-secret': 'segredo-correto' });
    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(0);
  });
  it('404 com cf-ray ou cf-connecting-ip mesmo com segredo certo', () => {
    for (const h of ['cf-ray', 'cf-connecting-ip']) {
      const { res, next } = run({ 'x-webhook-secret': 'segredo-correto', [h]: '1' });
      expect(res.statusCode).toBe(404);
      expect(next).not.toHaveBeenCalled();
    }
  });
  it('404 com módulo desligado', () => {
    cfg.enabled = false;
    const { res, next } = run({ 'x-webhook-secret': 'segredo-correto' });
    expect(res.statusCode).toBe(404);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('seenBefore', () => {
  it('false na primeira, true depois, false após 10 min + 1 ms', () => {
    const t = 1_000_000;
    expect(seenBefore('a', t)).toBe(false);
    expect(seenBefore('a', t + 1000)).toBe(true);
    expect(seenBefore('a', t + 10 * 60 * 1000 + 1)).toBe(false);
  });
  it('ids diferentes são independentes', () => {
    expect(seenBefore('x1', 5)).toBe(false);
    expect(seenBefore('x2', 5)).toBe(false);
  });
});
