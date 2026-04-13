import { Router } from 'express';
import { transactionController } from '../controllers/transaction.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/export', transactionController.exportCSV);
router.get('/', transactionController.findAll);
router.get('/:id', transactionController.findById);
router.post('/', transactionController.create);
router.patch('/:id', transactionController.update);
router.delete('/:id', transactionController.delete);

export default router;
