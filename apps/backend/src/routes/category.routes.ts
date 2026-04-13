import { Router } from 'express';
import { categoryController } from '../controllers/category.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', categoryController.findAll);
router.get('/:id', categoryController.findById);
router.post('/', categoryController.create);
router.patch('/:id', categoryController.update);
router.delete('/:id', categoryController.delete);

export default router;
