import type { Request, Response } from 'express';

// Stub: a Task 10 substitui o corpo por handleIncoming.
export function whatsappWebhookController(_req: Request, res: Response): void {
  res.status(200).json({ success: true });
}
