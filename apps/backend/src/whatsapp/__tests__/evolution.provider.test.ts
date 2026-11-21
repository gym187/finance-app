import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../../config/env', () => ({
  env: {
    EVOLUTION_API_URL: 'http://evo:8080',
    EVOLUTION_API_KEY: 'secret-key',
    EVOLUTION_INSTANCE: 'appfin',
  },
}));

import { evolutionProvider } from '../evolution.provider';

function payload(message: unknown, key: Record<string, unknown> = {}, extra: Record<string, unknown> = {}, event = 'messages.upsert') {
  return {
    event,
    instance: 'appfin',
    data: {
      key: { remoteJid: '5511999998888@s.whatsapp.net', fromMe: false, id: 'ABC123', ...key },
      message,
      ...extra,
    },
  };
}

describe('evolutionProvider.parseWebhook', () => {
  it('parses conversation text', () => {
    const m = evolutionProvider.parseWebhook(payload({ conversation: 'gastei 20' }));
    expect(m).toEqual({
      id: 'ABC123', jid: '5511999998888@s.whatsapp.net', phone: '5511999998888',
      fromMe: false, isGroup: false, kind: 'text', text: 'gastei 20',
    });
  });

  it('parses extendedTextMessage text', () => {
    const m = evolutionProvider.parseWebhook(payload({ extendedTextMessage: { text: 'oi' } }));
    expect(m?.kind).toBe('text');
    expect(m?.text).toBe('oi');
  });

  it('parses audio with seconds', () => {
    const m = evolutionProvider.parseWebhook(payload({ audioMessage: { seconds: 7 } }));
    expect(m?.kind).toBe('audio');
    expect(m?.audioSeconds).toBe(7);
  });

  it('parses image as other', () => {
    const m = evolutionProvider.parseWebhook(payload({ imageMessage: { caption: 'x' } }));
    expect(m?.kind).toBe('other');
  });

  it('detects groups', () => {
    const m = evolutionProvider.parseWebhook(payload({ conversation: 'a' }, { remoteJid: '1203630@g.us' }));
    expect(m?.isGroup).toBe(true);
  });

  it('detects fromMe', () => {
    const m = evolutionProvider.parseWebhook(payload({ conversation: 'a' }, { fromMe: true }));
    expect(m?.fromMe).toBe(true);
  });

  it('@lid gives phone null', () => {
    const m = evolutionProvider.parseWebhook(payload({ conversation: 'a' }, { remoteJid: '123456@lid' }));
    expect(m?.phone).toBeNull();
    expect(m?.jid).toBe('123456@lid');
  });

  it('@lid uses remoteJidAlt when real phone', () => {
    const m = evolutionProvider.parseWebhook(
      payload({ conversation: 'a' }, { remoteJid: '123456@lid', remoteJidAlt: '5511999998888@s.whatsapp.net' }),
    );
    expect(m?.phone).toBe('5511999998888');
  });

  it('@lid uses data.senderPn when real phone', () => {
    const m = evolutionProvider.parseWebhook(
      payload({ conversation: 'a' }, { remoteJid: '123456@lid' }, { senderPn: '5511999998888@s.whatsapp.net' }),
    );
    expect(m?.phone).toBe('5511999998888');
  });

  it('ignora status, listas de transmissão e canais (null)', () => {
    for (const remoteJid of ['status@broadcast', '120363012345678901@newsletter', 'x@broadcast', '5511999998888@c.us', 'semsufixo']) {
      expect(evolutionProvider.parseWebhook(payload({ conversation: 'a' }, { remoteJid }))).toBeNull();
    }
  });

  it('status@broadcast sem telefone não vira mensagem (sem resposta para o status)', () => {
    expect(
      evolutionProvider.parseWebhook(payload({ imageMessage: {} }, { remoteJid: 'status@broadcast', participant: '123@lid' })),
    ).toBeNull();
  });

  it('ignora reação, protocolo e distribuição de chave (null, sem "Só entendo texto e áudio")', () => {
    expect(evolutionProvider.parseWebhook(payload({ reactionMessage: { text: '👍', key: { id: 'X' } } }))).toBeNull();
    expect(evolutionProvider.parseWebhook(payload({ protocolMessage: { type: 'REVOKE' } }))).toBeNull();
    expect(
      evolutionProvider.parseWebhook(payload({ senderKeyDistributionMessage: { groupId: 'g' }, messageContextInfo: {} })),
    ).toBeNull();
  });

  it('distribuição de chave junto com texto continua sendo texto', () => {
    const m = evolutionProvider.parseWebhook(payload({ senderKeyDistributionMessage: { groupId: 'g' }, conversation: 'oi' }));
    expect(m?.kind).toBe('text');
    expect(m?.text).toBe('oi');
  });

  it('desembrulha mensagens temporárias e de visualização única', () => {
    const eph = evolutionProvider.parseWebhook(payload({ ephemeralMessage: { message: { extendedTextMessage: { text: 'gastei 5' } } } }));
    expect(eph?.kind).toBe('text');
    expect(eph?.text).toBe('gastei 5');
    const ephConv = evolutionProvider.parseWebhook(payload({ ephemeralMessage: { message: { conversation: 'saldo' } } }));
    expect(ephConv?.text).toBe('saldo');
    const ephAudio = evolutionProvider.parseWebhook(payload({ ephemeralMessage: { message: { audioMessage: { seconds: 4 } } } }));
    expect(ephAudio?.kind).toBe('audio');
    expect(ephAudio?.audioSeconds).toBe(4);
    const vo = evolutionProvider.parseWebhook(payload({ viewOnceMessage: { message: { audioMessage: { seconds: 3 } } } }));
    expect(vo?.kind).toBe('audio');
    const vo2 = evolutionProvider.parseWebhook(payload({ viewOnceMessageV2: { message: { conversation: 'oi' } } }));
    expect(vo2?.text).toBe('oi');
    const nested = evolutionProvider.parseWebhook(
      payload({ ephemeralMessage: { message: { viewOnceMessageV2: { message: { audioMessage: {} } } } } }),
    );
    expect(nested?.kind).toBe('audio');
    const ephReaction = evolutionProvider.parseWebhook(payload({ ephemeralMessage: { message: { reactionMessage: { text: '👍' } } } }));
    expect(ephReaction).toBeNull();
  });

  it('accepts MESSAGES_UPSERT', () => {
    expect(evolutionProvider.parseWebhook(payload({ conversation: 'a' }, {}, {}, 'MESSAGES_UPSERT'))).not.toBeNull();
  });

  it('returns null for other events', () => {
    expect(evolutionProvider.parseWebhook(payload({ conversation: 'a' }, {}, {}, 'connection.update'))).toBeNull();
  });

  it('returns null for invalid bodies without throwing', () => {
    for (const b of [null, undefined, 42, 'x', [], {}, { event: 'messages.upsert' }, { event: 'messages.upsert', data: { key: {} } }, { event: 'messages.upsert', data: null }]) {
      expect(evolutionProvider.parseWebhook(b)).toBeNull();
    }
  });
});

