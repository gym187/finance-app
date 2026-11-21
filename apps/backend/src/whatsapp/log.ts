/**
 * Resumo seguro de um erro para log: só `name`, `code` e `status` numérico.
 * A mensagem fica de fora: erros do Prisma podem embutir argumentos (descrição, jid,
 * telefone, código) e os do Evolution trazem parte do corpo da resposta.
 */
export function safeErr(err: unknown): { name?: string; code?: unknown; status?: number } {
  if (err && typeof err === 'object') {
    const e = err as { name?: unknown; code?: unknown; status?: unknown };
    const out: { name?: string; code?: unknown; status?: number } = {
      name: typeof e.name === 'string' ? e.name : undefined,
      code: e.code,
    };
    if (typeof e.status === 'number') out.status = e.status;
    return out;
  }
  return { name: typeof err };
}
