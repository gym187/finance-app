import { logger } from '../config/logger';
import type { IncomingMessage, WhatsappProvider } from './provider';
import type { LlmClient } from './llm';
import { seenBefore } from './webhook.guard';
import { findUserIdByJid, consumeLinkCode, unlink } from './link.service';
import { consume, allowUnknownReply, allowLinkAttempt, recordLinkFailure, releaseLinkAttempt } from './usage';
import { matchShortcut, runShortcut } from './shortcuts';
import { runAgent } from './agent';
import { confirmPending, cancelPending } from './tools';
import { getPending, appendHistory } from './conversation';

export type HandlerDeps = { provider: WhatsappProvider; llm: LlmClient };

const MAX_AUDIO_SECONDS = 120;
const MAX_AUDIO_BYTES = 3 * 1024 * 1024;
const LINK_CODE_RE = /^\d{6}$/;

const MSG = {
  linked: '✅ WhatsApp vinculado! Mande "ajuda" para ver o que posso fazer.',
  invalid: 'Código inválido ou expirado. Gere um novo no AppFin.',
  inUse: 'Este número já está vinculado a outra conta.',
  howToLink: 'Para usar, vincule seu número na página WhatsApp do AppFin.',
  window: 'Muitas mensagens em pouco tempo. Tente de novo em alguns minutos.',
  daily: 'Você atingiu o limite diário de mensagens. Volte amanhã.',
  other: 'Só entendo texto e áudio.',
  audioTooLong: 'Áudio muito longo (máx. 2 min). Mande um mais curto.',
  audioEmpty: 'Não entendi o áudio. Pode repetir?',
  unlinked: 'Número desvinculado.',
  failure: 'Não consegui processar agora, tenta de novo em instantes.',
} as const;

/** Fila por usuário: mensagens do mesmo userId rodam em sequência; a entrada some quando ociosa. */
const queues = new Map<number, Promise<void>>();

function enqueue(userId: number, task: () => Promise<void>): Promise<void> {
  const prev = queues.get(userId) ?? Promise.resolve();
  const run = prev.then(task);
  const tail = run.catch(() => undefined);
  queues.set(userId, tail);
  void tail.then(() => {
    if (queues.get(userId) === tail) queues.delete(userId);
  });
  return tail;
}

/** Nunca lança: falha de envio é só logada (sem o texto da mensagem). */
async function reply(deps: HandlerDeps, msg: IncomingMessage, text: string): Promise<void> {
  try {
    await deps.provider.sendText(msg.jid, text);
  } catch (err) {
    logger.error({ err, msgId: msg.id }, '[whatsapp] falha ao enviar resposta');
  }
}

/** Só nome e código do erro: mensagens do Prisma podem embutir argumentos (jid, telefone, código). */
function safeErr(err: unknown): { name?: string; code?: unknown } {
  if (err && typeof err === 'object') {
    const e = err as { name?: unknown; code?: unknown };
    return { name: typeof e.name === 'string' ? e.name : undefined, code: e.code };
  }
  return { name: typeof err };
}

async function handleUnknown(msg: IncomingMessage, deps: HandlerDeps): Promise<void> {
  const code = (msg.text ?? '').trim();
  if (msg.kind === 'text' && LINK_CODE_RE.test(code)) {
    // Anti força bruta: checa e RESERVA no mesmo passo síncrono (sem await entre eles),
    // para que rajadas concorrentes não passem todas com o contador ainda zerado.
    if (!allowLinkAttempt(msg.jid)) return; // bloqueado → silêncio total
    recordLinkFailure(msg.jid);
    let result: Awaited<ReturnType<typeof consumeLinkCode>>;
    try {
      result = await consumeLinkCode(code, msg.jid, msg.phone);
    } catch (err) {
      // a reserva fica: conta como falha
      logger.error({ err: safeErr(err), msgId: msg.id }, '[whatsapp] falha ao consumir código de vínculo');
      return;
    }
    if (result.status === 'linked') {
      releaseLinkAttempt(msg.jid);
      await reply(deps, msg, MSG.linked);
      return;
    }
    // invalid / in_use: a reserva já é a falha registrada
    await reply(deps, msg, result.status === 'in_use' ? MSG.inUse : MSG.invalid);
    return;
  }
  if (allowUnknownReply(msg.jid)) await reply(deps, msg, MSG.howToLink);
}

async function handleLinked(userId: number, msg: IncomingMessage, deps: HandlerDeps): Promise<void> {
  const usage = consume(userId);
  if (!usage.allowed) {
    if (usage.firstTime) await reply(deps, msg, usage.reason === 'daily' ? MSG.daily : MSG.window);
    return;
  }

  if (msg.kind === 'other') {
    await reply(deps, msg, MSG.other);
    return;
  }

  let text: string;
  let transcription: string | null = null;
  if (msg.kind === 'audio') {
    if ((msg.audioSeconds ?? 0) > MAX_AUDIO_SECONDS) {
      await reply(deps, msg, MSG.audioTooLong);
      return;
    }
    const audio = await deps.provider.getAudio(msg);
    if (audio.length > MAX_AUDIO_BYTES) {
      await reply(deps, msg, MSG.audioTooLong);
      return;
    }
    transcription = (await deps.llm.transcribe(audio)).trim();
    if (!transcription) {
      await reply(deps, msg, MSG.audioEmpty);
      return;
    }
    text = transcription;
  } else {
    text = (msg.text ?? '').trim();
    if (!text) return;
  }

  const shortcut = matchShortcut(text, getPending(userId) !== null);
  if (shortcut === 'sim' || shortcut === 'nao') {
    const out = shortcut === 'sim' ? await confirmPending(userId) : cancelPending(userId);
    appendHistory(userId, [
      { role: 'user', content: text },
      { role: 'assistant', content: out },
    ]);
    await reply(deps, msg, out);
    return;
  }
  if (shortcut === 'sair') {
    await unlink(userId);
    await reply(deps, msg, MSG.unlinked);
    return;
  }
  if (shortcut) {
    await reply(deps, msg, await runShortcut(userId, shortcut));
    return;
  }

  let out = await runAgent(userId, text, deps.llm);
  if (transcription !== null && getPending(userId) !== null) {
    out = `🎙️ Entendi: "${transcription}"\n\n${out}`;
  }
  await reply(deps, msg, out);
}

/**
 * Processa uma mensagem recebida. Nunca lança. Não loga texto, áudio, códigos nem telefones.
 */
export async function handleIncoming(msg: IncomingMessage, deps: HandlerDeps): Promise<void> {
  if (msg.fromMe || msg.isGroup) return;
  if (seenBefore(msg.id)) return;

  let userId: number | null;
  try {
    userId = await findUserIdByJid(msg.jid, msg.phone);
  } catch (err) {
    logger.error({ err: safeErr(err), msgId: msg.id }, '[whatsapp] falha ao identificar remetente');
    return;
  }

  if (userId === null) {
    try {
      await handleUnknown(msg, deps);
    } catch (err) {
      logger.error({ err: safeErr(err), msgId: msg.id }, '[whatsapp] falha ao tratar remetente desconhecido');
    }
    return;
  }

  const uid = userId;
  await enqueue(uid, async () => {
    try {
      await handleLinked(uid, msg, deps);
    } catch (err) {
      logger.error({ err, msgId: msg.id, userId: uid }, '[whatsapp] falha ao processar mensagem');
      await reply(deps, msg, MSG.failure);
    }
  });
}
