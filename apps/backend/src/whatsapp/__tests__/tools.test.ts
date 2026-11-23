import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { inspect } from 'util';

const m = vi.hoisted(() => ({
  create: vi.fn(),
  deleteTx: vi.fn(),
  findFirstTx: vi.fn(),
  findAllTx: vi.fn(),
  getData: vi.fn(),
  findAllBudget: vi.fn(),
  summary: vi.fn(),
  findAllCat: vi.fn(),
  groupBy: vi.fn(),
  logError: vi.fn(),
}));
vi.mock('../../config/logger', () => ({
  logger: { error: m.logError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../services/transaction.service', () => ({
  transactionService: { create: m.create, delete: m.deleteTx, findAll: m.findAllTx },
}));
vi.mock('../../services/dashboard.service', () => ({ dashboardService: { getData: m.getData } }));
vi.mock('../../services/budget.service', () => ({ budgetService: { findAll: m.findAllBudget } }));
vi.mock('../../services/loan.service', () => ({ loanService: { summary: m.summary } }));
vi.mock('../../services/category.service', () => ({ categoryService: { findAll: m.findAllCat } }));
vi.mock('../../config/prisma', () => ({ prisma: { transaction: { groupBy: m.groupBy, findFirst: m.findFirstTx } } }));

import {
  getHistory,
  appendHistory,
  setPending,
  getPending,
  clearPending,
  _resetConversations,
} from '../conversation';
import { buildTools, confirmPending, cancelPending } from '../tools';
import type { LlmMessage } from '../llm';

const MIN = 60_000;
// 2026-11-21 15:00 UTC = 12:00 BR
const T0 = Date.UTC(2026, 10, 21, 15, 0, 0);

const CATS = [
  { id: 10, name: 'Mercado', userId: 1 },
  { id: 11, name: 'Outros', userId: 1 },
  { id: 12, name: 'Salário', userId: 1 },
];

const pendingBase = {
  type: 'EXPENSE' as const,
  amount: 47,
  description: 'Compras',
  categoryId: 10,
  categoryName: 'Mercado',
  date: '2026-11-21',
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  _resetConversations();
  m.findAllCat.mockResolvedValue(CATS);
});
afterEach(() => vi.useRealTimers());

describe('conversation', () => {
  it('pendência expira após 10 min', () => {
    setPending(1, pendingBase);
    expect(getPending(1)).toMatchObject(pendingBase);
    vi.setSystemTime(T0 + 10 * MIN - 1);
    expect(getPending(1)).not.toBeNull();
    vi.setSystemTime(T0 + 10 * MIN + 1);
    expect(getPending(1)).toBeNull();
  });

  it('usuário 1 não enxerga a pendência do usuário 2', () => {
    setPending(2, pendingBase);
    expect(getPending(1)).toBeNull();
    expect(getPending(2)).not.toBeNull();
    clearPending(1);
    expect(getPending(2)).not.toBeNull();
    clearPending(2);
    expect(getPending(2)).toBeNull();
  });

  it('histórico mantém só as 10 últimas e é isolado por usuário', () => {
    const msgs: LlmMessage[] = Array.from({ length: 13 }, (_, i) => ({
      role: 'user' as const,
      content: `m${i}`,
    }));
    appendHistory(1, msgs);
    const h = getHistory(1);
    expect(h).toHaveLength(10);
    expect(h[0]).toEqual({ role: 'user', content: 'm3' });
    expect(h[9]).toEqual({ role: 'user', content: 'm12' });
    expect(getHistory(2)).toEqual([]);
  });

  it('histórico zera após 30 min sem uso', () => {
    appendHistory(1, [{ role: 'user', content: 'oi' }]);
    vi.setSystemTime(T0 + 29 * MIN);
    expect(getHistory(1)).toHaveLength(1);
    appendHistory(1, [{ role: 'assistant', content: 'olá' }]);
    vi.setSystemTime(T0 + 29 * MIN + 30 * MIN + 1);
    expect(getHistory(1)).toEqual([]);
  });

  it('getHistory devolve cópia (mutação externa não afeta o estado)', () => {
    appendHistory(1, [{ role: 'user', content: 'oi' }]);
    getHistory(1).push({ role: 'user', content: 'x' });
    expect(getHistory(1)).toHaveLength(1);
  });
});

