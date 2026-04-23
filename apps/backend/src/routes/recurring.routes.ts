import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { recurringController } from '../controllers/recurring.controller';

const router = Router();

router.use(authenticate);

router.get('/', recurringController.list);
router.get('/:id', recurringController.get);
router.post('/', recurringController.create);
router.patch('/:id', recurringController.update);
router.delete('/:id', recurringController.delete);

export default router;
