import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const WA_KEYS = [
  'EVOLUTION_API_URL',
  'EVOLUTION_API_KEY',
  'EVOLUTION_INSTANCE',
  'WHATSAPP_WEBHOOK_SECRET',
  'OPENAI_API_KEY',
] as const;

const original = { ...process.env };

async function load(overrides: Record<string, string | undefined> = {}) {
  process.env = {
    ...original,
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    JWT_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
  };
  for (const k of [...WA_KEYS, 'WHATSAPP_DAILY_LIMIT']) delete process.env[k];
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  vi.resetModules();
  return import('../env');
}

const allSet = Object.fromEntries(WA_KEYS.map((k) => [k, 'x']));

describe('config/env', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    process.env = { ...original };
  });

  it('WHATSAPP_DAILY_LIMIT vazio usa o default 100', async () => {
    const { env } = await load({ WHATSAPP_DAILY_LIMIT: '' });
    expect(env.WHATSAPP_DAILY_LIMIT).toBe(100);
  });

  it('WHATSAPP_DAILY_LIMIT ausente usa o default 100', async () => {
    const { env } = await load();
    expect(env.WHATSAPP_DAILY_LIMIT).toBe(100);
  });

  it("WHATSAPP_DAILY_LIMIT '5' vira 5", async () => {
    const { env } = await load({ WHATSAPP_DAILY_LIMIT: '5' });
    expect(env.WHATSAPP_DAILY_LIMIT).toBe(5);
  });

  it('whatsappEnabled é false com as cinco vars vazias', async () => {
    const { whatsappEnabled } = await load(Object.fromEntries(WA_KEYS.map((k) => [k, ''])));
    expect(whatsappEnabled).toBe(false);
  });

  it('whatsappEnabled é true com as cinco vars definidas', async () => {
    const { whatsappEnabled } = await load(allSet);
    expect(whatsappEnabled).toBe(true);
  });

  it('whatsappEnabled é false se uma das cinco faltar', async () => {
    const { whatsappEnabled } = await load({ ...allSet, OPENAI_API_KEY: undefined });
    expect(whatsappEnabled).toBe(false);
  });
});
