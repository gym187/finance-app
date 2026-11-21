import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const m = vi.hoisted(() => ({
  create: vi.fn(),
  findAllTx: vi.fn(),
  getData: vi.fn(),
  findAllBudget: vi.fn(),
  summary: vi.fn(),
  findAllCat: vi.fn(),
  groupBy: vi.fn(),
}));
vi.mock('../../services/transaction.service', () => ({
  transactionService: { create: m.create, findAll: m.findAllTx },
}));
vi.mock('../../services/dashboard.service', () => ({ dashboardService: { getData: m.getData } }));
vi.mock('../../services/budget.service', () => ({ budgetService: { findAll: m.findAllBudget } }));
vi.mock('../../services/loan.service', () => ({ loanService: { summary: m.summary } }));
vi.mock('../../services/category.service', () => ({ categoryService: { findAll: m.findAllCat } }));
vi.mock('../../config/prisma', () => ({ prisma: { transaction: { groupBy: m.groupBy } } }));

import { runAgent } from '../agent';
import { getHistory, getPending, _resetConversations } from '../conversation';
import type { LlmClient, LlmMessage, ToolDef } from '../llm';

type Reply = { content: string | null; toolCalls: { id: string; name: string; arguments: string }[] };

function fakeLlm(replies: Reply[] | ((i: number) => Reply)) {
  const calls: { messages: LlmMessage[]; tools: ToolDef[] }[] = [];
  const llm: LlmClient = {
    transcribe: vi.fn(),
    complete: vi.fn(async (messages, tools) => {
      calls.push({ messages: structuredClone(messages), tools });
      const i = calls.length - 1;
      return typeof replies === 'function' ? replies(i) : replies[i];
    }),
  };
  return { llm, calls };
}

const FAIL = 'Não consegui processar agora, tenta de novo em instantes.';
const T0 = Date.UTC(2026, 10, 21, 15, 0, 0);

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  _resetConversations();
  m.findAllCat.mockResolvedValue([
    { id: 10, name: 'Mercado' },
    { id: 11, name: 'Outros' },
  ]);
  m.getData.mockResolvedValue({ balance: 1000, totalIncome: 500, totalExpense: 200, monthlyBalance: 300 });
});
afterEach(() => vi.useRealTimers());

