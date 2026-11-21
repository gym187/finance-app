import { describe, it, expect, vi } from 'vitest';
import { Writable } from 'stream';
import pino from 'pino';

vi.mock('../env', () => ({ env: { NODE_ENV: 'test' } }));

import { LOG_REDACT_PATHS } from '../logger';

function capture() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(chunk.toString());
      cb();
    },
  });
  return { stream, lines };
}

const SECRET = 'wh-secret-7f3a9c';
const JWT = 'eyJhbGciOiJIUzI1NiJ9.payload.sig';
const BEARER = 'Bearer tok-abc-123';

const record = {
  req: {
    headers: {
      authorization: BEARER,
      cookie: `accessToken=${JWT}`,
      'x-webhook-secret': SECRET,
      'user-agent': 'evolution',
    },
    body: { password: 'hunter2-senha' },
  },
  res: { headers: { 'set-cookie': [`refreshToken=${JWT}; HttpOnly`], 'content-type': 'application/json' } },
};

describe('LOG_REDACT_PATHS', () => {
  it('censura segredo do webhook, cookies, authorization e senha', () => {
    const { stream, lines } = capture();
    pino({ redact: LOG_REDACT_PATHS }, stream).info(record, 'req');
    const out = lines.join('');
    for (const s of [SECRET, JWT, BEARER, 'hunter2-senha']) expect(out).not.toContain(s);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.req.headers['x-webhook-secret']).toBe('[Redacted]');
    expect(parsed.req.headers.cookie).toBe('[Redacted]');
    expect(parsed.req.headers.authorization).toBe('[Redacted]');
    expect(parsed.res.headers['set-cookie']).toBe('[Redacted]');
    expect(parsed.req.headers['user-agent']).toBe('evolution');
  });

  it('também vale num logger filho (como o pino-http usa)', () => {
    const { stream, lines } = capture();
    pino(stream).child({}, { redact: LOG_REDACT_PATHS }).info(record, 'req');
    const out = lines.join('');
    for (const s of [SECRET, JWT, BEARER]) expect(out).not.toContain(s);
  });
});
