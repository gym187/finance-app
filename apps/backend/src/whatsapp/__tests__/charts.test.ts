import { describe, it, expect } from 'vitest';
import { categoryDonutPng, summaryCardPng } from '../charts';

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

describe('summaryCardPng', () => {
  it('gera PNG com saldo positivo, negativo, sem entradas e tudo zerado', () => {
    for (const [income, expense] of [[2070.6, 387.09], [100, 500], [0, 50], [0, 0]]) {
      expect(summaryCardPng({ label: 'últimos 30 dias', income, expense }).subarray(0, 4)).toEqual(PNG);
    }
  });
});