describe('runAgent', () => {
  it('resposta direta sem tool calls devolve o texto e grava histórico', async () => {
    const { llm, calls } = fakeLlm([{ content: 'Olá!', toolCalls: [] }]);
    expect(await runAgent(1, 'oi', llm)).toBe('Olá!');
    const sys = calls[0].messages[0];
    expect(sys.role).toBe('system');
    expect(sys.content).toContain('21/11/2026');
    expect(sys.content).toContain('10');
    expect(sys.content).toContain('Mercado');
    expect(sys.content).toMatch(/confirma/i);
    expect(calls[0].messages.at(-1)).toEqual({ role: 'user', content: 'oi' });
    expect(calls[0].tools.length).toBe(7);
    expect(getHistory(1)).toEqual([
      { role: 'user', content: 'oi' },
      { role: 'assistant', content: 'Olá!' },
    ]);
    expect(getHistory(2)).toEqual([]);
  });

  it('usa o histórico anterior do usuário', async () => {
    const a = fakeLlm([{ content: 'r1', toolCalls: [] }]);
    await runAgent(1, 'p1', a.llm);
    const b = fakeLlm([{ content: 'r2', toolCalls: [] }]);
    await runAgent(1, 'p2', b.llm);
    expect(b.calls[0].messages.slice(1)).toEqual([
      { role: 'user', content: 'p1' },
      { role: 'assistant', content: 'r1' },
      { role: 'user', content: 'p2' },
    ]);
    const c = fakeLlm([{ content: 'r3', toolCalls: [] }]);
    await runAgent(2, 'q', c.llm);
    expect(c.calls[0].messages.slice(1)).toEqual([{ role: 'user', content: 'q' }]);
  });

  it('tool call consultar_resumo seguida de texto → executa e devolve texto final', async () => {
    const { llm, calls } = fakeLlm([
      { content: null, toolCalls: [{ id: 'c1', name: 'consultar_resumo', arguments: '{}' }] },
      { content: 'Seu saldo é R$ 1.000,00', toolCalls: [] },
    ]);
    expect(await runAgent(1, 'saldo?', llm)).toBe('Seu saldo é R$ 1.000,00');
    expect(m.getData).toHaveBeenCalledWith(1);
    const msgs = calls[1].messages;
    expect(msgs.at(-2)).toEqual({
      role: 'assistant',
      content: null,
      toolCalls: [{ id: 'c1', name: 'consultar_resumo', arguments: '{}' }],
    });
    const toolMsg = msgs.at(-1)!;
    expect(toolMsg.role).toBe('tool');
    expect(toolMsg).toMatchObject({ toolCallId: 'c1' });
    expect((toolMsg as { content: string }).content).toContain('Saldo atual: R$ 1.000,00');
    // histórico guarda só texto
    expect(getHistory(1)).toEqual([
      { role: 'user', content: 'saldo?' },
      { role: 'assistant', content: 'Seu saldo é R$ 1.000,00' },
    ]);
  });

  it('executa todas as tool calls de uma mesma resposta', async () => {
    m.summary.mockResolvedValue({ activeCount: 0, totalDebt: 0, totalPaid: 0, nextDue: [] });
    const { llm, calls } = fakeLlm([
      {
        content: null,
        toolCalls: [
          { id: 'a', name: 'consultar_resumo', arguments: '{}' },
          { id: 'b', name: 'consultar_dividas', arguments: '{}' },
        ],
      },
      { content: 'ok', toolCalls: [] },
    ]);
    expect(await runAgent(1, 'tudo', llm)).toBe('ok');
    const tail = calls[1].messages.slice(-2);
    expect(tail.map((x) => (x as { toolCallId: string }).toolCallId)).toEqual(['a', 'b']);
  });

  it('6 tool calls seguidas → mensagem padrão, no máximo 5 iterações', async () => {
    const { llm } = fakeLlm(() => ({
      content: null,
      toolCalls: [{ id: 'x', name: 'consultar_resumo', arguments: '{}' }],
    }));
    expect(await runAgent(1, 'loop', llm)).toBe(FAIL);
    expect(llm.complete).toHaveBeenCalledTimes(5);
    expect(getHistory(1)).toEqual([]);
  });

  it('conteúdo vazio sem tool calls → mensagem padrão', async () => {
    const { llm } = fakeLlm([{ content: '   ', toolCalls: [] }]);
    expect(await runAgent(1, 'oi', llm)).toBe(FAIL);
  });

  it('userId do modelo é ignorado: ferramentas usam o userId recebido', async () => {
    const { llm } = fakeLlm([
      {
        content: null,
        toolCalls: [
          { id: '1', name: 'consultar_resumo', arguments: '{"userId":999}' },
          {
            id: '2',
            name: 'propor_lancamento',
            arguments: '{"userId":999,"type":"EXPENSE","amount":47,"description":"Compras","categoryId":10}',
          },
        ],
      },
      { content: 'Lançar *despesa* de *R$ 47,00* em *Mercado* hoje? Responda *sim* ou *não*', toolCalls: [] },
    ]);
    await runAgent(7, 'gastei 47 no mercado', llm);
    expect(m.getData).toHaveBeenCalledWith(7);
    expect(m.getData).not.toHaveBeenCalledWith(999);
    expect(m.findAllCat).toHaveBeenCalledWith(7);
    expect(m.findAllCat).not.toHaveBeenCalledWith(999);
    expect(getPending(7)).toMatchObject({ amount: 47, categoryId: 10 });
    expect(getPending(999)).toBeNull();
    expect(m.create).not.toHaveBeenCalled();
  });

  it('modelo não consegue propor e confirmar na mesma rodada', async () => {
    const { llm } = fakeLlm([
      {
        content: null,
        toolCalls: [
          {
            id: '1',
            name: 'propor_lancamento',
            arguments: '{"type":"EXPENSE","amount":47,"description":"x","categoryId":10}',
          },
          { id: '2', name: 'confirmar_lancamento', arguments: '{}' },
        ],
      },
      { content: 'Confirma?', toolCalls: [] },
    ]);
    await runAgent(1, 'sim', llm);
    expect(m.create).not.toHaveBeenCalled();
    expect(getPending(1)).not.toBeNull();
  });

  const P47 = '{"type":"EXPENSE","amount":47,"description":"mercado","categoryId":10}';
  const P20 = '{"type":"EXPENSE","amount":20,"description":"uber","categoryId":11}';
  const C47 = 'Lançar *despesa* de *R$ 47,00* em *Mercado* hoje? Responda *sim* ou *não*';

  it('duas propostas na rodada: primeira fica, segunda recusada, resposta = confirmação da primeira', async () => {
    const { llm, calls } = fakeLlm([
      {
        content: null,
        toolCalls: [
          { id: '1', name: 'propor_lancamento', arguments: P47 },
          { id: '2', name: 'propor_lancamento', arguments: P20 },
        ],
      },
      { content: 'Lançar 47 no mercado e 20 no uber? Responda sim', toolCalls: [] },
    ]);
    const out = await runAgent(1, 'gastei 47 no mercado e 20 no uber', llm);
    expect(out).toBe(C47);
    expect(getPending(1)).toMatchObject({ amount: 47 });
    const second = calls[1].messages.at(-1) as { content: string };
    expect(second.content).toMatch(/um lançamento por vez/i);
    expect(getHistory(1).at(-1)).toEqual({ role: 'assistant', content: C47 });
  });

  it('paráfrase do modelo é ignorada: resposta = texto da ferramenta', async () => {
    const { llm } = fakeLlm([
      { content: null, toolCalls: [{ id: '1', name: 'propor_lancamento', arguments: P47 }] },
      { content: 'Vou lançar R$ 74 em Comida, ok?', toolCalls: [] },
    ]);
    expect(await runAgent(1, 'gastei 47 no mercado', llm)).toBe(C47);
  });

  it('proposta + conteúdo vazio no fim → devolve a confirmação', async () => {
    const { llm } = fakeLlm([
      { content: null, toolCalls: [{ id: '1', name: 'propor_lancamento', arguments: P47 }] },
      { content: '', toolCalls: [] },
    ]);
    expect(await runAgent(1, 'gastei 47 no mercado', llm)).toBe(C47);
    expect(getPending(1)).not.toBeNull();
  });

  it('proposta seguida de loop esgotado → sem pendência', async () => {
    const { llm } = fakeLlm((i) =>
      i === 0
        ? { content: null, toolCalls: [{ id: '1', name: 'propor_lancamento', arguments: P47 }] }
        : { content: null, toolCalls: [{ id: 'x', name: 'consultar_resumo', arguments: '{}' }] },
    );
    expect(await runAgent(1, 'gastei 47', llm)).toBe(FAIL);
    expect(getPending(1)).toBeNull();
    expect(getHistory(1)).toEqual([]);
  });

  it('proposta seguida de exceção do LLM → rejeita e sem pendência', async () => {
    const { llm } = fakeLlm((i) => {
      if (i === 0) return { content: null, toolCalls: [{ id: '1', name: 'propor_lancamento', arguments: P47 }] };
      throw new Error('openai down');
    });
    await expect(runAgent(1, 'gastei 47', llm)).rejects.toThrow('openai down');
    expect(getPending(1)).toBeNull();
  });

  it('pendência anterior sobrevive a rodada que falha sem criar outra', async () => {
    const first = fakeLlm([
      { content: null, toolCalls: [{ id: '1', name: 'propor_lancamento', arguments: P47 }] },
      { content: 'x', toolCalls: [] },
    ]);
    await runAgent(1, 'gastei 47', first.llm);
    expect(getPending(1)).not.toBeNull();

    const empty = fakeLlm([{ content: '', toolCalls: [] }]);
    expect(await runAgent(1, 'e aí?', empty.llm)).toBe(FAIL);
    expect(getPending(1)).toMatchObject({ amount: 47 });

    const boom = fakeLlm(() => {
      throw new Error('down');
    });
    await expect(runAgent(1, 'e aí?', boom.llm)).rejects.toThrow('down');
    expect(getPending(1)).toMatchObject({ amount: 47 });
  });

  it('confirmar via agente: só com "sim" do usuário', async () => {
    m.create.mockResolvedValue({ id: 1 });
    const prop = fakeLlm([
      { content: null, toolCalls: [{ id: '1', name: 'propor_lancamento', arguments: P47 }] },
      { content: 'x', toolCalls: [] },
    ]);
    await runAgent(1, 'gastei 47', prop.llm);

    const injected = fakeLlm([
      { content: null, toolCalls: [{ id: '2', name: 'confirmar_lancamento', arguments: '{}' }] },
      { content: 'feito', toolCalls: [] },
    ]);
    await runAgent(1, 'últimas transações', injected.llm);
    expect(m.create).not.toHaveBeenCalled();

    const ok = fakeLlm([
      { content: null, toolCalls: [{ id: '3', name: 'confirmar_lancamento', arguments: '{}' }] },
      { content: 'Lançado!', toolCalls: [] },
    ]);
    expect(await runAgent(1, 'pode lançar', ok.llm)).toBe('Lançado!');
    expect(m.create).toHaveBeenCalledTimes(1);
    expect(getPending(1)).toBeNull();
  });
});