describe('propor_lancamento', () => {
  const propose = (args: unknown, userId = 1) =>
    buildTools(userId).run('propor_lancamento', typeof args === 'string' ? args : JSON.stringify(args));

  it.each([
    ['zero', '{"type":"EXPENSE","amount":0,"description":"x"}'],
    ['negativo', '{"type":"EXPENSE","amount":-50,"description":"x"}'],
    ['string', '{"type":"EXPENSE","amount":"abc","description":"x"}'],
    ['NaN (JSON inválido)', '{"type":"EXPENSE","amount":NaN,"description":"x"}'],
    ['Infinity', '{"type":"EXPENSE","amount":1e999,"description":"x"}'],
    ['ausente', '{"type":"EXPENSE","description":"x"}'],
    ['acima do limite', '{"type":"EXPENSE","amount":10000001,"description":"x"}'],
    ['arredonda para zero', '{"type":"EXPENSE","amount":0.001,"description":"x"}'],
    ['type inválido', '{"type":"TRANSFER","amount":10,"description":"x"}'],
    ['descrição vazia', '{"type":"EXPENSE","amount":10,"description":"   "}'],
    ['descrição longa', JSON.stringify({ type: 'EXPENSE', amount: 10, description: 'a'.repeat(256) })],
    ['data impossível', '{"type":"EXPENSE","amount":10,"description":"x","date":"2026-02-30"}'],
    ['data mal formatada', '{"type":"EXPENSE","amount":10,"description":"x","date":"21/11/2026"}'],
    ['lixo', 'não é json'],
  ])('%s → erro, sem pendência e sem gravar', async (_label, json) => {
    const out = await propose(json);
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
    expect(out).not.toMatch(/Responda \*sim\*/);
    expect(getPending(1)).toBeNull();
    expect(m.create).not.toHaveBeenCalled();
  });

  it('proposta válida de 47 em Mercado → pendente e texto exato', async () => {
    const out = await propose({ type: 'EXPENSE', amount: 47, description: 'Compras', categoryId: 10 });
    expect(out).toBe('Lançar *despesa* de *R$ 47,00* em *Mercado* hoje? Responda *sim* ou *não*');
    expect(getPending(1)).toMatchObject({ ...pendingBase });
    expect(m.create).not.toHaveBeenCalled();
    expect(m.findAllCat).toHaveBeenCalledWith(1);
  });

  it('receita em outra data → *receita* e "em dd/mm"', async () => {
    const out = await propose({
      type: 'INCOME',
      amount: 1234.5,
      description: '  Salário  ',
      categoryId: 12,
      date: '2026-11-05',
    });
    expect(out).toBe('Lançar *receita* de *R$ 1.234,50* em *Salário* em 05/11? Responda *sim* ou *não*');
    expect(getPending(1)).toMatchObject({ description: 'Salário', date: '2026-11-05', type: 'INCOME' });
  });

  it('"hoje" usa a data do Brasil (01:00 UTC ainda é ontem no BR)', async () => {
    vi.setSystemTime(Date.UTC(2026, 10, 22, 1, 0, 0));
    const out = await propose({ type: 'EXPENSE', amount: 47, description: 'x', categoryId: 10 });
    expect(out).toContain('hoje?');
    expect(getPending(1)?.date).toBe('2026-11-21');
  });

  it('data a 367 dias → erro; a 365 dias → ok', async () => {
    // hoje BR = 2026-11-21
    const far = await propose({ type: 'EXPENSE', amount: 5, description: 'x', categoryId: 10, date: '2027-11-23' });
    expect(far).toMatch(/^Erro/);
    expect(getPending(1)).toBeNull();
    const past = await propose({ type: 'EXPENSE', amount: 5, description: 'x', categoryId: 10, date: '2025-11-19' });
    expect(past).toMatch(/^Erro/);
    expect(getPending(1)).toBeNull();
    const ok = await propose({ type: 'EXPENSE', amount: 5, description: 'x', categoryId: 10, date: '2027-11-21' });
    expect(ok).toBe('Lançar *despesa* de *R$ 5,00* em *Mercado* em 21/11/2027? Responda *sim* ou *não*');
  });

  it('ano diferente aparece como dd/mm/aaaa; mesmo ano como dd/mm', async () => {
    const out = await propose({ type: 'EXPENSE', amount: 5, description: 'x', categoryId: 10, date: '2025-12-31' });
    expect(out).toContain('em 31/12/2025?');
  });

  it('categoria inexistente cai em "Outros"', async () => {
    await propose({ type: 'EXPENSE', amount: 5, description: 'x', categoryId: 999 });
    expect(getPending(1)).toMatchObject({ categoryId: 11, categoryName: 'Outros' });
  });

  it('categoria de outro usuário não é aceita (cai em "Outros")', async () => {
    // 50 não está na lista do usuário 1
    await propose({ type: 'EXPENSE', amount: 5, description: 'x', categoryId: 50 });
    expect(getPending(1)?.categoryId).toBe(11);
  });

  it('sem categoria e sem "Outros" cai na primeira', async () => {
    m.findAllCat.mockResolvedValue([CATS[0], CATS[2]]);
    await propose({ type: 'EXPENSE', amount: 5, description: 'x' });
    expect(getPending(1)).toMatchObject({ categoryId: 10, categoryName: 'Mercado' });
  });

  it('usuário sem categorias → erro pedindo para criar', async () => {
    m.findAllCat.mockResolvedValue([]);
    const out = await propose({ type: 'EXPENSE', amount: 5, description: 'x' });
    expect(out).toMatch(/crie uma categoria/i);
    expect(getPending(1)).toBeNull();
  });

  it('userId nos argumentos é ignorado', async () => {
    await propose({ type: 'EXPENSE', amount: 5, description: 'x', categoryId: 10, userId: 999 });
    expect(m.findAllCat).toHaveBeenCalledWith(1);
    expect(m.findAllCat).not.toHaveBeenCalledWith(999);
    expect(getPending(1)).not.toBeNull();
    expect(getPending(999)).toBeNull();
  });
});

