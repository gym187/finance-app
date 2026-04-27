import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL ?? 'admin@financeapp.com';
  const password = process.env.ADMIN_PASSWORD ?? 'Admin@123';
  const name = process.env.ADMIN_NAME ?? 'Admin';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Just promote to ADMIN if already exists
    await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
    console.log(`Usuário ${email} já existe — promovido para ADMIN.`);
    return;
  }

  const hashed = await bcrypt.hash(password, 12);

  const plan = await prisma.plan.findUnique({ where: { slug: 'pro' } });
  if (!plan) {
    console.error('Plano "pro" não encontrado. Rode a migração 20260426000003 primeiro.');
    process.exit(1);
  }

  await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      emailVerified: true,
      role: 'ADMIN',
      subscription: {
        create: {
          planId: plan.id,
          status: 'ACTIVE',
        },
      },
    },
  });

  console.log('');
  console.log('✓ Usuário admin criado com sucesso!');
  console.log(`  Email:  ${email}`);
  console.log(`  Senha:  ${password}`);
  console.log('');
  console.log('Troque a senha após o primeiro login.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
