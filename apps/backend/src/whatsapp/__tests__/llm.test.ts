import { describe, it, expect, vi, beforeEach } from 'vitest';

const envMock = vi.hoisted(() => ({
  OPENAI_API_KEY: 'sk-test' as string | undefined,
  OPENAI_CHAT_MODEL: 'gpt-chat' as string | undefined,
  OPENAI_TRANSCRIBE_MODEL: 'gpt-trans' as string | undefined,
}));
vi.mock('../../config/env', () => ({ env: envMock }));

const sdk = vi.hoisted(() => ({
  ctor: vi.fn(),
  chatCreate: vi.fn(),
  transcribeCreate: vi.fn(),
  toFile: vi.fn(),
}));
vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: sdk.chatCreate } };
    audio = { transcriptions: { create: sdk.transcribeCreate } };
    constructor(opts: unknown) {
      sdk.ctor(opts);
    }
  },
  toFile: sdk.toFile,
}));

import { openaiClient } from '../llm';

beforeEach(() => {
  vi.clearAllMocks();
  envMock.OPENAI_API_KEY = 'sk-test';
  envMock.OPENAI_CHAT_MODEL = 'gpt-chat';
  envMock.OPENAI_TRANSCRIBE_MODEL = 'gpt-trans';
});

describe('transcribe', () => {
  it('envia audio.ogg, language pt e modelo configurado; devolve o texto', async () => {
    const file = { name: 'audio.ogg' };
    sdk.toFile.mockResolvedValue(file);
    sdk.transcribeCreate.mockResolvedValue({ text: 'gastei 20 reais' });
    const buf = Buffer.from('abc');
    await expect(openaiClient.transcribe(buf)).resolves.toBe('gastei 20 reais');
    expect(sdk.toFile).toHaveBeenCalledWith(buf, 'audio.ogg');
    expect(sdk.transcribeCreate).toHaveBeenCalledWith({ file, model: 'gpt-trans', language: 'pt' });
    expect(sdk.ctor).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'sk-test', timeout: 30_000, maxRetries: 1 }));
  });

  it('modelo vazio usa o padrão; texto ausente vira string vazia', async () => {
    envMock.OPENAI_TRANSCRIBE_MODEL = '';
    sdk.toFile.mockResolvedValue({});
    sdk.transcribeCreate.mockResolvedValue({});
    await expect(openaiClient.transcribe(Buffer.from('x'))).resolves.toBe('');
    expect(sdk.transcribeCreate.mock.calls[0][0].model).toBe('gpt-4o-mini-transcribe');
  });

  it('sem chave lança erro', async () => {
    envMock.OPENAI_API_KEY = undefined;
    await expect(openaiClient.transcribe(Buffer.from('x'))).rejects.toThrow(/OPENAI_API_KEY/);
  });
});

describe('complete', () => {
  it('converte mensagens e tools para o formato do SDK e a resposta de volta', async () => {
    sdk.chatCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [{ id: 'c1', type: 'function', function: { name: 'f', arguments: '{"a":1}' } }],
          },
        },
      ],
    });
    const res = await openaiClient.complete(
      [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'oi' },
        { role: 'assistant', content: null, toolCalls: [{ id: 'c0', name: 'g', arguments: '{}' }] },
        { role: 'tool', toolCallId: 'c0', content: 'ok' },
        { role: 'assistant', content: 'feito' },
      ],
      [{ name: 'f', description: 'd', parameters: { type: 'object' } }],
    );
    expect(sdk.chatCreate).toHaveBeenCalledWith({
      model: 'gpt-chat',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'oi' },
        {
          role: 'assistant',
          content: null,
          tool_calls: [{ id: 'c0', type: 'function', function: { name: 'g', arguments: '{}' } }],
        },
        { role: 'tool', tool_call_id: 'c0', content: 'ok' },
        { role: 'assistant', content: 'feito' },
      ],
      tools: [{ type: 'function', function: { name: 'f', description: 'd', parameters: { type: 'object' } } }],
    });
    expect(res).toEqual({ content: null, toolCalls: [{ id: 'c1', name: 'f', arguments: '{"a":1}' }] });
  });

  it('omite tools quando vazio; sem tool_calls devolve []; modelo vazio usa padrão', async () => {
    envMock.OPENAI_CHAT_MODEL = '';
    sdk.chatCreate.mockResolvedValue({ choices: [{ message: { content: 'olá' } }] });
    const res = await openaiClient.complete([{ role: 'user', content: 'oi' }], []);
    const req = sdk.chatCreate.mock.calls[0][0];
    expect(req).not.toHaveProperty('tools');
    expect(req).not.toHaveProperty('temperature');
    expect(req.model).toBe('gpt-5-nano');
    expect(res).toEqual({ content: 'olá', toolCalls: [] });
  });

  it('sem chave lança erro', async () => {
    envMock.OPENAI_API_KEY = undefined;
    await expect(openaiClient.complete([], [])).rejects.toThrow(/OPENAI_API_KEY/);
  });
});