describe('confirmPending / cancelPending', () => {
  it('sem pendência → mensagem e não chama o service', async () => {
    expect(await confirmPending(1)).toBe('Não há lançamento pendente.');
    expect(m.create).not.toHaveBeenCalled();
  });

  it('pendência expirada → mensagem e não chama o service', async () => {
    setPending(1, pendingBase);
    vi.setSystemTime(T0 + 11 * MIN);
    expect(await confirmPending(1)).toBe('Não há lançamento pendente.');
    expect(m.create).not.toHaveBeenCalled();
  });

  it('com pendência → cria com currency BRL e limpa', async () => {
    m.create.mockResolvedValue({ id: 1 });
    setPending(1, pendingBase);
    const out = await confirmPending(1);
    expect(m.create).toHaveBeenCalledTimes(1);
    expect(m.create).toHaveBeenCalledWith(1, {
      description: 'Compras',
      amount: 47,
      type: 'EXPENSE',
      categoryId: 10,
      date: '2026-11-21',
      currency: 'BRL',
    });
    expect(out).toBe('✅ Lançado: despesa de R$ 47,00 em Mercado (21/11).');
    expect(getPending(1)).toBeNull();
  });

  it('texto de sucesso mostra o ano só quando difere do ano atual no BR', async () => {
    m.create.mockResolvedValue({ id: 1 });
    setPending(1, { ...pendingBase, date: '2026-03-05' });
    expect(await confirmPending(1)).toBe('✅ Lançado: despesa de R$ 47,00 em Mercado (05/03).');
    setPending(1, { ...pendingBase, date: '2025-12-31' });
    expect(await confirmPending(1)).toBe('✅ Lançado: despesa de R$ 47,00 em Mercado (31/12/2025).');
    // 31/12/2026 23:30 no BR (02:30 UTC de 2027): ano atual ainda é 2026
    vi.setSystemTime(Date.UTC(2027, 0, 1, 2, 30, 0));
    setPending(1, { ...pendingBase, date: '2026-12-31' });
    expect(await confirmPending(1)).toBe('✅ Lançado: despesa de R$ 47,00 em Mercado (31/12).');
  });

  it('"sim" duplo concorrente cria uma única transação', async () => {
    let resolve!: (v: unknown) => void;
    m.create.mockReturnValue(new Promise((r) => (resolve = r)));
    setPending(1, pendingBase);
    const a = confirmPending(1);
    const b = confirmPending(1);
    resolve({ id: 1 });
    const [ra, rb] = await Promise.all([a, b]);
    expect(m.create).toHaveBeenCalledTimes(1);
    expect(ra).toMatch(/^✅/);
    expect(rb).toBe('Não há lançamento pendente.');
  });

  it('erro no service → mensagem genérica e pendência mantida para tentar de novo', async () => {
    m.create.mockRejectedValueOnce(new Error('db down'));
    setPending(1, pendingBase);
    const out = await confirmPending(1);
    expect(out).toMatch(/não consegui lançar/i);
    expect(out).not.toMatch(/db down/);
    expect(getPending(1)).toMatchObject(pendingBase);
    m.create.mockResolvedValueOnce({ id: 1 });
    expect(await confirmPending(1)).toMatch(/^✅/);
    expect(getPending(1)).toBeNull();
  });

  it('cancelPending limpa', () => {
    setPending(1, pendingBase);
    expect(cancelPending(1)).toMatch(/cancelado/i);
    expect(getPending(1)).toBeNull();
    expect(cancelPending(1)).toBe('Não há lançamento pendente.');
  });

  it('confirmPending(2) não confirma a pendência do usuário 1', async () => {
    setPending(1, pendingBase);
    expect(await confirmPending(2)).toBe('Não há lançamento pendente.');
    expect(m.create).not.toHaveBeenCalled();
    expect(getPending(1)).not.toBeNull();
    cancelPending(2);
    expect(getPending(1)).not.toBeNull();
  });
});

