/**
 * Normaliza um telefone brasileiro para apenas dígitos com DDI 55.
 * Retorna null se o resultado não tiver 12–13 dígitos começando com 55.
 */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (!/^55\d{10,11}$/.test(digits)) return null;
  return digits;
}

/**
 * Retorna o número e a variante com/sem o 9 após o DDD, sem duplicatas.
 */
export function phoneVariants(phone: string): string[] {
  const variants = new Set<string>([phone]);
  if (phone.length === 13 && phone.startsWith('55') && phone[4] === '9') {
    variants.add(phone.slice(0, 4) + phone.slice(5));
  } else if (phone.length === 12 && phone.startsWith('55')) {
    variants.add(phone.slice(0, 4) + '9' + phone.slice(4));
  }
  return [...variants];
}
