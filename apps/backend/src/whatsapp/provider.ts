export interface IncomingMessage {
  id: string;
  jid: string;
  phone: string | null;
  fromMe: boolean;
  isGroup: boolean;
  kind: 'text' | 'audio' | 'other';
  text?: string;
  audioSeconds?: number;
}

export interface WhatsappProvider {
  parseWebhook(body: unknown): IncomingMessage | null;
  sendText(jid: string, text: string): Promise<void>;
  getAudio(msg: IncomingMessage): Promise<Buffer>;
}
