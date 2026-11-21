import { z } from 'zod';
import { env } from '../config/env';
import type { IncomingMessage, WhatsappProvider } from './provider';

const webhookSchema = z
  .object({
    event: z.string(),
    data: z
      .object({
        key: z
          .object({
            remoteJid: z.string().min(1),
            fromMe: z.boolean().optional(),
            id: z.string().min(1),
            remoteJidAlt: z.string().nullish(),
          })
          .passthrough(),
        message: z.record(z.unknown()).nullish(),
        senderPn: z.string().nullish(),
      })
      .passthrough(),
  })
  .passthrough();

const REAL_JID_SUFFIX = '@s.whatsapp.net';

function digitsOfRealJid(jid: string | null | undefined): string | null {
  if (!jid || !jid.endsWith(REAL_JID_SUFFIX)) return null;
  const digits = jid.slice(0, -REAL_JID_SUFFIX.length).split(':')[0].replace(/\D/g, '');
  return digits || null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/**
 * Isolated parser for the Evolution API v2 `messages.upsert` webhook.
 * Never throws; returns null for anything unexpected.
 */
function parseWebhook(body: unknown): IncomingMessage | null {
  try {
    const parsed = webhookSchema.safeParse(body);
    if (!parsed.success) return null;
    const { event, data } = parsed.data;
    if (event.toLowerCase().replace(/_/g, '.') !== 'messages.upsert') return null;

    const { key } = data;
    const jid = key.remoteJid;
    const isGroup = jid.endsWith('@g.us');
    const phone =
      digitsOfRealJid(jid) ?? digitsOfRealJid(key.remoteJidAlt) ?? digitsOfRealJid(data.senderPn);

    const message = asRecord(data.message) ?? {};
    let kind: IncomingMessage['kind'] = 'other';
    let text: string | undefined;
    let audioSeconds: number | undefined;

    const ext = asRecord(message.extendedTextMessage);
    const audio = asRecord(message.audioMessage);
    if (typeof message.conversation === 'string') {
      kind = 'text';
      text = message.conversation;
    } else if (ext && typeof ext.text === 'string') {
      kind = 'text';
      text = ext.text;
    } else if (audio) {
      kind = 'audio';
      if (typeof audio.seconds === 'number') audioSeconds = audio.seconds;
    }

    const msg: IncomingMessage = {
      id: key.id,
      jid,
      phone,
      fromMe: key.fromMe === true,
      isGroup,
      kind,
    };
    if (text !== undefined) msg.text = text;
    if (audioSeconds !== undefined) msg.audioSeconds = audioSeconds;
    return msg;
  } catch {
    return null;
  }
}

function baseUrl(): string {
  return (env.EVOLUTION_API_URL ?? '').replace(/\/+$/, '');
}

function headers(): Record<string, string> {
  return { 'Content-Type': 'application/json', apikey: env.EVOLUTION_API_KEY ?? '' };
}

function instancePath(): string {
  return encodeURIComponent(env.EVOLUTION_INSTANCE ?? '');
}

async function sendText(jid: string, text: string): Promise<void> {
  const res = await fetch(`${baseUrl()}/message/sendText/${instancePath()}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ number: jid, text }),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 200);
    throw Object.assign(new Error(`Evolution sendText falhou (${res.status}): ${detail}`), { status: res.status });
  }
}

async function getAudio(msg: IncomingMessage): Promise<Buffer> {
  const res = await fetch(`${baseUrl()}/chat/getBase64FromMediaMessage/${instancePath()}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      message: { key: { id: msg.id, remoteJid: msg.jid, fromMe: msg.fromMe } },
    }),
  });
  if (!res.ok) {
    throw Object.assign(new Error(`Evolution getBase64FromMediaMessage falhou (${res.status})`), {
      status: res.status,
    });
  }
  const json = (await res.json()) as { base64?: unknown };
  if (typeof json.base64 !== 'string' || !json.base64) {
    throw new Error('Evolution não retornou base64 do áudio');
  }
  return Buffer.from(json.base64, 'base64');
}

export const evolutionProvider: WhatsappProvider = { parseWebhook, sendText, getAudio };
