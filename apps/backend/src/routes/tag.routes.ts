import { Router } from 'express';
import { tagController } from '../controllers/tag.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', tagController.findAll);
router.post('/', tagController.create);
router.patch('/:id', tagController.update);
router.delete('/:id', tagController.delete);

export default router;
