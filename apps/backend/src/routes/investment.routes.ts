import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { investmentController } from '../controllers/investment.controller';

const router = Router();

router.use(authenticate);

router.get('/summary', investmentController.summary);
router.get('/', investmentController.list);
router.get('/:id', investmentController.get);
router.post('/', investmentController.create);
router.patch('/:id', investmentController.update);
router.delete('/:id', investmentController.delete);

export default router;
