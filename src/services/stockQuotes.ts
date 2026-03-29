/**
 * Wertpapier-Kursabfrage via Yahoo Finance (öffentliche API, kein Key nötig)
 * Unterstützt: ISIN-zu-Symbol-Suche, aktuelle Kurse, historische Daten
 */

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  currency: string;
  change: number;
  changePercent: number;
  previousClose: number;
  marketCap?: number;
  volume?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  exchange?: string;
  lastUpdated: Date;
}

export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
  isin?: string;
}

export interface HistoricalPoint {
  date: string;
  close: number;
}

// Yahoo Finance v8 API (CORS-freundlich über allorigins proxy)
const YF_BASE = 'https://query1.finance.yahoo.com/v8/finance';
const YF_SEARCH = 'https://query1.finance.yahoo.com/v1/finance/search';

// CORS-Proxy für Browser-Anfragen
const PROXY = 'https://api.allorigins.win/get?url=';

async function fetchWithProxy(url: string): Promise<unknown> {
  const encoded = encodeURIComponent(url);
  const res = await fetch(`${PROXY}${encoded}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const wrapper = await res.json();
  return JSON.parse(wrapper.contents);
}

/**
 * Sucht nach Wertpapieren anhand von Name, ISIN oder Ticker-Symbol
 */
export async function searchSecurities(query: string): Promise<SearchResult[]> {
  try {
    const url = `${YF_SEARCH}?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0&listsCount=0`;
    const data = await fetchWithProxy(url) as { quotes?: { symbol: string; longname?: string; shortname?: string; exchDisp?: string; typeDisp?: string }[] };
    const quotes = data?.quotes || [];
    return quotes
      .filter((q) => q.symbol && (q.longname || q.shortname))
      .map((q) => ({
        symbol: q.symbol,
        name: q.longname || q.shortname || q.symbol,
        exchange: q.exchDisp || '',
        type: q.typeDisp || 'Equity',
      }));
  } catch {
    return [];
  }
}

/**
 * Ruft den aktuellen Kurs für ein Symbol ab
 */
export async function getQuote(symbol: string): Promise<StockQuote | null> {
  try {
    const url = `${YF_BASE}/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const data = await fetchWithProxy(url) as {
      chart?: {
        result?: {
          meta?: {
            symbol: string;
            regularMarketPrice: number;
            currency: string;
            previousClose: number;
            regularMarketVolume: number;
            fiftyTwoWeekHigh: number;
            fiftyTwoWeekLow: number;
            exchangeName: string;
            longName?: string;
            shortName?: string;
          };
        }[];
      };
    };
    const result = data?.chart?.result?.[0];
    if (!result?.meta) return null;
    const meta = result.meta;
    const change = meta.regularMarketPrice - meta.previousClose;
    const changePercent = meta.previousClose > 0 ? (change / meta.previousClose) * 100 : 0;
    return {
      symbol: meta.symbol,
      name: meta.longName || meta.shortName || meta.symbol,
      price: meta.regularMarketPrice,
      currency: meta.currency || 'EUR',
      change,
      changePercent,
      previousClose: meta.previousClose,
      volume: meta.regularMarketVolume,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
      exchange: meta.exchangeName,
      lastUpdated: new Date(),
    };
  } catch {
    return null;
  }
}

/**
 * Ruft historische Kursdaten ab (für Performance-Charts)
 */
export async function getHistoricalData(symbol: string, range: '1mo' | '3mo' | '6mo' | '1y' | '2y' = '1y'): Promise<HistoricalPoint[]> {
  try {
    const url = `${YF_BASE}/chart/${encodeURIComponent(symbol)}?interval=1wk&range=${range}`;
    const data = await fetchWithProxy(url) as {
      chart?: {
        result?: {
          timestamp?: number[];
          indicators?: { quote?: { close?: (number | null)[] }[] };
        }[];
      };
    };
    const result = data?.chart?.result?.[0];
    if (!result?.timestamp) return [];
    const timestamps = result.timestamp;
    const closes = result.indicators?.quote?.[0]?.close || [];
    return timestamps
      .map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().split('T')[0],
        close: closes[i] ?? 0,
      }))
      .filter((p) => p.close > 0);
  } catch {
    return [];
  }
}

/**
 * Berechnet die Portfolio-Performance für mehrere Positionen
 */
export interface PortfolioPosition {
  symbol: string;
  name: string;
  quantity: number;
  purchasePrice: number;
  currentPrice?: number;
  currentValue?: number;
  gain?: number;
  gainPercent?: number;
  quote?: StockQuote;
}

export async function enrichPortfolioPositions(positions: PortfolioPosition[]): Promise<PortfolioPosition[]> {
  const enriched = await Promise.all(
    positions.map(async (pos) => {
      if (!pos.symbol) return pos;
      const quote = await getQuote(pos.symbol);
      if (!quote) return pos;
      const currentValue = quote.price * pos.quantity;
      const costBasis = pos.purchasePrice * pos.quantity;
      const gain = currentValue - costBasis;
      const gainPercent = costBasis > 0 ? (gain / costBasis) * 100 : 0;
      return { ...pos, quote, currentPrice: quote.price, currentValue, gain, gainPercent };
    })
  );
  return enriched;
}

/**
 * Formatiert einen Kurs mit Währungssymbol
 */
export function formatPrice(price: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}
