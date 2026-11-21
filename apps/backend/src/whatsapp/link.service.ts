import { randomInt } from 'crypto';
import { prisma } from '../config/prisma';
import { phoneVariants } from './phone';

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;

export type ConsumeResult =
  | { status: 'linked'; userId: number }
  | { status: 'invalid' }
  | { status: 'in_use' };

const generateCode = () => randomInt(0, 1_000_000).toString().padStart(6, '0');

export async function createLinkCode(userId: number): Promise<{ code: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateCode();
    try {
      // Substitui o código anterior do usuário (userId é único)
      await prisma.whatsappLinkCode.deleteMany({ where: { userId } });
      await prisma.whatsappLinkCode.create({ data: { userId, code, expiresAt } });
      return { code, expiresAt };
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') continue; // colisão do código (único global)
      throw err;
    }
  }
  throw new Error('Não foi possível gerar um código de vínculo');
}

export async function consumeLinkCode(
  code: string,
  jid: string,
  phone: string | null
): Promise<ConsumeResult> {
  return prisma.$transaction(async (tx) => {
    const entry = await tx.whatsappLinkCode.findUnique({ where: { code } });
    if (!entry || entry.expiresAt.getTime() <= Date.now()) return { status: 'invalid' };

    // Checa conflito ANTES de consumir: tentativa falha não queima o código do dono legítimo
    const conflict = await tx.user.findFirst({
      where: {
        id: { not: entry.userId },
        OR: [
          { whatsappJid: jid },
          ...(phone ? [{ whatsappPhone: { in: phoneVariants(phone) } }] : []),
        ],
      },
      select: { id: true },
    });
    if (conflict) return { status: 'in_use' };

    // Uso único e à prova de corrida: só um deleteMany apaga a linha
    const { count } = await tx.whatsappLinkCode.deleteMany({
      where: { code, expiresAt: { gt: new Date() } },
    });
    if (count !== 1) return { status: 'invalid' };

    await tx.user.update({
      where: { id: entry.userId },
      data: { whatsappJid: jid, whatsappPhone: phone },
    });
    return { status: 'linked', userId: entry.userId };
  });
}

export async function findUserIdByJid(jid: string, phone: string | null): Promise<number | null> {
  const byJid = await prisma.user.findUnique({ where: { whatsappJid: jid }, select: { id: true } });
  if (byJid) return byJid.id;
  if (!phone) return null;
  const byPhone = await prisma.user.findFirst({
    where: { whatsappPhone: { in: phoneVariants(phone) } },
    select: { id: true },
  });
  return byPhone?.id ?? null;
}

export async function unlink(userId: number): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { whatsappJid: null, whatsappPhone: null },
  });
  await prisma.whatsappLinkCode.deleteMany({ where: { userId } });
}

export async function getStatus(userId: number): Promise<{ linked: boolean; phone: string | null }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { whatsappJid: true, whatsappPhone: true },
  });
  return { linked: !!user?.whatsappJid, phone: user?.whatsappPhone ?? null };
}
