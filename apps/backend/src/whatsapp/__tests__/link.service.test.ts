import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/prisma', () => {
  const p: any = {
    whatsappLinkCode: { deleteMany: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
    user: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  };
  p.$transaction.mockImplementation(async (fn: any) => fn(p));
  return { prisma: p };
});

import { prisma } from '../../config/prisma';
import { createLinkCode, consumeLinkCode, findUserIdByJid, unlink, getStatus } from '../link.service';

const db = prisma as any;
const future = () => new Date(Date.now() + 60_000);

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (fn: any) => fn(db));
  db.user.findFirst.mockResolvedValue(null);
});

describe('createLinkCode', () => {
  it('substitui o anterior e gera 6 dígitos', async () => {
    db.whatsappLinkCode.deleteMany.mockResolvedValue({ count: 1 });
    db.whatsappLinkCode.create.mockImplementation(async ({ data }: any) => data);
    const r = await createLinkCode(7);
    expect(db.whatsappLinkCode.deleteMany).toHaveBeenCalledWith({ where: { userId: 7 } });
    expect(r.code).toMatch(/^\d{6}$/);
    expect(r.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
  it('tenta de novo em colisão de código (P2002)', async () => {
    db.whatsappLinkCode.deleteMany.mockResolvedValue({ count: 0 });
    db.whatsappLinkCode.create
      .mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'P2002' }))
      .mockImplementation(async ({ data }: any) => data);
    const r = await createLinkCode(7);
    expect(r.code).toMatch(/^\d{6}$/);
    expect(db.whatsappLinkCode.create).toHaveBeenCalledTimes(2);
  });
});

describe('consumeLinkCode', () => {
  it('vincula com código válido; segundo uso é invalid', async () => {
    db.whatsappLinkCode.findUnique.mockResolvedValueOnce({ userId: 3, code: '123456', expiresAt: future() });
    db.whatsappLinkCode.deleteMany.mockResolvedValueOnce({ count: 1 });
    const r = await consumeLinkCode('123456', 'a@s.whatsapp.net', '5511999998888');
    expect(r).toEqual({ status: 'linked', userId: 3 });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { whatsappJid: 'a@s.whatsapp.net', whatsappPhone: '5511999998888' },
    });
    db.whatsappLinkCode.findUnique.mockResolvedValueOnce(null);
    expect(await consumeLinkCode('123456', 'a@s.whatsapp.net', '5511999998888')).toEqual({ status: 'invalid' });
  });
  it('corrida: deleteMany count 0 vira invalid e não grava', async () => {
    db.whatsappLinkCode.findUnique.mockResolvedValue({ userId: 3, code: '123456', expiresAt: future() });
    db.whatsappLinkCode.deleteMany.mockResolvedValue({ count: 0 });
    expect(await consumeLinkCode('123456', 'j', null)).toEqual({ status: 'invalid' });
    expect(db.user.update).not.toHaveBeenCalled();
  });
  it('expirado e inexistente são invalid', async () => {
    db.whatsappLinkCode.findUnique.mockResolvedValueOnce({ userId: 3, code: '1', expiresAt: new Date(Date.now() - 1000) });
    expect(await consumeLinkCode('000001', 'j', null)).toEqual({ status: 'invalid' });
    db.whatsappLinkCode.findUnique.mockResolvedValueOnce(null);
    expect(await consumeLinkCode('000002', 'j', null)).toEqual({ status: 'invalid' });
    expect(db.user.update).not.toHaveBeenCalled();
  });
  it('jid de outro usuário: in_use e código não consumido', async () => {
    db.whatsappLinkCode.findUnique.mockResolvedValue({ userId: 3, code: '123456', expiresAt: future() });
    db.user.findFirst.mockResolvedValue({ id: 9 });
    expect(await consumeLinkCode('123456', 'j', '5511999998888')).toEqual({ status: 'in_use' });
    expect(db.whatsappLinkCode.deleteMany).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
    const where = db.user.findFirst.mock.calls[0][0].where;
    expect(where.id).toEqual({ not: 3 });
    expect(JSON.stringify(where.OR)).toContain('551199998888');
  });
  it('relink com phone null limpa o phone antigo; com phone, define', async () => {
    db.whatsappLinkCode.findUnique.mockResolvedValue({ userId: 3, code: '123456', expiresAt: future() });
    db.whatsappLinkCode.deleteMany.mockResolvedValue({ count: 1 });
    await consumeLinkCode('123456', 'x@lid', null);
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: 3 }, data: { whatsappJid: 'x@lid', whatsappPhone: null } });
    await consumeLinkCode('123456', 'y@s.whatsapp.net', '5511999998888');
    expect(db.user.update).toHaveBeenLastCalledWith({ where: { id: 3 }, data: { whatsappJid: 'y@s.whatsapp.net', whatsappPhone: '5511999998888' } });
  });
});

describe('findUserIdByJid', () => {
  it('acha por jid', async () => {
    db.user.findUnique.mockResolvedValue({ id: 5 });
    expect(await findUserIdByJid('j', null)).toBe(5);
  });
  it('na falta, acha por variante do 9º dígito', async () => {
    db.user.findUnique.mockResolvedValue(null);
    db.user.findFirst.mockResolvedValue({ id: 6 });
    expect(await findUserIdByJid('j', '551199998888')).toBe(6);
    expect(db.user.findFirst.mock.calls[0][0].where.whatsappPhone.in).toContain('5511999998888');
  });
  it('null sem jid nem phone', async () => {
    db.user.findUnique.mockResolvedValue(null);
    expect(await findUserIdByJid('j', null)).toBeNull();
  });
});

describe('unlink / getStatus', () => {
  it('unlink limpa os dois campos e o código pendente', async () => {
    await unlink(4);
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: 4 }, data: { whatsappJid: null, whatsappPhone: null } });
    expect(db.whatsappLinkCode.deleteMany).toHaveBeenCalledWith({ where: { userId: 4 } });
  });
  it('getStatus', async () => {
    db.user.findUnique.mockResolvedValue({ whatsappJid: 'j', whatsappPhone: '5511999998888' });
    expect(await getStatus(4)).toEqual({ linked: true, phone: '5511999998888' });
    db.user.findUnique.mockResolvedValue({ whatsappJid: null, whatsappPhone: null });
    expect(await getStatus(4)).toEqual({ linked: false, phone: null });
  });
});
