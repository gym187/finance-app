import { Router } from 'express';
import authRoutes from './auth.routes';
import transactionRoutes from './transaction.routes';
import categoryRoutes from './category.routes';
import budgetRoutes from './budget.routes';
import dashboardRoutes from './dashboard.routes';
import investmentRoutes from './investment.routes';
import recurringRoutes from './recurring.routes';
import goalRoutes from './goal.routes';
import loanRoutes from './loan.routes';
import importRoutes from './import.routes';
import tagRoutes from './tag.routes';
import exchangeRoutes from './exchange.routes';
import pushRoutes from './push.routes';
import notificationRoutes from './notification.routes';
import adminRoutes from './admin.routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/transactions', transactionRoutes);
router.use('/categories', categoryRoutes);
router.use('/budgets', budgetRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/investments', investmentRoutes);
router.use('/recurring', recurringRoutes);
router.use('/goals', goalRoutes);
router.use('/loans', loanRoutes);
router.use('/import', importRoutes);
router.use('/tags', tagRoutes);
router.use('/exchange', exchangeRoutes);
router.use('/push', pushRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);

export default router;
