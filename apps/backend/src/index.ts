import { app } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/prisma';
import { startBot } from './bot/bot';
import { recurringService } from './services/recurring.service';
import { notificationService } from './services/notification.service';

const PORT = parseInt(env.PORT, 10);

async function main() {
  try {
    await prisma.$connect();
    logger.info('Banco de dados conectado');

    app.listen(PORT, () => {
      logger.info({ port: PORT, env: env.NODE_ENV }, `Backend rodando em http://localhost:${PORT}`);
    });

    const generated = await recurringService.processDue();
    if (generated > 0) logger.info({ generated }, 'Transações recorrentes geradas no startup');

    notificationService.checkLoanDueAlerts().catch(() => {});

    setInterval(async () => {
      try {
        const n = await recurringService.processDue();
        if (n > 0) logger.info({ generated: n }, 'Transações recorrentes geradas');
      } catch (err) {
        logger.error({ err }, 'Erro ao processar recorrências');
      }
      notificationService.checkLoanDueAlerts().catch(() => {});
    }, 60 * 60 * 1000);

    if (env.TELEGRAM_BOT_TOKEN) {
      startBot(app);
      logger.info('Telegram Bot iniciado');
    } else {
      logger.debug('TELEGRAM_BOT_TOKEN não configurado — bot desabilitado');
    }
  } catch (err) {
    logger.error({ err }, 'Falha ao iniciar servidor');
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();

process.on('SIGTERM', async () => {
  logger.info('SIGTERM recebido — encerrando graciosamente');
  await prisma.$disconnect();
  process.exit(0);
});
