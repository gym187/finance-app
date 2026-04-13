import { app } from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { startBot } from './bot/bot';

const PORT = parseInt(env.PORT, 10);

async function main() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Banco de dados conectado');

    // Start Express server
    app.listen(PORT, () => {
      console.log(`🚀 Backend rodando em http://localhost:${PORT}`);
      console.log(`   Ambiente: ${env.NODE_ENV}`);
    });

    // Start Telegram Bot (if token is configured)
    if (env.TELEGRAM_BOT_TOKEN) {
      startBot(app);
      console.log('🤖 Telegram Bot iniciado');
    } else {
      console.log('ℹ️  TELEGRAM_BOT_TOKEN não configurado - bot desabilitado');
    }
  } catch (err) {
    console.error('❌ Falha ao iniciar servidor:', err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM recebido. Encerrando graciosamente...');
  await prisma.$disconnect();
  process.exit(0);
});
