import type { MarketType } from '../types';
import type { PageId } from '../components/Sidebar';

export interface ParsedCommand {
  raw: string;
  text: string;
  alias?: StockRef;
  stockPhrase?: string;
  page?: PageId;
  isQuestion: boolean;
}

export interface StockRef {
  symbol: string;
  market: MarketType;
  name?: string;
}

const DEVANAGARI: Array<[RegExp, string]> = [
  [/दिखा\s?दो|दिखाइए|दिखाओ|दिखा/g, ' dikhao '],
  [/खोलिए|खोलो|खोल/g, ' kholo '],
  [/बताइए|बताओ|बता\s?दो|बता/g, ' batao '],
  [/क्या/g, ' kya '],
  [/कैसा|कैसी|कैसे/g, ' kaisa '],
  [/का|की|के|को/g, ' ka '],
  [/है|हैं/g, ' hai '],
  [/स्टॉप\s?लॉस/g, ' stop loss '],
  [/टारगेट/g, ' target '],
  [/स्टॉक/g, ' stock '],
  [/शेयर/g, ' share '],
  [/चार्ट/g, ' chart '],
  [/न्यूज़|न्यूज/g, ' news '],
  [/पोर्टफोलियो/g, ' portfolio '],
  [/वॉचलिस्ट/g, ' watchlist '],
];

const IN = (symbol: string, name?: string): StockRef => ({ symbol, market: 'NSE', name });
const US = (symbol: string, name?: string): StockRef => ({ symbol, market: 'US', name });
const IDX = (symbol: string, name?: string): StockRef => ({ symbol, market: 'NSE', name });

export const STOCK_ALIASES: Record<string, StockRef> = {
  reliance: IN('RELIANCE', 'Reliance Industries'), 'reliance industries': IN('RELIANCE'), रिलायंस: IN('RELIANCE'),
  tcs: IN('TCS', 'TCS'), 'tata consultancy': IN('TCS'), टीसीएस: IN('TCS'),
  infosys: IN('INFY', 'Infosys'), infy: IN('INFY'), इंफोसिस: IN('INFY'), इन्फोसिस: IN('INFY'),
  hdfc: IN('HDFCBANK', 'HDFC Bank'), 'hdfc bank': IN('HDFCBANK'), एचडीएफसी: IN('HDFCBANK'),
  icici: IN('ICICIBANK', 'ICICI Bank'), 'icici bank': IN('ICICIBANK'), आईसीआईसीआई: IN('ICICIBANK'),
  sbi: IN('SBIN', 'State Bank of India'), 'state bank': IN('SBIN'), 'state bank of india': IN('SBIN'), एसबीआई: IN('SBIN'),
  'tata motors': IN('TATAMOTORS', 'Tata Motors'), 'टाटा मोटर्स': IN('TATAMOTORS'),
  'tata steel': IN('TATASTEEL', 'Tata Steel'), 'टाटा स्टील': IN('TATASTEEL'),
  itc: IN('ITC', 'ITC'), आईटीसी: IN('ITC'),
  wipro: IN('WIPRO', 'Wipro'), विप्रो: IN('WIPRO'),
  adani: IN('ADANIENT', 'Adani Enterprises'), 'adani enterprises': IN('ADANIENT'), 'adani ports': IN('ADANIPORTS'), अडानी: IN('ADANIENT'),
  airtel: IN('BHARTIARTL', 'Bharti Airtel'), 'bharti airtel': IN('BHARTIARTL'), एयरटेल: IN('BHARTIARTL'),
  maruti: IN('MARUTI', 'Maruti Suzuki'), 'maruti suzuki': IN('MARUTI'), मारुति: IN('MARUTI'),
  kotak: IN('KOTAKBANK', 'Kotak Mahindra Bank'), 'kotak bank': IN('KOTAKBANK'), 'kotak mahindra': IN('KOTAKBANK'),
  'axis bank': IN('AXISBANK', 'Axis Bank'), axis: IN('AXISBANK'),
  'l and t': IN('LT', 'Larsen & Toubro'), 'l&t': IN('LT'), larsen: IN('LT'), 'larsen and toubro': IN('LT'),
  'bajaj finance': IN('BAJFINANCE', 'Bajaj Finance'), 'bajaj finserv': IN('BAJAJFINSV'),
  'asian paints': IN('ASIANPAINT', 'Asian Paints'),
  'sun pharma': IN('SUNPHARMA', 'Sun Pharma'),
  hul: IN('HINDUNILVR', 'Hindustan Unilever'), 'hindustan unilever': IN('HINDUNILVR'),
  titan: IN('TITAN', 'Titan'), ongc: IN('ONGC', 'ONGC'), ntpc: IN('NTPC', 'NTPC'), 'power grid': IN('POWERGRID'),
  coal: IN('COALINDIA', 'Coal India'), 'coal india': IN('COALINDIA'),
  zomato: IN('ZOMATO', 'Zomato'), eternal: IN('ETERNAL'), paytm: IN('PAYTM', 'Paytm'), jio: IN('JIOFIN', 'Jio Financial'),
  suzlon: IN('SUZLON', 'Suzlon'), 'yes bank': IN('YESBANK', 'Yes Bank'), irctc: IN('IRCTC', 'IRCTC'), 'vodafone idea': IN('IDEA'),
  nifty: IDX('NIFTY', 'Nifty 50'), 'nifty 50': IDX('NIFTY'), 'nifty fifty': IDX('NIFTY'), निफ्टी: IDX('NIFTY'),
  'bank nifty': IDX('BANKNIFTY', 'Bank Nifty'), banknifty: IDX('BANKNIFTY'), 'nifty bank': IDX('BANKNIFTY'),
  sensex: { symbol: 'SENSEX', market: 'BSE', name: 'Sensex' }, सेंसेक्स: { symbol: 'SENSEX', market: 'BSE', name: 'Sensex' },
  apple: US('AAPL', 'Apple'), tesla: US('TSLA', 'Tesla'), microsoft: US('MSFT', 'Microsoft'), nvidia: US('NVDA', 'Nvidia'),
  google: US('GOOGL', 'Alphabet'), alphabet: US('GOOGL'), amazon: US('AMZN', 'Amazon'), meta: US('META', 'Meta'), facebook: US('META'),
  netflix: US('NFLX', 'Netflix'), amd: US('AMD', 'AMD'),
};

