import { Router } from 'express';
import { budgetController } from '../controllers/budget.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', budgetController.findAll);
router.get('/:id', budgetController.findById);
router.post('/', budgetController.create);
router.patch('/:id', budgetController.update);
router.delete('/:id', budgetController.delete);

export default router;
