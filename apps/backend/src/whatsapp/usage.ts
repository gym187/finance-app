import { env } from '../config/env';

const MIN = 60_000;
const HOUR = 60 * MIN;
const WINDOW_MS = 10 * MIN;
const WINDOW_MAX = 30;
const BR_OFFSET_MS = 3 * HOUR;
const MAX_KEYS = 10_000;
const LINK_JID_MAX = 5;
const LINK_GLOBAL_MAX = 50;

/** Dia civil em Brasília (UTC-3) como 'YYYY-MM-DD'. */
function brDay(now: number): string {
  return new Date(now - BR_OFFSET_MS).toISOString().slice(0, 10);
}

/** Mantém o Map limitado, descartando as chaves mais antigas (ordem de inserção). */
function capKeys<K, V>(map: Map<K, V>): void {
  while (map.size > MAX_KEYS) {
    const oldest = map.keys().next();
    if (oldest.done) break;
    map.delete(oldest.value);
  }
}

interface UserUsage {
  stamps: number[];
  day: string;
  dayCount: number;
  windowWarned: boolean;
  dayWarned: boolean;
}

const users = new Map<number, UserUsage>();
const unknownReplies = new Map<string, number>();
const linkFailures = new Map<string, number[]>();
let globalLinkFailures: number[] = [];

export type ConsumeResult = { allowed: true } | { allowed: false; reason: 'window' | 'daily'; firstTime: boolean };

export function consume(userId: number, now: number = Date.now()): ConsumeResult {
  let u = users.get(userId);
  if (!u) {
    u = { stamps: [], day: brDay(now), dayCount: 0, windowWarned: false, dayWarned: false };
    users.set(userId, u);
    capKeys(users);
  }
  const today = brDay(now);
  if (u.day !== today) {
    u.day = today;
    u.dayCount = 0;
    u.dayWarned = false;
  }
  u.stamps = u.stamps.filter((t) => t > now - WINDOW_MS);

  if (u.dayCount >= env.WHATSAPP_DAILY_LIMIT) {
    const firstTime = !u.dayWarned;
    u.dayWarned = true;
    return { allowed: false, reason: 'daily', firstTime };
  }
  if (u.stamps.length >= WINDOW_MAX) {
    const firstTime = !u.windowWarned;
    u.windowWarned = true;
    return { allowed: false, reason: 'window', firstTime };
  }

  u.stamps.push(now);
  u.dayCount++;
  u.windowWarned = false;
  return { allowed: true };
}

export function allowUnknownReply(jid: string, now: number = Date.now()): boolean {
  const last = unknownReplies.get(jid);
  if (last !== undefined && now - last < HOUR) return false;
  unknownReplies.delete(jid); // reposiciona como o mais recente
  unknownReplies.set(jid, now);
  capKeys(unknownReplies);
  return true;
}

export function allowLinkAttempt(jid: string, now: number = Date.now()): boolean {
  globalLinkFailures = globalLinkFailures.filter((t) => t > now - HOUR);
  if (globalLinkFailures.length >= LINK_GLOBAL_MAX) return false;
  const own = (linkFailures.get(jid) ?? []).filter((t) => t > now - HOUR);
  if (own.length) linkFailures.set(jid, own);
  else linkFailures.delete(jid);
  return own.length < LINK_JID_MAX;
}

export function recordLinkFailure(jid: string, now: number = Date.now()): void {
  const own = (linkFailures.get(jid) ?? []).filter((t) => t > now - HOUR);
  own.push(now);
  linkFailures.delete(jid);
  linkFailures.set(jid, own.slice(-LINK_JID_MAX));
  capKeys(linkFailures);
  globalLinkFailures = globalLinkFailures.filter((t) => t > now - HOUR);
  globalLinkFailures.push(now);
  if (globalLinkFailures.length > LINK_GLOBAL_MAX) globalLinkFailures = globalLinkFailures.slice(-LINK_GLOBAL_MAX);
}

/**
 * Devolve a reserva mais recente do jid (tentativa que acabou em vínculo bem-sucedido):
 * remove a última falha do jid e a mesma entrada da lista global. Sem entradas: no-op.
 */
export function releaseLinkAttempt(jid: string): void {
  const own = linkFailures.get(jid);
  if (!own || own.length === 0) return;
  const ts = own.pop() as number;
  if (own.length) linkFailures.set(jid, own);
  else linkFailures.delete(jid);
  const idx = globalLinkFailures.lastIndexOf(ts);
  if (idx !== -1) globalLinkFailures.splice(idx, 1);
}

/** Apenas para testes. */
export function _resetUsage(): void {
  users.clear();
  unknownReplies.clear();
  linkFailures.clear();
  globalLinkFailures = [];
}