const PAGE_KEYWORDS: Array<[RegExp, PageId]> = [
  [/\boption(s)?( chain| analy\w+)?\b|\bgreeks?\b/, 'options'],
  [/\bpaper trad\w*|\bvirtual trad\w*/, 'paper'],
  [/\bsmart money\b|\bfii\b|\bdii\b|\bfpi\b/, 'smartmoney'],
  [/\bportfolio\b/, 'portfolio'],
  [/\bwatch ?list\b/, 'watchlist'],
  [/\bnews\b|\bkhabar\b|\bsamachar\b|\bheadlines?\b/, 'news'],
  [/\bdividends?\b/, 'dividends'],
  [/\bipo\b|\bgmp\b/, 'ipo'],
  [/\bscanners?\b|\bbreakouts?\b/, 'scanners'],
  [/\bcompar(e|ison)\b|\bsplit view\b/, 'compare'],
  [/\bcharts?\b|\bgraphs?\b|\bcandles?\b/, 'charts'],
  [/\btrade journal\b|\bjournal\b/, 'journal'],
  [/\baccuracy\b|\btrack record\b/, 'trackrecord'],
  [/\bcalculators?\b|\btools\b|\bemi\b|\bposition size\b/, 'tools'],
  [/\balerts?\b/, 'alerts'],
  [/\baccount\b|\bprofile\b/, 'account'],
  [/\bglobal markets?\b|\bworld markets?\b/, 'global'],
  [/\bstrategy\b|\bbacktest\w*/, 'strategy'],
  [/\bcompany info\b|\bfinancials?\b|\bfundamentals?\b/, 'company'],
  [/\bai signals?\b|\brisk radar\b/, 'ai'],
  [/\breport analy\w+\b/, 'report'],
  [/\bhome\b|\bdashboard\b/, 'home'],
];

const NAV_VERB = /\b(open|show|go to|goto|take me|navigate|switch|jao|jaao|chalo|kholo|dikhao|dikha|dekho|le chalo|launch|bring up|pull up)\b/;

const QUESTION_WORDS =
  /\b(target|stop ?loss|view|buy|sell|hold|rsi|macd|forecast|predict\w*|prediction|risk|support|resistance|trend|momentum|volatil\w*|should|kya|kaisa|kaise|kitna|kahan|kab|why|what|how|will|can|worth|up|down|upar|neeche|girega|badhega|chadhega|outlook|price|bhav)\b/;

const FILLERS = new Set([
  'please', 'bhai', 'hey', 'ok', 'okay', 'yaar', 'sir', 'mujhe', 'mere', 'meri', 'mera', 'me', 'mein', 'the', 'a', 'an', 'to', 'for',
  'aaj', 'abhi', 'now', 'today', 'ka', 'ki', 'ke', 'ko', 'hai', 'ho', 'kar', 'do', 'de', 'dena', 'karo', 'zara', 'jara', 'bas', 'and', 'aur',
  'stock', 'stocks', 'share', 'shares', 'price', 'chart', 'analysis', 'about', 'tell', 'give', 'let', 'us', 'see', 'is', 'of', 'on', 'in',
]);
const NON_STOCK = new Set([
  'this', 'that', 'it', 'its', 'ye', 'yeh', 'yahi', 'is', 'iska', 'iski', 'isi', 'uska', 'uski', 'wahi', 'same', 'current', 'market', 'markets',
  'what', 'how', 'why', 'when', 'where', 'which', 'who', 'kya', 'kaisa', 'kaise', 'kaun', 'kitna', 'kab', 'kahan',
  'target', 'forecast', 'view', 'risk', 'rsi', 'macd', 'support', 'resistance', 'trend', 'stop', 'loss', 'stoploss', 'buy', 'sell', 'hold',
  'prediction', 'momentum', 'volatility', 'news', 'chart', 'charts', 'options', 'option', 'portfolio', 'watchlist', 'home', 'dashboard',
  'pcr', 'help', 'hello', 'hi', 'namaste', 'thanks', 'thank', 'sab', 'kuch', 'kuchh', 'best', 'top', 'good', 'bad',
]);

