import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { notificationController } from '../controllers/notification.controller';

const router = Router();

router.use(authenticate);

router.get('/', notificationController.list);
router.patch('/read-all', notificationController.markAllRead);
router.patch('/:id/read', notificationController.markRead);
router.delete('/:id', notificationController.delete);

export default router;
