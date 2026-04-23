import { logger } from '../config/logger';

export const SUPPORTED_CURRENCIES = ['BRL', 'USD', 'EUR', 'GBP', 'BTC'] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

// rates[currency] = how many BRL equals 1 unit of that currency
type RateMap = Record<string, number>;

interface Cache {
  rates: RateMap;
  fetchedAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h
let cache: Cache | null = null;

async function fetchFiatRates(): Promise<RateMap> {
  // Frankfurter returns rates relative to base; we use USD as pivot
  const res = await fetch('https://api.frankfurter.app/latest?base=USD&symbols=BRL,EUR,GBP', {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error('Frankfurter API error');
  const data = (await res.json()) as { rates: Record<string, number> };
  // data.rates = { BRL: 5.55, EUR: 0.92, GBP: 0.79 }
  const usdToBrl = data.rates.BRL;
  return {
    BRL: 1,
    USD: usdToBrl,
    EUR: usdToBrl / data.rates.EUR,
    GBP: usdToBrl / data.rates.GBP,
  };
}

async function fetchBtcRate(): Promise<number | null> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=brl',
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { bitcoin: { brl: number } };
    return data.bitcoin.brl;
  } catch {
    return null;
  }
}

export const exchangeService = {
  async getRates(): Promise<RateMap> {
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
      return cache.rates;
    }

    try {
      const [fiat, btc] = await Promise.all([fetchFiatRates(), fetchBtcRate()]);
      const rates: RateMap = { ...fiat };
      if (btc !== null) rates.BTC = btc;
      cache = { rates, fetchedAt: Date.now() };
      logger.info({ rates }, 'Cotações atualizadas');
      return rates;
    } catch (err) {
      logger.error({ err }, 'Erro ao buscar cotações — usando cache ou padrão');
      if (cache) return cache.rates;
      // Fallback hardcoded (never reached in normal operation)
      return { BRL: 1, USD: 5.7, EUR: 6.2, GBP: 7.3, BTC: 350000 };
    }
  },

  async convertToBRL(amount: number, currency: string): Promise<{ amountBRL: number; rate: number }> {
    if (currency === 'BRL') return { amountBRL: amount, rate: 1 };
    const rates = await this.getRates();
    const rate = rates[currency];
    if (!rate) throw new Error(`Moeda não suportada: ${currency}`);
    return { amountBRL: amount * rate, rate };
  },

  invalidateCache() {
    cache = null;
  },
};
