import { describe, it, expect } from 'vitest';
import { normalizePhone, phoneVariants } from '../phone';

describe('normalizePhone', () => {
  it('normaliza formato com máscara', () => {
    expect(normalizePhone('(11) 99999-8888')).toBe('5511999998888');
  });
  it('mantém DDI 55 existente', () => {
    expect(normalizePhone('+55 11 99999-8888')).toBe('5511999998888');
  });
  it('adiciona 55 a números de 10 dígitos', () => {
    expect(normalizePhone('1199998888')).toBe('551199998888');
  });
  it('retorna null para entradas inválidas', () => {
    expect(normalizePhone('123')).toBeNull();
    expect(normalizePhone('abc')).toBeNull();
  });
});

describe('phoneVariants', () => {
  it('gera variante sem o 9', () => {
    const v = phoneVariants('5511999998888');
    expect(v).toContain('5511999998888');
    expect(v).toContain('551199998888');
  });
  it('gera variante com o 9', () => {
    const v = phoneVariants('551199998888');
    expect(v).toContain('5511999998888');
    expect(v).toContain('551199998888');
  });
  it('não tem duplicatas', () => {
    const v = phoneVariants('5511999998888');
    expect(new Set(v).size).toBe(v.length);
  });
});
