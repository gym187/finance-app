import { describe, it, expect, vi, beforeEach } from 'vitest';
import { inspect } from 'util';

const m = vi.hoisted(() => ({
  create: vi.fn(),
  deleteTx: vi.fn(),
  findAllTx: vi.fn(),
  getData: vi.fn(),
  findAllBudget: vi.fn(),
  summary: vi.fn(),
  findAllCat: vi.fn(),
  findUserIdByJid: vi.fn(),
  consumeLinkCode: vi.fn(),
  unlink: vi.fn(),
  runAgent: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('../../config/env', () => ({
  env: { WHATSAPP_DAILY_LIMIT: 100, NODE_ENV: 'test', WHATSAPP_WEBHOOK_SECRET: 's' },
  whatsappEnabled: true,
}));
vi.mock('../../config/logger', () => ({
  logger: { error: m.logError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../config/prisma', () => ({ prisma: {} }));
vi.mock('../../services/transaction.service', () => ({
  transactionService: { create: m.create, delete: m.deleteTx, findAll: m.findAllTx },
}));
vi.mock('../../services/dashboard.service', () => ({ dashboardService: { getData: m.getData } }));
vi.mock('../../services/budget.service', () => ({ budgetService: { findAll: m.findAllBudget } }));
vi.mock('../../services/loan.service', () => ({ loanService: { summary: m.summary } }));
vi.mock('../../services/category.service', () => ({ categoryService: { findAll: m.findAllCat } }));
vi.mock('../link.service', () => ({
  findUserIdByJid: m.findUserIdByJid,
  consumeLinkCode: m.consumeLinkCode,
  unlink: m.unlink,
}));
vi.mock('../agent', () => ({ runAgent: m.runAgent }));

import { handleIncoming } from '../handler';
import { createWebhookController } from '../webhook.controller';
import { _resetUsage } from '../usage';
import { _resetConversations, setPending, getPending, getHistory } from '../conversation';
import type { IncomingMessage, WhatsappProvider } from '../provider';
import type { LlmClient } from '../llm';

const FAIL = 'Não consegui processar agora, tenta de novo em instantes.';
const LINKED_JID = '5511999990000@s.whatsapp.net';

let seq = 0;
function msg(over: Partial<IncomingMessage> = {}): IncomingMessage {
  seq++;
  return {
    id: `MSG-${Date.now()}-${seq}`,
    jid: LINKED_JID,
    phone: '5511999990000',
    fromMe: false,
    isGroup: false,
    kind: 'text',
    text: 'oi',
    ...over,
  };
}

function fakeProvider() {
  const sent: { jid: string; text: string }[] = [];
  const provider: WhatsappProvider = {
    parseWebhook: vi.fn(() => null),
    sendText: vi.fn(async (jid: string, text: string) => {
      sent.push({ jid, text });
    }),
    sendImage: vi.fn(async () => undefined),
    getAudio: vi.fn(async () => Buffer.from('audio')),
  };
  return { provider, sent };
}

function fakeLlm(transcription = ''): LlmClient {
  return { transcribe: vi.fn(async () => transcription), complete: vi.fn() };
}

const PENDING = {
  type: 'EXPENSE' as const,
  amount: 47,
  description: 'Mercado',
  categoryId: 10,
  categoryName: 'Mercado',
  date: '2026-11-21',
};

function deferred<T = void>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

beforeEach(() => {
  vi.resetAllMocks();
  _resetUsage();
  _resetConversations();
  m.findUserIdByJid.mockImplementation(async (jid: string) => (jid === LINKED_JID ? 1 : null));
  m.getData.mockResolvedValue({ balance: 1000, totalIncome: 500, totalExpense: 200, monthlyBalance: 300 });
  m.create.mockResolvedValue({ id: 99 });
  m.runAgent.mockResolvedValue('resposta do agente');
});

describe('handleIncoming — filtros', () => {
  it('fromMe, grupo e id repetido: nada é enviado nem processado', async () => {
    const { provider, sent } = fakeProvider();
    const llm = fakeLlm();
    await handleIncoming(msg({ fromMe: true }), { provider, llm });
    await handleIncoming(msg({ isGroup: true, jid: '123@g.us' }), { provider, llm });
    const dup = msg({ text: 'saldo' });
    await handleIncoming(dup, { provider, llm });
    expect(sent).toHaveLength(1);
    await handleIncoming({ ...dup }, { provider, llm });
    expect(sent).toHaveLength(1);
    expect(m.findUserIdByJid).toHaveBeenCalledTimes(1);
  });
});

describe('handleIncoming — remetente desconhecido', () => {
  const jid = (n: number) => `55119000${String(n).padStart(5, '0')}@s.whatsapp.net`;

  it('código válido vincula e confirma', async () => {
    const { provider, sent } = fakeProvider();
    m.consumeLinkCode.mockResolvedValue({ status: 'linked', userId: 7 });
    await handleIncoming(msg({ jid: jid(1), phone: '5511900000001', text: ' 483920 ' }), { provider, llm: fakeLlm() });
    expect(m.consumeLinkCode).toHaveBeenCalledWith('483920', jid(1), '5511900000001');
    expect(sent).toEqual([
      { jid: jid(1), text: '✅ WhatsApp vinculado! Mande "ajuda" para ver o que posso fazer.' },
    ]);
  });

  it('código inválido e número em uso', async () => {
    const { provider, sent } = fakeProvider();
    m.consumeLinkCode.mockResolvedValueOnce({ status: 'invalid' }).mockResolvedValueOnce({ status: 'in_use' });
    await handleIncoming(msg({ jid: jid(2), text: '483920' }), { provider, llm: fakeLlm() });
    await handleIncoming(msg({ jid: jid(2), text: '111111' }), { provider, llm: fakeLlm() });
    expect(sent.map((s) => s.text)).toEqual([
      'Código inválido ou expirado. Gere um novo no AppFin.',
      'Este número já está vinculado a outra conta.',
    ]);
  });

  it('após 5 falhas, um código VÁLIDO é ignorado (sem consumeLinkCode, sem resposta)', async () => {
    const { provider, sent } = fakeProvider();
    m.consumeLinkCode.mockResolvedValue({ status: 'invalid' });
    for (let i = 0; i < 5; i++) await handleIncoming(msg({ jid: jid(3), text: '000000' }), { provider, llm: fakeLlm() });
    expect(m.consumeLinkCode).toHaveBeenCalledTimes(5);
    sent.length = 0;
    m.consumeLinkCode.mockResolvedValue({ status: 'linked', userId: 7 });
    await handleIncoming(msg({ jid: jid(3), text: '483920' }), { provider, llm: fakeLlm() });
    expect(m.consumeLinkCode).toHaveBeenCalledTimes(5);
    expect(sent).toHaveLength(0);
  });

  it('limite global (50 falhas entre jids) bloqueia um jid novo', async () => {
    const { provider, sent } = fakeProvider();
    m.consumeLinkCode.mockResolvedValue({ status: 'invalid' });
    for (let j = 0; j < 10; j++)
      for (let i = 0; i < 5; i++)
        await handleIncoming(msg({ jid: jid(100 + j), text: '000000' }), { provider, llm: fakeLlm() });
    expect(m.consumeLinkCode).toHaveBeenCalledTimes(50);
    sent.length = 0;
    m.consumeLinkCode.mockResolvedValue({ status: 'linked', userId: 7 });
    await handleIncoming(msg({ jid: jid(999), text: '483920' }), { provider, llm: fakeLlm() });
    expect(m.consumeLinkCode).toHaveBeenCalledTimes(50);
    expect(sent).toHaveLength(0);
  });

  it('outro texto: instrução uma vez, depois silêncio dentro de 1 h', async () => {
    const { provider, sent } = fakeProvider();
    await handleIncoming(msg({ jid: jid(4), text: 'olá' }), { provider, llm: fakeLlm() });
    await handleIncoming(msg({ jid: jid(4), text: 'oi?' }), { provider, llm: fakeLlm() });
    expect(sent).toEqual([{ jid: jid(4), text: 'Para usar, vincule seu número na página WhatsApp do AppFin.' }]);
    expect(m.consumeLinkCode).not.toHaveBeenCalled();
    expect(m.runAgent).not.toHaveBeenCalled();
  });

  it('concorrência: 10 códigos simultâneos do mesmo jid → no máximo 5 chegam ao consumeLinkCode', async () => {
    const { provider, sent } = fakeProvider();
    const gate = deferred<{ status: 'invalid' }>();
    m.consumeLinkCode.mockImplementation(() => gate.promise);
    const ps = Array.from({ length: 10 }, (_, i) =>
      handleIncoming(msg({ jid: jid(5), text: String(100000 + i) }), { provider, llm: fakeLlm() })
    );
    await vi.waitFor(() => expect(m.consumeLinkCode).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 10));
    expect(m.consumeLinkCode.mock.calls.length).toBeLessThanOrEqual(5);
    gate.resolve({ status: 'invalid' });
    await Promise.all(ps);
    expect(m.consumeLinkCode.mock.calls.length).toBeLessThanOrEqual(5);
    expect(sent.length).toBe(m.consumeLinkCode.mock.calls.length);
  });

  it('concorrência global: 60 jids simultâneos → no máximo 50 chegam ao consumeLinkCode', async () => {
    const { provider } = fakeProvider();
    const gate = deferred<{ status: 'invalid' }>();
    m.consumeLinkCode.mockImplementation(() => gate.promise);
    const ps = Array.from({ length: 60 }, (_, i) =>
      handleIncoming(msg({ jid: jid(200 + i), text: '000000' }), { provider, llm: fakeLlm() })
    );
    await vi.waitFor(() => expect(m.consumeLinkCode).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 10));
    gate.resolve({ status: 'invalid' });
    await Promise.all(ps);
    expect(m.consumeLinkCode.mock.calls.length).toBeLessThanOrEqual(50);
    expect(m.consumeLinkCode.mock.calls.length).toBeGreaterThan(0);
  });

  it('vínculo bem-sucedido devolve a reserva: 4 falhas + 1 vínculo ainda deixam uma 5a tentativa', async () => {
    const { provider } = fakeProvider();
    m.consumeLinkCode.mockResolvedValue({ status: 'invalid' });
    for (let i = 0; i < 4; i++) await handleIncoming(msg({ jid: jid(6), text: '000000' }), { provider, llm: fakeLlm() });
    m.consumeLinkCode.mockResolvedValueOnce({ status: 'linked', userId: 7 });
    await handleIncoming(msg({ jid: jid(6), text: '483920' }), { provider, llm: fakeLlm() });
    expect(m.consumeLinkCode).toHaveBeenCalledTimes(5);
    // a reserva do vínculo foi devolvida: a 5a falha ainda é tentada...
    await handleIncoming(msg({ jid: jid(6), text: '000001' }), { provider, llm: fakeLlm() });
    expect(m.consumeLinkCode).toHaveBeenCalledTimes(6);
    // ...e só então o jid fica bloqueado
    await handleIncoming(msg({ jid: jid(6), text: '000002' }), { provider, llm: fakeLlm() });
    expect(m.consumeLinkCode).toHaveBeenCalledTimes(6);
  });

  it('consumeLinkCode que lança conta como falha e o log não expõe código nem jid', async () => {
    const { provider, sent } = fakeProvider();
    const boom = Object.assign(new Error(`falha code=483920 jid=${jid(7)}`), { code: 'P1001' });
    m.consumeLinkCode.mockRejectedValue(boom);
    for (let i = 0; i < 5; i++) await handleIncoming(msg({ jid: jid(7), text: '483920' }), { provider, llm: fakeLlm() });
    expect(m.consumeLinkCode).toHaveBeenCalledTimes(5);
    expect(sent).toHaveLength(0);
    await handleIncoming(msg({ jid: jid(7), text: '483920' }), { provider, llm: fakeLlm() });
    expect(m.consumeLinkCode).toHaveBeenCalledTimes(5);
    expect(m.logError).toHaveBeenCalled();
    for (const call of m.logError.mock.calls) {
      const dump = inspect(call, { depth: 10 });
      expect(dump).not.toContain('483920');
      expect(dump).not.toContain(jid(7));
      expect(dump).not.toContain('5511900000007');
    }
    expect(inspect(m.logError.mock.calls[0])).toContain('P1001');
  });

  it('áudio de desconhecido nunca é baixado, transcrito nem usado como código', async () => {
    const { provider, sent } = fakeProvider();
    const llm = fakeLlm('483920');
    await handleIncoming(msg({ jid: jid(8), kind: 'audio', text: undefined, audioSeconds: 3 }), { provider, llm });
    expect(provider.getAudio).not.toHaveBeenCalled();
    expect(llm.transcribe).not.toHaveBeenCalled();
    expect(m.consumeLinkCode).not.toHaveBeenCalled();
    expect(sent.map((s) => s.text)).toEqual(['Para usar, vincule seu número na página WhatsApp do AppFin.']);
  });

  it('erro ao resolver usuário não lança', async () => {
    const { provider, sent } = fakeProvider();
    m.findUserIdByJid.mockRejectedValue(new Error('db'));
    await expect(handleIncoming(msg(), { provider, llm: fakeLlm() })).resolves.toBeUndefined();
    expect(sent).toHaveLength(0);
    expect(m.logError).toHaveBeenCalled();
  });
});

describe('handleIncoming — vinculado', () => {
  it('"saldo" usa o atalho e não chama runAgent', async () => {
    const { provider, sent } = fakeProvider();
    await handleIncoming(msg({ text: 'saldo' }), { provider, llm: fakeLlm() });
    expect(m.runAgent).not.toHaveBeenCalled();
    expect(sent).toHaveLength(1);
    expect(sent[0].jid).toBe(LINKED_JID);
    expect(sent[0].text).toContain('Saldo atual');
  });

  it('"ajuda" responde a lista via runShortcut', async () => {
    const { provider, sent } = fakeProvider();
    await handleIncoming(msg({ text: 'ajuda' }), { provider, llm: fakeLlm() });
    expect(sent[0].text).toContain('Posso ajudar com');
    expect(m.runAgent).not.toHaveBeenCalled();
  });

  it('"sim" com pendência grava uma vez e registra no histórico', async () => {
    const { provider, sent } = fakeProvider();
    setPending(1, PENDING);
    await handleIncoming(msg({ text: 'sim' }), { provider, llm: fakeLlm() });
    expect(m.create).toHaveBeenCalledTimes(1);
    expect(m.runAgent).not.toHaveBeenCalled();
    expect(sent[0].text).toContain('✅ Lançado');
    expect(getHistory(1)).toEqual([
      { role: 'user', content: 'sim' },
      { role: 'assistant', content: sent[0].text },
    ]);
  });

  it('"não" com pendência cancela e registra no histórico', async () => {
    const { provider, sent } = fakeProvider();
    setPending(1, PENDING);
    await handleIncoming(msg({ text: 'não' }), { provider, llm: fakeLlm() });
    expect(sent[0].text).toBe('Lançamento cancelado.');
    expect(m.create).not.toHaveBeenCalled();
    expect(getHistory(1)).toHaveLength(2);
  });

  it('"sim" sem pendência não grava: cai no agente', async () => {
    const { provider, sent } = fakeProvider();
    await handleIncoming(msg({ text: 'sim' }), { provider, llm: fakeLlm() });
    expect(m.create).not.toHaveBeenCalled();
    expect(m.runAgent).toHaveBeenCalledWith(1, 'sim', expect.anything(), expect.anything());
    expect(sent[0].text).toBe('resposta do agente');
  });

  it('"sair" desvincula', async () => {
    const { provider, sent } = fakeProvider();
    await handleIncoming(msg({ text: 'sair' }), { provider, llm: fakeLlm() });
    expect(m.unlink).toHaveBeenCalledWith(1);
    expect(sent[0].text).toBe('Número desvinculado.');
  });

  it('texto livre vai para o agente com o llm injetado', async () => {
    const { provider, sent } = fakeProvider();
    const llm = fakeLlm();
    await handleIncoming(msg({ text: 'gastei 47 no mercado' }), { provider, llm });
    expect(m.runAgent).toHaveBeenCalledWith(1, 'gastei 47 no mercado', llm, expect.anything());
    expect(sent).toEqual([{ jid: LINKED_JID, text: 'resposta do agente' }]);
  });

  it('kind other: "Só entendo texto e áudio."', async () => {
    const { provider, sent } = fakeProvider();
    await handleIncoming(msg({ kind: 'other', text: undefined }), { provider, llm: fakeLlm() });
    expect(sent[0].text).toBe('Só entendo texto e áudio.');
  });

  it('áudio de 130 s: áudio muito longo e transcribe não chamado', async () => {
    const { provider, sent } = fakeProvider();
    const llm = fakeLlm('x');
    await handleIncoming(msg({ kind: 'audio', text: undefined, audioSeconds: 130 }), { provider, llm });
    expect(sent[0].text).toBe('Áudio muito longo (máx. 2 min). Mande um mais curto.');
    expect(llm.transcribe).not.toHaveBeenCalled();
    expect(provider.getAudio).not.toHaveBeenCalled();
  });

  it('áudio sem audioSeconds e buffer de 4 MB: recusado sem transcrever', async () => {
    const { provider, sent } = fakeProvider();
    (provider.getAudio as any).mockResolvedValue(Buffer.alloc(4 * 1024 * 1024));
    const llm = fakeLlm('x');
    await handleIncoming(msg({ kind: 'audio', text: undefined }), { provider, llm });
    expect(sent[0].text).toBe('Áudio muito longo (máx. 2 min). Mande um mais curto.');
    expect(llm.transcribe).not.toHaveBeenCalled();
  });

  it('áudio sem audioSeconds e buffer pequeno: transcrito', async () => {
    const { provider, sent } = fakeProvider();
    const llm = fakeLlm('quanto gastei?');
    await handleIncoming(msg({ kind: 'audio', text: undefined }), { provider, llm });
    expect(llm.transcribe).toHaveBeenCalledTimes(1);
    expect(sent[0].text).toBe('resposta do agente');
  });

  it('áudio com transcrição só de espaços: não entendi, sem agente', async () => {
    const { provider, sent } = fakeProvider();
    await handleIncoming(msg({ kind: 'audio', text: undefined, audioSeconds: 5 }), { provider, llm: fakeLlm('   ') });
    expect(sent[0].text).toBe('Não entendi o áudio. Pode repetir?');
    expect(m.runAgent).not.toHaveBeenCalled();
  });

  it('áudio: com pendência após o agente, prefixa a transcrição', async () => {
    const { provider, sent } = fakeProvider();
    m.runAgent.mockImplementation(async (userId: number) => {
      setPending(userId, PENDING);
      return 'Confirma?';
    });
    const m1 = msg({ kind: 'audio', text: undefined, audioSeconds: 5 });
    await handleIncoming(m1, { provider, llm: fakeLlm('gastei 47 no mercado') });
    expect(provider.getAudio).toHaveBeenCalledWith(m1);
    expect(m.runAgent).toHaveBeenCalledWith(1, 'gastei 47 no mercado', expect.anything(), expect.anything());
    expect(sent[0].text).toBe('🎙️ Entendi: "gastei 47 no mercado"\n\nConfirma?');
  });

  it('áudio: sem pendência, sem prefixo', async () => {
    const { provider, sent } = fakeProvider();
    await handleIncoming(msg({ kind: 'audio', text: undefined, audioSeconds: 5 }), {
      provider,
      llm: fakeLlm('quanto gastei?'),
    });
    expect(sent[0].text).toBe('resposta do agente');
  });

  it('"sim" por áudio NÃO confirma exclusão pendente', async () => {
    const { provider, sent } = fakeProvider();
    setPending(1, { kind: 'delete', transactionId: 7, type: 'EXPENSE', amount: 47, description: 'Mercado', categoryName: 'Mercado', date: '2026-11-21' });
    await handleIncoming(msg({ kind: 'audio', text: undefined, audioSeconds: 2 }), { provider, llm: fakeLlm('sim') });
    expect(m.deleteTx).not.toHaveBeenCalled();
    expect(m.runAgent).not.toHaveBeenCalled();
    expect(sent[0].text).toContain('por texto');
    expect(getPending(1)).not.toBeNull();
  });

  it('"sim" por texto confirma a exclusão pendente', async () => {
    const { provider, sent } = fakeProvider();
    m.deleteTx.mockResolvedValue(undefined);
    setPending(1, { kind: 'delete', transactionId: 7, type: 'EXPENSE', amount: 47, description: 'Mercado', categoryName: 'Mercado', date: '2026-11-21' });
    await handleIncoming(msg({ text: 'sim' }), { provider, llm: fakeLlm() });
    expect(m.deleteTx).toHaveBeenCalledWith(1, 7);
    expect(sent[0].text).toContain('🗑️ Excluído');
  });

  it('áudio transcrito como atalho passa pelo atalho', async () => {
    const { provider, sent } = fakeProvider();
    await handleIncoming(msg({ kind: 'audio', text: undefined, audioSeconds: 3 }), { provider, llm: fakeLlm('Saldo') });
    expect(m.runAgent).not.toHaveBeenCalled();
    expect(sent[0].text).toContain('Saldo atual');
  });

  it('exceção no agente: mensagem de erro padrão', async () => {
    const { provider, sent } = fakeProvider();
    m.runAgent.mockRejectedValue(new Error('llm down'));
    await handleIncoming(msg({ text: 'quanto gastei?' }), { provider, llm: fakeLlm() });
    expect(sent).toEqual([{ jid: LINKED_JID, text: FAIL }]);
    expect(m.logError).toHaveBeenCalled();
  });

  it('exceção na transcrição: mensagem de erro padrão', async () => {
    const { provider, sent } = fakeProvider();
    const llm = fakeLlm();
    (llm.transcribe as any).mockRejectedValue(new Error('whisper'));
    await handleIncoming(msg({ kind: 'audio', text: undefined, audioSeconds: 3 }), { provider, llm });
    expect(sent[0].text).toBe(FAIL);
  });

  it('falha do sendText não lança', async () => {
    const { provider } = fakeProvider();
    (provider.sendText as any).mockRejectedValue(new Error('evolution down'));
    await expect(handleIncoming(msg({ text: 'saldo' }), { provider, llm: fakeLlm() })).resolves.toBeUndefined();
    m.runAgent.mockRejectedValue(new Error('x'));
    await expect(handleIncoming(msg({ text: 'oi' }), { provider, llm: fakeLlm() })).resolves.toBeUndefined();
    expect(m.logError).toHaveBeenCalled();
  });

  it('limite de uso: avisa só na primeira negativa', async () => {
    const { provider, sent } = fakeProvider();
    for (let i = 0; i < 32; i++) await handleIncoming(msg({ text: 'oi' }), { provider, llm: fakeLlm() });
    const denials = sent.filter((s) => s.text === 'Muitas mensagens em pouco tempo. Tente de novo em alguns minutos.');
    expect(denials).toHaveLength(1);
    expect(m.runAgent).toHaveBeenCalledTimes(30);
  });
});

describe('handleIncoming — serialização por usuário', () => {
  it('mesmo usuário em sequência; usuários diferentes em paralelo', async () => {
    const OTHER = '5511888880000@s.whatsapp.net';
    m.findUserIdByJid.mockImplementation(async (jid: string) => (jid === LINKED_JID ? 1 : jid === OTHER ? 2 : null));
    const gates: Record<string, ReturnType<typeof deferred<string>>> = {
      a1: deferred<string>(),
      a2: deferred<string>(),
      b1: deferred<string>(),
    };
    const started: string[] = [];
    m.runAgent.mockImplementation(async (_u: number, text: string) => {
      started.push(text);
      return gates[text].promise;
    });
    const { provider, sent } = fakeProvider();
    const llm = fakeLlm();
    const p1 = handleIncoming(msg({ text: 'a1' }), { provider, llm });
    const p2 = handleIncoming(msg({ text: 'a2' }), { provider, llm });
    const p3 = handleIncoming(msg({ jid: OTHER, text: 'b1' }), { provider, llm });

    await vi.waitFor(() => expect(started).toEqual(expect.arrayContaining(['a1', 'b1'])));
    expect(started).not.toContain('a2');

    gates.b1.resolve('r-b1');
    await p3;
    expect(started).not.toContain('a2');

    gates.a1.resolve('r-a1');
    await p1;
    await vi.waitFor(() => expect(started).toContain('a2'));
    gates.a2.resolve('r-a2');
    await p2;
    expect(sent.map((s) => s.text)).toEqual(['r-b1', 'r-a1', 'r-a2']);
  });

  it('uma falha na fila não trava as próximas do mesmo usuário', async () => {
    const { provider, sent } = fakeProvider();
    m.runAgent.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce('ok');
    const p1 = handleIncoming(msg({ text: 'um' }), { provider, llm: fakeLlm() });
    const p2 = handleIncoming(msg({ text: 'dois' }), { provider, llm: fakeLlm() });
    await Promise.all([p1, p2]);
    expect(sent.map((s) => s.text)).toEqual([FAIL, 'ok']);
  });
});

const LEAK = 'SEGREDO-VAZADO-9f8e7d';
function expectNoLeak() {
  expect(m.logError).toHaveBeenCalled();
  for (const call of m.logError.mock.calls) expect(inspect(call, { depth: 10 })).not.toContain(LEAK);
}

describe('logs sem conteúdo do erro', () => {
  it('falha do sendText: o corpo da resposta do Evolution não vai para o log', async () => {
    const { provider } = fakeProvider();
    (provider.sendText as any).mockRejectedValue(
      Object.assign(new Error(`Evolution sendText falhou (500): ${LEAK}`), { status: 500 }),
    );
    await handleIncoming(msg({ text: 'saldo' }), { provider, llm: fakeLlm() });
    expectNoLeak();
    expect(inspect(m.logError.mock.calls[0], { depth: 10 })).toContain('500');
  });

  it('exceção ao processar mensagem de vinculado: mensagem do erro não vai para o log', async () => {
    const { provider } = fakeProvider();
    m.runAgent.mockRejectedValue(Object.assign(new Error(`prisma args description=${LEAK}`), { code: 'P2002' }));
    await handleIncoming(msg({ text: 'gastei 10 no mercado' }), { provider, llm: fakeLlm() });
    expectNoLeak();
    expect(inspect(m.logError.mock.calls[0], { depth: 10 })).toContain('P2002');
  });

  it('webhook: handler que rejeita e parseWebhook que lança não vazam a mensagem', async () => {
    const { provider } = fakeProvider();
    (provider.parseWebhook as any).mockReturnValue(msg());
    const handle = vi.fn(() => Promise.reject(new Error(LEAK)));
    const res: any = { status: vi.fn(() => res), json: vi.fn(() => res) };
    createWebhookController({ provider, llm: fakeLlm() }, handle)({ body: {} } as any, res);
    await vi.waitFor(() => expect(m.logError).toHaveBeenCalled());
    expectNoLeak();

    m.logError.mockClear();
    (provider.parseWebhook as any).mockImplementation(() => {
      throw new Error(LEAK);
    });
    createWebhookController({ provider, llm: fakeLlm() }, handle)({ body: {} } as any, res);
    expectNoLeak();
  });
});

describe('whatsappWebhookController', () => {
  function fakeRes() {
    const res: any = { statusCode: 0, body: undefined };
    res.status = vi.fn((c: number) => ((res.statusCode = c), res));
    res.json = vi.fn((b: unknown) => ((res.body = b), res));
    return res;
  }

  it('responde 200 antes de o handler terminar e chama handleIncoming uma vez', async () => {
    const { provider } = fakeProvider();
    const parsed = msg({ text: 'oi' });
    (provider.parseWebhook as any).mockReturnValue(parsed);
    const gate = deferred();
    const handle = vi.fn(() => gate.promise);
    const llm = fakeLlm();
    const controller = createWebhookController({ provider, llm }, handle);
    const res = fakeRes();
    const body = { event: 'messages.upsert' };
    controller({ body } as any, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({ success: true });
    expect(provider.parseWebhook).toHaveBeenCalledWith(body);
    expect(handle).toHaveBeenCalledTimes(1);
    expect(handle).toHaveBeenCalledWith(parsed, { provider, llm });
    gate.resolve();
  });

  it('corpo sem mensagem: não chama o handler', () => {
    const { provider } = fakeProvider();
    const handle = vi.fn();
    const res = fakeRes();
    createWebhookController({ provider, llm: fakeLlm() }, handle)({ body: {} } as any, res);
    expect(res.statusCode).toBe(200);
    expect(handle).not.toHaveBeenCalled();
  });

  it('engole handler que rejeita e parseWebhook que lança, logando', async () => {
    const { provider } = fakeProvider();
    (provider.parseWebhook as any).mockReturnValue(msg());
    const handle = vi.fn(() => Promise.reject(new Error('boom')));
    const res = fakeRes();
    createWebhookController({ provider, llm: fakeLlm() }, handle)({ body: {} } as any, res);
    expect(res.statusCode).toBe(200);
    await vi.waitFor(() => expect(m.logError).toHaveBeenCalled());

    m.logError.mockClear();
    (provider.parseWebhook as any).mockImplementation(() => {
      throw new Error('parse');
    });
    const res2 = fakeRes();
    expect(() => createWebhookController({ provider, llm: fakeLlm() }, handle)({ body: {} } as any, res2)).not.toThrow();
    expect(res2.statusCode).toBe(200);
    expect(m.logError).toHaveBeenCalled();
  });
});
