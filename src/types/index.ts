export type MarketType = 'NSE' | 'BSE' | 'US' | 'INDEX';

export interface PriceBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockInfo {
  symbol: string;
  displaySymbol: string;
  longName: string;
  market: MarketType;
  currency: string;
  currencySymbol: string;
  sector: string;
  industry: string;
  country: string;
  website: string;
  longBusinessSummary: string;
  ceo: string;
  trailingPE: number;
  forwardPE: number;
  trailingEps: number;
  marketCap: number;
  dividendYield: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  beta: number;
}

export interface IndicatorData extends PriceBar {
  sma20?: number;
  sma50?: number;
  sma100?: number;
  sma200?: number;
  ema20?: number;
  ema50?: number;
  rsi14?: number;
  macd?: number;
  macdSignal?: number;
  macdHist?: number;
  bbUpper?: number;
  bbMiddle?: number;
  bbLower?: number;
  atr14?: number;
  supertrend?: number;
  trendDir?: 'up' | 'down';
  fib0?: number;
  fib236?: number;
  fib382?: number;
  fib500?: number;
  fib618?: number;
  fib786?: number;
  fib100?: number;
  pivotP?: number;
  pivotR1?: number;
  pivotR2?: number;
  pivotS1?: number;
  pivotS2?: number;
}

export interface RiskAnalysis {
  annual_volatility_pct: number;
  max_drawdown_pct: number;
  beta: number;
  risk_label: 'Low' | 'Moderate' | 'High';
}

export interface AnalysisResult {
  symbol: string;
  displaySymbol: string;
  market: MarketType;
  currencySymbol: string;
  currencyFmt: (n: number) => string;
  latestPrice: number;
  change: number;
  changePct: number;
  confidence: number;
  signal: 'BUY' | 'SELL' | 'HOLD';
  score: number;
  reasons: string[];
  risk: RiskAnalysis;
  forecastNextDay: number;
  forecast7d: number[];
  forecast30: number[];
  trainLen: number;
  predictions: number[];
  actual: number[];
  df: IndicatorData[];
  info: StockInfo;
}

export interface PortfolioHolding {
  id: string;
  market: MarketType;
  symbol: string;
  quantity: number;
  buyPrice: number;
  dateAdded: string;
}

export interface WatchlistItem {
  symbol: string;
  market: MarketType;
}

export interface PriceAlert {
  id: string;
  symbol: string;
  market: MarketType;
  targetPrice: number;
  direction: 'above' | 'below';
  createdAt: string;
  triggered?: boolean;
  alertType?: 'price' | 'dividend_yield';
  targetYield?: number;
}

export interface DividendPayout {
  date: string;
  amount: number;
  type?: string;
  year: number;
  status?: 'paid' | 'expected' | 'announced';
  recordDate?: string;
  paymentDate?: string;
  exDate?: string;
  isUpcoming?: boolean;
  yieldOnPrice?: number;
  notes?: string;
}

export interface DividendResponse {
  success: boolean;
  hasDividends?: boolean;
  symbol: string;
  currencySymbol: string;
  dividendYield: number;
  annualPayout: number;
  payoutRatio?: number;
  growthRate5Y?: number;
  frequency?: string;
  dividends: DividendPayout[];
  upcomingDividends?: DividendPayout[];
  allDividends?: DividendPayout[];
  yearlyTotals: Array<{ year: string; total: number; count: number }>;
  nextExpectedDate?: string;
  nextExpectedAmount?: number;
  nextExpectedType?: string;
  daysUntilNext?: number;
  lastExDate?: string;
  lastDividendAmount?: number;
  source?: string;
}

export interface MarketDividendItem {
  symbol: string;
  fullTicker: string;
  name: string;
  market: MarketType;
  price: number;
  currency: string;
  exDividendDate: string | null;
  paymentDate?: string | null;
  dividendRate: number | null;
  dividendYield: number;
  isUpcoming: boolean;
  daysUntilExDate?: number | null;
  frequency?: string;
}

export interface UserProfile {
  username: string;
  email: string;
  phone: string;
  twoFactorEnabled: boolean;
  totpSecret?: string;
  emailAlertsEnabled: boolean;
  smsAlertsEnabled: boolean;
  smtpHost?: string;
  smtpPort?: number;
  twilioSid?: string;
  angelApiKey?: string;
  angelClientCode?: string;
  angelPin?: string;
  angelTotpSecret?: string;
}

export interface PaperAccount {
  cash: number;
  initialCash: number;
  positions: { [symbol: string]: { quantity: number; avgPrice: number; market: MarketType } };
  history: Array<{
    id: string;
    date: string;
    type: 'BUY' | 'SELL';
    symbol: string;
    shares: number;
    price: number;
    total: number;
  }>;
}

export interface JournalTrade {
  id: string;
  symbol: string;
  market: MarketType;
  type: 'BUY' | 'SELL';
  category: 'Intraday' | 'Swing' | 'Positional' | 'Options/F&O' | 'Scalp';
  entryDate: string;
  entryPrice: number;
  quantity: number;
  exitDate?: string;
  exitPrice?: number;
  stopLoss?: number;
  target?: number;
  status: 'OPEN' | 'CLOSED';
  pnl?: number;
  pnlPercent?: number;
  strategyTag: string;
  emotionTag?: string;
  notes?: string;
  createdAt: string;
}

export interface TrackRecordSignal {
  id: string;
  symbol: string;
  market: MarketType;
  signalDate: string;
  signalType: 'BUY' | 'SELL' | 'HOLD';
  entryPrice: number;
  predictedTarget7d: number;
  stopLoss: number;
  actualPrice?: number;
  highestPrice?: number;
  lowestPrice?: number;
  outcomeStatus: 'TARGET HIT' | 'STOPLOSS HIT' | 'IN PROGRESS' | 'EXPIRED';
  gainPercent: number;
  confidence: number;
  aiScore: number;
  horizonDays: number;
  reasons: string[];
}