describe('ferramentas confirmar/cancelar', () => {
  it('confirmar_lancamento usa a pendência do usuário do buildTools', async () => {
    m.create.mockResolvedValue({ id: 1 });
    setPending(1, pendingBase);
    setPending(2, { ...pendingBase, amount: 99 });
    const out = await buildTools(1, { userText: 'sim' }).run('confirmar_lancamento', '{"userId":2}');
    expect(out).toMatch(/^✅/);
    expect(m.create).toHaveBeenCalledWith(1, expect.objectContaining({ amount: 47 }));
    expect(getPending(2)).not.toBeNull();
  });

  it('não confirma na mesma rodada em que propôs (exige resposta do usuário)', async () => {
    const tools = buildTools(1, { userText: 'sim' });
    await tools.run('propor_lancamento', '{"type":"EXPENSE","amount":5,"description":"x","categoryId":10}');
    const out = await tools.run('confirmar_lancamento', '{}');
    expect(out).not.toMatch(/^✅/);
    expect(m.create).not.toHaveBeenCalled();
    expect(getPending(1)).not.toBeNull();
  });

  it.each(['últimas transações', 'sim, mas foi 57', 'não', 'sim 57', '', 'pode cancelar', 'sim espera', 'ok mas nao', 'sim, mas é outra categoria', 'ok, calma', 'sim errado', 'pode para'])(
    'confirmar_lancamento bloqueado para %j',
    async (text) => {
      setPending(1, pendingBase);
      const out = await buildTools(1, { userText: text }).run('confirmar_lancamento', '{}');
      expect(out).toMatch(/não posso confirmar/i);
      expect(m.create).not.toHaveBeenCalled();
      expect(getPending(1)).not.toBeNull();
    },
  );

  it('confirmar_lancamento bloqueado sem userText', async () => {
    setPending(1, pendingBase);
    const out = await buildTools(1).run('confirmar_lancamento', '{}');
    expect(out).toMatch(/não posso confirmar/i);
    expect(m.create).not.toHaveBeenCalled();
  });

  it.each(['sim', 'Pode lançar!', 'pode lançar', 'ok', 'ok!', 'Sim, confirmo'])('confirmar_lancamento permitido para %j', async (text) => {
    m.create.mockResolvedValue({ id: 1 });
    setPending(1, pendingBase);
    const out = await buildTools(1, { userText: text }).run('confirmar_lancamento', '{}');
    expect(out).toMatch(/^✅/);
    expect(m.create).toHaveBeenCalledTimes(1);
  });

  it('segunda proposta na mesma rodada é recusada e a primeira fica', async () => {
    const tools = buildTools(1);
    const first = await tools.run(
      'propor_lancamento',
      '{"type":"EXPENSE","amount":47,"description":"mercado","categoryId":10}',
    );
    const second = await tools.run(
      'propor_lancamento',
      '{"type":"EXPENSE","amount":20,"description":"uber","categoryId":11}',
    );
    expect(second).toMatch(/um lançamento por vez/i);
    expect(getPending(1)).toMatchObject({ amount: 47, categoryId: 10 });
    expect(tools.proposal()).toBe(first);
  });

  it('proposta inválida não impede nova tentativa na mesma rodada', async () => {
    const tools = buildTools(1);
    await tools.run('propor_lancamento', '{"type":"EXPENSE","amount":0,"description":"x"}');
    const out = await tools.run('propor_lancamento', '{"type":"EXPENSE","amount":5,"description":"x","categoryId":10}');
    expect(out).toMatch(/^Lançar/);
  });

  it('cancelar depois de propor zera a proposta da rodada', async () => {
    const tools = buildTools(1);
    await tools.run('propor_lancamento', '{"type":"EXPENSE","amount":5,"description":"x","categoryId":10}');
    await tools.run('cancelar_lancamento', '{}');
    expect(tools.proposal()).toBeNull();
    expect(getPending(1)).toBeNull();
  });

  it('discardProposal só limpa pendência criada na rodada', async () => {
    setPending(1, pendingBase);
    const t1 = buildTools(1);
    t1.discardProposal();
    expect(getPending(1)).not.toBeNull();
    const t2 = buildTools(1);
    await t2.run('propor_lancamento', '{"type":"EXPENSE","amount":5,"description":"x","categoryId":10}');
    t2.discardProposal();
    expect(getPending(1)).toBeNull();
  });

  it('cancelar_lancamento limpa só a do usuário', async () => {
    setPending(1, pendingBase);
    setPending(2, pendingBase);
    await buildTools(1).run('cancelar_lancamento', '{}');
    expect(getPending(1)).toBeNull();
    expect(getPending(2)).not.toBeNull();
  });
});