export function normalizeTranscript(raw: string): string {
  let t = raw;
  for (const [re, rep] of DEVANAGARI) t = t.replace(re, rep);
  t = t.toLowerCase().replace(/&/g, ' and ').replace(/[^\p{L}\p{N}\s]/gu, ' ');
  // "h d f c bank" / "t c s" -> "hdfc bank" / "tcs" (speech engines often spell letters out)
  t = t.replace(/\b(?:[a-z]\s){1,}[a-z]\b/g, (m) => m.replace(/\s/g, ''));
  return t.replace(/\s+/g, ' ').trim();
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function findAlias(text: string): StockRef | undefined {
  const keys = Object.keys(STOCK_ALIASES).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    const key = normalizeTranscript(k);
    if (!key) continue;
    const re = /[^\x00-\x7F]/.test(key) ? new RegExp(escapeRe(key)) : new RegExp(`(^|\\s)${escapeRe(key)}(\\s|$)`);
    if (re.test(text)) return STOCK_ALIASES[k];
  }
  return undefined;
}

function cleanCandidate(c: string): string | undefined {
  const words = c.split(' ').filter(Boolean);
  while (words.length && FILLERS.has(words[0])) words.shift();
  while (words.length && FILLERS.has(words[words.length - 1])) words.pop();
  if (!words.length || words.length > 4) return undefined;
  if (words.every((w) => NON_STOCK.has(w) || FILLERS.has(w))) return undefined;
  if (words.some((w) => NON_STOCK.has(w))) return undefined;
  const phrase = words.join(' ');
  return phrase.length >= 2 ? phrase : undefined;
}

const LOAD_VERBS =
  '(?:show me|show|open|load|search for|search|find|analy[sz]e|analysis of|check|look up|lookup|pull up|get me|get|dikhao|dikha do|dekho|khojo|kholo|batao|bata do)';

function extractStockPhrase(t: string): string | undefined {
  const patterns: RegExp[] = [
    new RegExp(`^(?:\\w+ )?${LOAD_VERBS}\\s+(.+)$`),
    /^(?:how is|how s|how are|what about|tell me about|about|whats|what is|what s)\s+(.+)$/,
    /^(.+?)\s+(?:ka|ki|ke|ko)\s+.+$/,
    /^(.+?)\s+(?:stock|share|shares|price|chart|analysis|forecast|target|news)\b.*$/,
    /^(.+?)\s+(?:kaisa|kaise|kya|dikhao|kholo|batao|doing|today)\b.*$/,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (!m) continue;
    let cand = m[1];
    cand = cand.split(/\s+(?:ka|ki|ke|ko|stock|share|shares|price|chart|charts|analysis|forecast|target|view|news|options?|dividends?|for|please|kaisa|kaise|kya|doing|today|dikhao|kholo|batao|hai)\b/)[0];
    const c = cleanCandidate(cand);
    if (c) return c;
  }
  const whole = cleanCandidate(t);
  if (whole && t.split(' ').length <= 3) return whole;
  return undefined;
}

export function parseVoiceCommand(raw: string): ParsedCommand {
  const text = normalizeTranscript(raw);
  const words = text.split(' ').filter(Boolean);

  let page: PageId | undefined;
  for (const [re, id] of PAGE_KEYWORDS) {
    if (re.test(text)) { page = id; break; }
  }

  const alias = findAlias(text);
  let stockPhrase = alias ? undefined : extractStockPhrase(text);
  if (stockPhrase && PAGE_KEYWORDS.some(([re]) => re.test(stockPhrase!))) stockPhrase = undefined;
  if (stockPhrase && NON_STOCK.has(stockPhrase)) stockPhrase = undefined;

  const hasStock = !!alias || !!stockPhrase;
  if (page && !(NAV_VERB.test(text) || words.length <= 3 || hasStock)) page = undefined;

  return { raw, text, alias, stockPhrase, page, isQuestion: QUESTION_WORDS.test(text) };
}

export const STOCK_PAGES: PageId[] = ['charts', 'news', 'dividends', 'company', 'ai', 'strategy', 'alerts', 'home'];

export const PAGE_LABELS: Partial<Record<PageId, string>> = {
  options: 'Option Chain', paper: 'Paper Trading', smartmoney: 'Smart Money', portfolio: 'Portfolio', watchlist: 'Watchlist',
  news: 'News', dividends: 'Dividends', ipo: 'IPO', scanners: 'Scanners', compare: 'Compare', charts: 'Charts', journal: 'Trade Journal',
  trackrecord: 'Accuracy', tools: 'Tools', alerts: 'Alerts', account: 'Account', global: 'Global Markets', strategy: 'Strategy Lab',
  company: 'Company Info', ai: 'AI Signals', report: 'Report Analyzer', home: 'Home',
};
