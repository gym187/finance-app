import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.get('/', dashboardController.getData);
router.get('/projection', dashboardController.getProjection);

export default router;
