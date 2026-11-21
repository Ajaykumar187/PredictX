import type { MarketType, StockInfo, AnalysisResult } from '../types/index.js';

export interface StockSearchResult {
  symbol: string;
  displaySymbol: string;
  longName: string;
  market: MarketType;
  sector: string;
  price: number;
  currencySymbol: string;
}

export function getNseStockUrl(symbol: string, market: MarketType = 'NSE'): string {
  const clean = symbol.toUpperCase().replace(/\.NS|\.BO/, '').replace('^', '').trim();

  if (clean === 'NIFTY' || clean === 'NIFTY 50' || clean === 'NIFTY50') {
    return 'https://www.nseindia.com/get-quotes/derivatives?symbol=NIFTY';
  }
  if (clean === 'BANKNIFTY' || clean === 'BANK NIFTY') {
    return 'https://www.nseindia.com/get-quotes/derivatives?symbol=BANKNIFTY';
  }
  if (clean === 'FINNIFTY' || clean === 'FIN NIFTY') {
    return 'https://www.nseindia.com/get-quotes/derivatives?symbol=FINNIFTY';
  }
  if (clean === 'MIDCPNIFTY' || clean === 'MIDCAP NIFTY') {
    return 'https://www.nseindia.com/get-quotes/derivatives?symbol=MIDCPNIFTY';
  }
  if (clean === 'SENSEX') {
    return 'https://www.bseindia.com/sensex/index.html';
  }
  if (market === 'BSE') {
    return `https://www.bseindia.com/stock-share-price/equity/${encodeURIComponent(clean)}/`;
  }
  if (market === 'US') {
    return `https://finance.yahoo.com/quote/${encodeURIComponent(clean)}`;
  }

  return `https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(clean)}`;
}

export function getStockInfo(symbol: string, market: MarketType): StockInfo {
  const norm = symbol.toUpperCase().replace(/\.NS|\.BO/, '').replace('^', '').trim();
  const isIndian = market === 'NSE' || market === 'BSE' || market === 'INDEX';

  return {
    symbol: isIndian ? `${norm}.NS` : norm,
    displaySymbol: norm,
    longName: norm,
    market,
    currency: isIndian ? 'INR' : 'USD',
    currencySymbol: isIndian ? '₹' : '$',
    sector: '',
    industry: '',
    country: '',
    website: getNseStockUrl(norm, market),
    longBusinessSummary: '',
    ceo: '',
    trailingPE: 0,
    forwardPE: 0,
    trailingEps: 0,
    marketCap: 0,
    dividendYield: 0,
    fiftyTwoWeekHigh: 0,
    fiftyTwoWeekLow: 0,
    beta: 0,
  };
}

export function formatCurrencyValue(val: number | undefined | null, market: MarketType): string {
  if (val === undefined || val === null || isNaN(val)) {
    return market === 'US' ? '$0.00' : '₹0.00';
  }
  const isIndian = market === 'NSE' || market === 'BSE' || market === 'INDEX';
  if (isIndian) {
    return '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ensureCurrencyFmt(a: AnalysisResult | null | undefined): AnalysisResult | null {
  if (!a) return null;
  if (typeof a.currencyFmt !== 'function') {
    const m = a.market || 'NSE';
    a.currencyFmt = (val: number) => formatCurrencyValue(val, m);
  }
  return a;
}