describe('evolutionProvider HTTP', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sendText posts to Evolution', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);
    await evolutionProvider.sendText('5511999998888@s.whatsapp.net', 'olá');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://evo:8080/message/sendText/appfin');
    expect(init.method).toBe('POST');
    expect(init.headers.apikey).toBe('secret-key');
    expect(JSON.parse(init.body)).toEqual({ number: '5511999998888@s.whatsapp.net', text: 'olá' });
  });

  it('sendText throws on non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' }));
    await expect(evolutionProvider.sendText('a@s.whatsapp.net', 'x')).rejects.toThrow(/500/);
  });

  it('sendText trunca o detalhe do erro em 200 caracteres', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'x'.repeat(1000) }));
    const err = await evolutionProvider.sendText('a@s.whatsapp.net', 'x').catch((e) => e as Error);
    expect(err.message.startsWith('Evolution sendText falhou (500)')).toBe(true);
    expect(err.message.length).toBeLessThan(260);
  });

  it('getAudio decodes base64', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 201,
      json: async () => ({ base64: Buffer.from('audio-bytes').toString('base64') }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const buf = await evolutionProvider.getAudio({
      id: 'ABC123', jid: 'j@s.whatsapp.net', phone: '1', fromMe: false, isGroup: false, kind: 'audio',
    });
    expect(buf.toString()).toBe('audio-bytes');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://evo:8080/chat/getBase64FromMediaMessage/appfin');
    expect(JSON.parse(init.body)).toEqual({
      message: { key: { id: 'ABC123', remoteJid: 'j@s.whatsapp.net', fromMe: false } },
    });
  });
});
