import OpenAI, { toFile } from 'openai';
import { env } from '../config/env';

export type LlmMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; toolCalls?: { id: string; name: string; arguments: string }[] }
  | { role: 'tool'; toolCallId: string; content: string };

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface LlmClient {
  transcribe(audio: Buffer): Promise<string>;
  complete(
    messages: LlmMessage[],
    tools: ToolDef[],
  ): Promise<{ content: string | null; toolCalls: { id: string; name: string; arguments: string }[] }>;
}

function getSdk(): OpenAI {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY não configurada: assistente de IA indisponível.');
  }
  return new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 30_000, maxRetries: 1 });
}

function toSdkMessage(m: LlmMessage): OpenAI.Chat.ChatCompletionMessageParam {
  if (m.role === 'tool') return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
  if (m.role === 'assistant') {
    if (m.toolCalls && m.toolCalls.length > 0) {
      return {
        role: 'assistant',
        content: m.content,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
    }
    return { role: 'assistant', content: m.content };
  }
  return { role: m.role, content: m.content };
}

export const openaiClient: LlmClient = {
  async transcribe(audio) {
    const openai = getSdk();
    const file = await toFile(audio, 'audio.ogg');
    const res = await openai.audio.transcriptions.create({
      file,
      model: env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe',
      language: 'pt',
    });
    return res.text ?? '';
  },

  async complete(messages, tools) {
    const openai = getSdk();
    const res = await openai.chat.completions.create({
      model: env.OPENAI_CHAT_MODEL || 'gpt-5-nano',
      messages: messages.map(toSdkMessage),
      ...(tools.length > 0
        ? {
            tools: tools.map((t) => ({
              type: 'function' as const,
              function: { name: t.name, description: t.description, parameters: t.parameters },
            })),
          }
        : {}),
    });
    const msg = res.choices[0]?.message;
    const toolCalls = (msg?.tool_calls ?? []).flatMap((tc) =>
      tc.type === 'function' ? [{ id: tc.id, name: tc.function.name, arguments: tc.function.arguments }] : [],
    );
    return { content: msg?.content ?? null, toolCalls };
  },
};
