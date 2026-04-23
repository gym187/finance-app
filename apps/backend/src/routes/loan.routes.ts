import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { loanController } from '../controllers/loan.controller';

const router = Router();

router.use(authenticate);

router.get('/summary', loanController.summary);
router.get('/', loanController.list);
router.get('/:id', loanController.get);
router.post('/', loanController.create);
router.patch('/:id', loanController.update);
router.post('/:id/pay', loanController.pay);
router.get('/:id/payments', loanController.payments);
router.get('/:id/schedule', loanController.schedule);
router.delete('/:id', loanController.delete);

export default router;
