import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { pushController } from '../controllers/push.controller';

const router = Router();

router.get('/vapid-key', pushController.getVapidKey);
router.post('/subscribe', authenticate, pushController.subscribe);
router.post('/unsubscribe', authenticate, pushController.unsubscribe);

export default router;
