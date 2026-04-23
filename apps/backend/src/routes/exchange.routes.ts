import { Router } from 'express';
import { exchangeController } from '../controllers/exchange.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/rates', authenticate, exchangeController.getRates);

export default router;
