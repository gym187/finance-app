import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { goalController } from '../controllers/goal.controller';

const router = Router();

router.use(authenticate);

router.get('/', goalController.list);
router.get('/:id', goalController.get);
router.post('/', goalController.create);
router.patch('/:id', goalController.update);
router.post('/:id/contribute', goalController.contribute);
router.delete('/:id', goalController.delete);

export default router;