describe('consultas', () => {
  it('definições expõem as 7 ferramentas', () => {
    expect(buildTools(1).definitions.map((d) => d.name).sort()).toEqual(
      [
        'cancelar_lancamento',
        'confirmar_lancamento',
        'consultar_dividas',
        'consultar_orcamentos',
        'consultar_resumo',
        'consultar_transacoes',
        'propor_exclusao',
        'propor_lancamento',
      ].sort(),
    );
  });

  it('consultar_resumo rotula mês e saldo atual', async () => {
    m.getData.mockResolvedValue({ balance: 1000, totalIncome: 500, totalExpense: 200, monthlyBalance: 300 });
    const out = await buildTools(1).run('consultar_resumo', '{"userId":999}');
    expect(m.getData).toHaveBeenCalledWith(1);
    expect(out).toContain('Receitas do mês: R$ 500,00');
    expect(out).toContain('Despesas do mês: R$ 200,00');
    expect(out).toContain('Saldo atual: R$ 1.000,00');
  });

  it('consultar_transacoes limita a 20, filtra por usuário e soma por tipo', async () => {
    m.findAllTx.mockResolvedValue({
      data: [
        {
          id: 31,
          date: new Date('2026-11-20T00:00:00Z'),
          description: 'Pão',
          amount: -12.5,
          type: 'EXPENSE',
          category: { name: 'Mercado' },
        },
      ],
      total: 42,
    });
    m.groupBy.mockResolvedValue([
      { type: 'EXPENSE', _sum: { amount: -300 } },
      { type: 'INCOME', _sum: { amount: 1000 } },
    ]);
    const out = await buildTools(1).run(
      'consultar_transacoes',
      JSON.stringify({ limit: 500, type: 'EXPENSE', startDate: '2026-11-01', endDate: '2026-11-30', userId: 999 }),
    );
    expect(m.findAllTx).toHaveBeenCalledWith(1, {
      page: 1,
      limit: 20,
      type: 'EXPENSE',
      categoryId: undefined,
      startDate: '2026-11-01',
      endDate: '2026-11-30T23:59:59.999Z',
    });
    const where = m.groupBy.mock.calls[0][0].where;
    expect(where.userId).toBe(1);
    expect(out).toContain('42');
    expect(out).toContain('20/11 Pão — R$ 12,50 (Mercado) [id 31]');
    expect(out).toContain('R$ 300,00');
  });

  it('consultar_transacoes com data inválida → erro sem consultar', async () => {
    const out = await buildTools(1).run('consultar_transacoes', '{"startDate":"2026-13-01"}');
    expect(out.length).toBeGreaterThan(0);
    expect(m.findAllTx).not.toHaveBeenCalled();
  });

  it('consultar_orcamentos e consultar_dividas usam o userId do buildTools', async () => {
    m.findAllBudget.mockResolvedValue([]);
    m.summary.mockResolvedValue({ activeCount: 0, totalDebt: 0, totalPaid: 0, nextDue: [] });
    await buildTools(3).run('consultar_orcamentos', '{"userId":1}');
    await buildTools(3).run('consultar_dividas', '{"userId":1}');
    expect(m.findAllBudget).toHaveBeenCalledWith(3);
    expect(m.summary).toHaveBeenCalledWith(3);
  });

  it('erro em service vira texto, não exceção', async () => {
    m.getData.mockRejectedValue(new Error('boom'));
    const out = await buildTools(1).run('consultar_resumo', '{}');
    expect(typeof out).toBe('string');
    expect(out).not.toContain('boom');
  });

  it('erros de service vão para o logger sem a mensagem do erro (nada no console)', async () => {
    const LEAK = 'description=SEGREDO-VAZADO-1a2b3c';
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      m.groupBy.mockRejectedValue(Object.assign(new Error(LEAK), { code: 'P1001' }));
      m.findAllTx.mockResolvedValue({ data: [], total: 0 });
      await buildTools(1).run('consultar_transacoes', '{}');
      m.create.mockRejectedValueOnce(Object.assign(new Error(LEAK), { code: 'P2002' }));
      setPending(1, pendingBase);
      await confirmPending(1);
      expect(m.logError).toHaveBeenCalledTimes(2);
      for (const call of m.logError.mock.calls) expect(inspect(call, { depth: 10 })).not.toContain(LEAK);
      expect(inspect(m.logError.mock.calls[0], { depth: 10 })).toContain('P1001');
      expect(inspect(m.logError.mock.calls[1], { depth: 10 })).toContain('P2002');
      expect(consoleSpy).not.toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('ferramenta desconhecida → texto', async () => {
    expect(await buildTools(1).run('apagar_tudo', '{}')).toMatch(/desconhecida/i);
  });
});

describe('exclusão de lançamento', () => {
  const TX = {
    id: 7,
    userId: 1,
    type: 'EXPENSE',
    amount: -47,
    description: 'Mercado\ndo mês',
    date: new Date('2026-11-20T00:00:00Z'),
    category: { name: 'Mercado' },
  };

  it('propor_exclusao busca só do próprio usuário e mostra o que será apagado', async () => {
    m.findFirstTx.mockResolvedValue(TX);
    const out = await buildTools(1).run('propor_exclusao', '{"transactionId":7,"userId":999}');
    expect(m.findFirstTx.mock.calls[0][0].where).toEqual({ id: 7, userId: 1 });
    expect(out).toContain('Excluir *despesa* de *R$ 47,00*');
    expect(out).toContain('"Mercado do mês"');
    expect(out).toContain('20/11');
    expect(out).toContain('não pode ser desfeito');
    expect(m.deleteTx).not.toHaveBeenCalled();
    expect(getPending(1)).toMatchObject({ kind: 'delete', transactionId: 7 });
  });

  it('lançamento de outro usuário/inexistente: erro e nenhuma pendência', async () => {
    m.findFirstTx.mockResolvedValue(null);
    const out = await buildTools(1).run('propor_exclusao', '{"transactionId":7}');
    expect(out).toMatch(/não encontrado/i);
    expect(getPending(1)).toBeNull();
  });

  it.each(['{}', '{"transactionId":"7"}', '{"transactionId":-1}', '{"transactionId":1.5}', 'x'])(
    'argumentos inválidos %j não consultam o banco',
    async (args) => {
      const out = await buildTools(1).run('propor_exclusao', args);
      expect(out).toMatch(/^Erro/);
      expect(m.findFirstTx).not.toHaveBeenCalled();
    },
  );

  it('não confirma na mesma rodada em que propôs', async () => {
    m.findFirstTx.mockResolvedValue(TX);
    const tools = buildTools(1, { userText: 'sim' });
    await tools.run('propor_exclusao', '{"transactionId":7}');
    const out = await tools.run('confirmar_lancamento', '{}');
    expect(out).not.toMatch(/Excluído/);
    expect(m.deleteTx).not.toHaveBeenCalled();
    expect(getPending(1)).not.toBeNull();
  });

  it('uma proposta por rodada (segunda é recusada)', async () => {
    m.findFirstTx.mockResolvedValue(TX);
    const tools = buildTools(1);
    await tools.run('propor_exclusao', '{"transactionId":7}');
    const out = await tools.run('propor_exclusao', '{"transactionId":8}');
    expect(out).toMatch(/uma ação por vez/i);
    expect(getPending(1)).toMatchObject({ transactionId: 7 });
  });

  it('confirmar com "sim" exclui com o userId do chamador', async () => {
    m.deleteTx.mockResolvedValue(undefined);
    setPending(1, { kind: 'delete', transactionId: 7, type: 'EXPENSE', amount: 47, description: 'Mercado', categoryName: 'Mercado', date: '2026-11-20' });
    setPending(2, { kind: 'delete', transactionId: 99, type: 'EXPENSE', amount: 5, description: 'x', categoryName: 'y', date: '2026-11-20' });
    const out = await buildTools(1, { userText: 'sim' }).run('confirmar_lancamento', '{"userId":2,"transactionId":99}');
    expect(out).toMatch(/^🗑️ Excluído/);
    expect(m.deleteTx).toHaveBeenCalledTimes(1);
    expect(m.deleteTx).toHaveBeenCalledWith(1, 7);
    expect(getPending(1)).toBeNull();
    expect(getPending(2)).not.toBeNull();
  });

  it.each(['sim, mas só o outro', 'não', 'sim 57', 'pode cancelar', ''])('confirmação bloqueada para %j', async (text) => {
    setPending(1, { kind: 'delete', transactionId: 7, type: 'EXPENSE', amount: 47, description: 'Mercado', categoryName: 'Mercado', date: '2026-11-20' });
    const out = await buildTools(1, { userText: text }).run('confirmar_lancamento', '{}');
    expect(out).toMatch(/não posso confirmar/i);
    expect(m.deleteTx).not.toHaveBeenCalled();
  });

  it('"sim" duplo concorrente apaga uma vez só', async () => {
    m.deleteTx.mockResolvedValue(undefined);
    setPending(1, { kind: 'delete', transactionId: 7, type: 'EXPENSE', amount: 47, description: 'Mercado', categoryName: 'Mercado', date: '2026-11-20' });
    const [a, b] = await Promise.all([confirmPending(1), confirmPending(1)]);
    expect(m.deleteTx).toHaveBeenCalledTimes(1);
    expect([a, b].filter((x) => x.startsWith('🗑️'))).toHaveLength(1);
  });

  it('já excluído (404): avisa e limpa a pendência', async () => {
    m.deleteTx.mockRejectedValue(Object.assign(new Error('x'), { statusCode: 404 }));
    setPending(1, { kind: 'delete', transactionId: 7, type: 'EXPENSE', amount: 47, description: 'Mercado', categoryName: 'Mercado', date: '2026-11-20' });
    const out = await confirmPending(1);
    expect(out).toMatch(/não existe mais/);
    expect(getPending(1)).toBeNull();
  });

  it('falha ao excluir: mantém a pendência para tentar de novo', async () => {
    m.deleteTx.mockRejectedValue(new Error('db'));
    setPending(1, { kind: 'delete', transactionId: 7, type: 'EXPENSE', amount: 47, description: 'Mercado', categoryName: 'Mercado', date: '2026-11-20' });
    const out = await confirmPending(1);
    expect(out).toMatch(/Não consegui excluir/);
    expect(getPending(1)).toMatchObject({ kind: 'delete', transactionId: 7 });
  });

  it('cancelar exclusão diz que nada foi apagado', () => {
    setPending(1, { kind: 'delete', transactionId: 7, type: 'EXPENSE', amount: 47, description: 'Mercado', categoryName: 'Mercado', date: '2026-11-20' });
    expect(cancelPending(1)).toMatch(/Nada foi apagado/);
    expect(getPending(1)).toBeNull();
  });
});
