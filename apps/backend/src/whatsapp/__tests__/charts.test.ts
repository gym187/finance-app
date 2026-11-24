import { describe, it, expect } from 'vitest';
import { categoryDonutPng, incomeExpenseLinePng } from '../charts';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

describe('categoryDonutPng', () => {
  it('gera PNG para várias categorias', () => {
    const png = categoryDonutPng(
      [
        { name: 'Casa', value: 70, color: '#d9559a' },
        { name: 'Comida', value: 146, color: '#e0524d' },
      ],
      'Despesas'
    );
    expect(png.subarray(0, 4)).toEqual(PNG);
  });

  it('uma única categoria, mais de 8 categorias e cor/nome malformados não quebram', () => {
    expect(categoryDonutPng([{ name: 'A', value: 10, color: '#fff' }], 't').subarray(0, 4)).toEqual(PNG);
    const many = Array.from({ length: 12 }, (_, i) => ({ name: `<b>&"${i}'`, value: i + 1, color: 'red;" onload="x' }));
    expect(categoryDonutPng(many, 't').subarray(0, 4)).toEqual(PNG);
  });
});

describe('incomeExpenseLinePng', () => {
  it('gera PNG com um ponto, vários pontos e tudo zerado', () => {
    expect(incomeExpenseLinePng([{ label: 'nov', income: 5, expense: 3 }], 't').subarray(0, 4)).toEqual(PNG);
    const zeros = Array.from({ length: 6 }, (_, i) => ({ label: `d${i}`, income: 0, expense: 0 }));
    expect(incomeExpenseLinePng(zeros, 't').subarray(0, 4)).toEqual(PNG);
    expect(incomeExpenseLinePng([], 't').subarray(0, 4)).toEqual(PNG);
    const many = Array.from({ length: 120 }, (_, i) => ({ label: `m${i}`, income: i * 10, expense: i * 7 }));
    expect(incomeExpenseLinePng(many, 't').subarray(0, 4)).toEqual(PNG);
  });
});
