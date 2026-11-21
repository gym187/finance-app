import { NextFunction, Response, Router } from 'express';
import { env } from '../config/env';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { createLinkCode, getStatus, unlink } from './link.service';

const router = Router();

type Handler = (req: AuthenticatedRequest, res: Response) => Promise<void>;
const wrap = (fn: Handler) => (req: AuthenticatedRequest, res: Response, next: NextFunction) =>
  fn(req, res).catch(next);

router.use(authenticate);

router.post('/link-code', wrap(async (req, res) => {
  const { code, expiresAt } = await createLinkCode(req.userId!);
  res.json({ success: true, data: { code, expiresAt, botNumber: env.WHATSAPP_BOT_NUMBER ?? null } });
}));

router.get('/status', wrap(async (req, res) => {
  res.json({ success: true, data: await getStatus(req.userId!) });
}));

router.delete('/link', wrap(async (req, res) => {
  await unlink(req.userId!);
  res.json({ success: true, data: null });
}));

export default router;
