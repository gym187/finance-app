import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/requireAdmin.middleware';
import { adminController } from '../controllers/admin.controller';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/metrics', adminController.getMetrics);
router.get('/users', adminController.listUsers);
router.post('/users', adminController.createUser);
router.get('/users/:id', adminController.getUser);
router.patch('/users/:id', adminController.updateUser);
router.patch('/users/:id/subscription', adminController.updateSubscription);
router.get('/plans', adminController.listPlans);
router.post('/plans', adminController.upsertPlan);

export default router;
