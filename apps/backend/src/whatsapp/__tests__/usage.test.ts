import { describe, it, expect, vi, beforeEach } from 'vitest';

const envMock = vi.hoisted(() => ({ WHATSAPP_DAILY_LIMIT: 100 }));
vi.mock('../../config/env', () => ({ env: envMock }));

import { consume, allowUnknownReply, allowLinkAttempt, recordLinkFailure, _resetUsage } from '../usage';

const MIN = 60_000;
const HOUR = 60 * MIN;
// 2026-01-10 12:00 UTC (09:00 BR)
const T0 = Date.UTC(2026, 0, 10, 12, 0, 0);

beforeEach(() => {
  envMock.WHATSAPP_DAILY_LIMIT = 100;
  _resetUsage();
});

describe('consume', () => {
  it('permite 30 e nega a 31a (window), firstTime só na primeira negativa', () => {
    for (let i = 0; i < 30; i++) expect(consume(1, T0 + i)).toEqual({ allowed: true });
    expect(consume(1, T0 + 31)).toEqual({ allowed: false, reason: 'window', firstTime: true });
    expect(consume(1, T0 + 32)).toEqual({ allowed: false, reason: 'window', firstTime: false });
  });

  it('volta a permitir após 10 min', () => {
    for (let i = 0; i < 30; i++) consume(1, T0 + i);
    expect(consume(1, T0 + 100).allowed).toBe(false);
    expect(consume(1, T0 + 10 * MIN + 100)).toEqual({ allowed: true });
  });

  it('negadas não contam na janela (não estende o bloqueio)', () => {
    for (let i = 0; i < 30; i++) consume(1, T0 + i);
    for (let i = 0; i < 50; i++) consume(1, T0 + 5 * MIN + i);
    expect(consume(1, T0 + 10 * MIN + 30)).toEqual({ allowed: true });
  });

  it('usuários são independentes', () => {
    for (let i = 0; i < 30; i++) consume(1, T0 + i);
    expect(consume(2, T0 + 40)).toEqual({ allowed: true });
  });

  it('teto diário nega a 4ª com reason daily', () => {
    envMock.WHATSAPP_DAILY_LIMIT = 3;
    expect(consume(1, T0).allowed).toBe(true);
    expect(consume(1, T0 + 11 * MIN).allowed).toBe(true);
    expect(consume(1, T0 + 22 * MIN).allowed).toBe(true);
    expect(consume(1, T0 + 33 * MIN)).toEqual({ allowed: false, reason: 'daily', firstTime: true });
    expect(consume(1, T0 + 44 * MIN)).toEqual({ allowed: false, reason: 'daily', firstTime: false });
  });

  it('dia seguinte (BR) zera', () => {
    envMock.WHATSAPP_DAILY_LIMIT = 3;
    for (let i = 0; i < 3; i++) consume(1, T0 + i);
    expect(consume(1, T0 + 5).allowed).toBe(false);
    expect(consume(1, T0 + 24 * HOUR)).toEqual({ allowed: true });
  });

  it('virada usa meia-noite de Brasília (03:00 UTC)', () => {
    envMock.WHATSAPP_DAILY_LIMIT = 2;
    const before = Date.UTC(2026, 0, 11, 2, 59, 0);
    const after = Date.UTC(2026, 0, 11, 3, 0, 0);
    expect(consume(1, before - 20 * MIN).allowed).toBe(true);
    expect(consume(1, before).allowed).toBe(true);
    expect(consume(1, before + 1000)).toMatchObject({ allowed: false, reason: 'daily' });
    expect(consume(1, after)).toEqual({ allowed: true });
  });
});

describe('allowUnknownReply', () => {
  it('true, false, e true após 1h', () => {
    expect(allowUnknownReply('x@s.whatsapp.net', T0)).toBe(true);
    expect(allowUnknownReply('x@s.whatsapp.net', T0 + 1000)).toBe(false);
    expect(allowUnknownReply('y@s.whatsapp.net', T0 + 1000)).toBe(true);
    expect(allowUnknownReply('x@s.whatsapp.net', T0 + HOUR + 1)).toBe(true);
  });
});

describe('link attempts', () => {
  it('bloqueia o jid com 5 falhas e libera após 1h', () => {
    for (let i = 0; i < 4; i++) recordLinkFailure('a', T0 + i);
    expect(allowLinkAttempt('a', T0 + 10)).toBe(true);
    recordLinkFailure('a', T0 + 5);
    expect(allowLinkAttempt('a', T0 + 10)).toBe(false);
    expect(allowLinkAttempt('b', T0 + 10)).toBe(true);
    expect(allowLinkAttempt('a', T0 + HOUR + 10)).toBe(true);
  });

  it('50 falhas globais bloqueiam qualquer jid, inclusive novo', () => {
    for (let i = 0; i < 49; i++) recordLinkFailure(`j${i}`, T0 + i);
    expect(allowLinkAttempt('novo', T0 + 100)).toBe(true);
    recordLinkFailure('j49', T0 + 50);
    expect(allowLinkAttempt('novo', T0 + 100)).toBe(false);
    expect(allowLinkAttempt('novo', T0 + HOUR + 100)).toBe(true);
  });

  it('memória limitada: não rastreia mais de 10.000 jids', () => {
    for (let i = 0; i < 10_500; i++) allowUnknownReply(`u${i}`, T0);
    // o mais antigo foi descartado, então é tratado como novo
    expect(allowUnknownReply('u0', T0 + 1)).toBe(true);
    expect(allowUnknownReply('u10499', T0 + 1)).toBe(false);
  });
});
