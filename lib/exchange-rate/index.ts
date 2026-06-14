/**
 * Exchange Rate Provider Abstraction
 *
 * To switch providers: change the `activeProvider` export at the bottom.
 * Business logic (convertToUsd) never references a provider directly.
 */

// ─── Provider interface ────────────────────────────────────────────────────

export interface ExchangeRateResult {
  rate:       number;   // 1 unit of fromCurrency = rate USD
  date:       string;   // YYYY-MM-DD of the rate
  provider:   string;   // human-readable provider name
  isFallback: boolean;  // true = estimated rate, not live
}

export interface ExchangeRateProvider {
  name: string;
  /** Returns how many USD 1 unit of fromCurrency equals. */
  getRate(fromCurrency: string): Promise<ExchangeRateResult>;
}

// ─── Provider 1: open.er-api.com (free, no API key) ───────────────────────

export const openErApiProvider: ExchangeRateProvider = {
  name: 'open.er-api.com',

  async getRate(fromCurrency: string): Promise<ExchangeRateResult> {
    if (fromCurrency === 'USD') {
      return { rate: 1, date: today(), provider: this.name, isFallback: false };
    }
    // Returns rates relative to USD base
    const res = await fetch(`https://open.er-api.com/v6/latest/USD`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`open.er-api.com returned ${res.status}`);
    const json = await res.json();
    const rateToUsd = json.rates?.[fromCurrency];
    if (!rateToUsd) throw new Error(`No rate found for ${fromCurrency}`);
    // json.rates[ILS] = how many ILS per 1 USD, so 1 ILS = 1/rate USD
    return {
      rate:       parseFloat((1 / rateToUsd).toFixed(8)),
      date:       (json.time_last_update_utc as string).slice(0, 10),
      provider:   this.name,
      isFallback: false,
    };
  },
};

// ─── Provider 2: hardcoded fallback (temporary — clearly marked) ──────────
// Update these rates periodically if the primary provider is unavailable.
// Last updated: 2026-06-14

const FALLBACK_RATES_TO_USD: Record<string, number> = {
  USD: 1.0,
  ILS: 0.272,   // 1 ILS ≈ 0.272 USD  (Jun 2026 estimate)
  EUR: 1.080,   // 1 EUR ≈ 1.08  USD
  GBP: 1.270,   // 1 GBP ≈ 1.27  USD
  JPY: 0.0066,  // 1 JPY ≈ 0.0066 USD
  CHF: 1.115,
  CAD: 0.730,
  AUD: 0.645,
};

export const fallbackProvider: ExchangeRateProvider = {
  name: 'hardcoded-fallback',

  async getRate(fromCurrency: string): Promise<ExchangeRateResult> {
    const rate = FALLBACK_RATES_TO_USD[fromCurrency.toUpperCase()];
    if (!rate) throw new Error(`No fallback rate for ${fromCurrency}`);
    return {
      rate,
      date:       today(),
      provider:   this.name,
      isFallback: true,
    };
  },
};

// ─── Slot for future paid provider (Fixer.io, XE, etc.) ──────────────────
// Uncomment and configure when ready; then set activeProvider = paidProvider.
//
// const FIXER_API_KEY = process.env.NEXT_PUBLIC_FIXER_API_KEY;
// export const fixerProvider: ExchangeRateProvider = { name: 'fixer.io', ... };

// ─── Active provider (swap this one line to change globally) ──────────────
export const activeProvider: ExchangeRateProvider = openErApiProvider;

// ─── Public API ───────────────────────────────────────────────────────────

export interface ConversionResult {
  usdAmount:        number;
  exchangeRate:     number;
  exchangeRateDate: string;
  isFallback:       boolean;
}

/**
 * Convert an amount in any currency to USD.
 * Falls back to hardcoded rates if the active provider is unreachable.
 * For existing records: store result at import time and never re-convert.
 */
export async function convertToUsd(
  amount: number,
  fromCurrency: string
): Promise<ConversionResult> {
  const code = (fromCurrency || 'USD').toUpperCase().trim();
  if (code === 'USD' || !code) {
    return { usdAmount: amount, exchangeRate: 1, exchangeRateDate: today(), isFallback: false };
  }

  let result: ExchangeRateResult;
  try {
    result = await activeProvider.getRate(code);
  } catch (primaryErr) {
    console.warn(`[exchange-rate] ${activeProvider.name} failed (${(primaryErr as Error).message}), using fallback`);
    try {
      result = await fallbackProvider.getRate(code);
    } catch (fallbackErr) {
      console.error(`[exchange-rate] fallback also failed for ${code}:`, (fallbackErr as Error).message);
      // Last resort: 1:1 with a warning
      return { usdAmount: amount, exchangeRate: 1, exchangeRateDate: today(), isFallback: true };
    }
  }

  const usdAmount = Math.round(amount * result.rate * 100) / 100;
  return {
    usdAmount,
    exchangeRate:     result.rate,
    exchangeRateDate: result.date,
    isFallback:       result.isFallback,
  };
}

/** All currencies with their display symbols. */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', ILS: '₪', EUR: '€', GBP: '£', JPY: '¥', CHF: 'CHF ', CAD: 'C$', AUD: 'A$',
};

export const SUPPORTED_CURRENCIES = Object.keys(CURRENCY_SYMBOLS);

export function currencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code.toUpperCase()] ?? `${code} `;
}

// ─── internal helpers ─────────────────────────────────────────────────────
function today(): string { return new Date().toISOString().slice(0, 10); }
