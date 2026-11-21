import type { LlmMessage } from './llm';

/**
 * Estado de conversa em memória, sempre indexado por userId (isolamento entre usuários).
 * Usa Date.now() para permitir relógio falso nos testes.
 */

export type PendingTx = {
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  description: string;
  categoryId: number;
  categoryName: string;
  date: string; // YYYY-MM-DD
  expiresAt: number;
};

const HISTORY_MAX = 10;
const HISTORY_IDLE_MS = 30 * 60_000;
const PENDING_TTL_MS = 10 * 60_000;
const MAX_ENTRIES = 5_000;

type Conversation = { messages: LlmMessage[]; lastUsed: number };

const conversations = new Map<number, Conversation>();
const pendings = new Map<number, PendingTx>();

/** Remove o mais antigo (ordem de inserção) se o Map passou do limite. */
function cap<V>(map: Map<number, V>, isStale: (v: V) => boolean): void {
  if (map.size <= MAX_ENTRIES) return;
  for (const [k, v] of map) if (isStale(v)) map.delete(k);
  while (map.size > MAX_ENTRIES) {
    const oldest = map.keys().next().value as number;
    map.delete(oldest);
  }
}

function liveConversation(userId: number, now: number): Conversation | null {
  const c = conversations.get(userId);
  if (!c) return null;
  if (now - c.lastUsed > HISTORY_IDLE_MS) {
    conversations.delete(userId);
    return null;
  }
  return c;
}

export function getHistory(userId: number): LlmMessage[] {
  const c = liveConversation(userId, Date.now());
  return c ? c.messages.map((msg) => ({ ...msg })) : [];
}

export function appendHistory(userId: number, msgs: LlmMessage[]): void {
  const now = Date.now();
  const prev = liveConversation(userId, now)?.messages ?? [];
  const messages = [...prev, ...msgs.map((msg) => ({ ...msg }))].slice(-HISTORY_MAX);
  // reinsere para manter ordem de uso (o primeiro do Map é o menos recente)
  conversations.delete(userId);
  conversations.set(userId, { messages, lastUsed: now });
  cap(conversations, (c) => now - c.lastUsed > HISTORY_IDLE_MS);
}

export function setPending(userId: number, p: Omit<PendingTx, 'expiresAt'>): void {
  const now = Date.now();
  pendings.delete(userId);
  pendings.set(userId, { ...p, expiresAt: now + PENDING_TTL_MS });
  cap(pendings, (v) => v.expiresAt <= now);
}

export function getPending(userId: number): PendingTx | null {
  const p = pendings.get(userId);
  if (!p) return null;
  if (p.expiresAt <= Date.now()) {
    pendings.delete(userId);
    return null;
  }
  return { ...p };
}

export function clearPending(userId: number): void {
  pendings.delete(userId);
}

/**
 * Devolve uma pendência retirada (ex.: falha ao gravar), mantendo o prazo original,
 * desde que não tenha expirado nem sido substituída por outra.
 */
export function restorePending(userId: number, p: PendingTx): void {
  if (p.expiresAt <= Date.now() || getPending(userId) !== null) return;
  pendings.set(userId, { ...p });
}

/** Só para testes. */
export function _resetConversations(): void {
  conversations.clear();
  pendings.clear();
}
