import type { LanguageCode } from './languages';

const STORAGE_CACHE_KEY = 'predictx_site_hi_cache_v1';
const MAX_STORED_ENTRIES = 1200;

const STATIC_EN_TO_HI: Record<string, string> = {
  'Alert': 'अलर्ट',
  'Account': 'अकाउंट',
  'Market Intelligence': 'मार्केट इंटेलिजेंस',
  'Set Price Alert': 'प्राइस अलर्ट सेट करें',
  'Current Live Price': 'वर्तमान लाइव कीमत',
  "Today's Change": 'आज का बदलाव',
  'Trigger Condition': 'ट्रिगर शर्त',
  'Rises Above (≥)': 'ऊपर जाने पर (≥)',
  'Falls Below (≤)': 'नीचे जाने पर (≤)',
  'Target Price': 'लक्ष्य कीमत (Target)',
  'Enter target price': 'लक्ष्य कीमत दर्ज करें',
  'Quick Percentage Targets': 'त्वरित प्रतिशत लक्ष्य',
  'Notification channel': 'नोटिफिकेशन माध्यम',
  'Dashboard Alerts': 'डैशबोर्ड अलर्ट',
  'Cancel': 'रद्द करें',
  'Save Alert': 'अलर्ट सहेजें',
  'Alert Activated': 'अलर्ट सक्रिय हो गया',
  'View All Alerts': 'सभी अलर्ट देखें',
  'Create Another': 'नया अलर्ट बनाएं',

  'Dashboard & Forecast': 'डैशबोर्ड और पूर्वानुमान',
  'Ask PredictX AI': 'PredictX AI से पूछें',
  'NSE 500 Heatmap': 'NSE 500 हीटमैप',
  'Charts & Analysis': 'चार्ट और विश्लेषण',
  'Split-View Compare': 'स्टॉक तुलना (Compare)',
  'AI Signals & Risk': 'AI संकेत और जोखिम',
  'AI Option Chain': 'ऑप्शन चेन विश्लेषण',
  'Market Scanners': 'मार्केट स्कैनर',
  'Smart Money (FII/DII)': 'स्मार्ट मनी (FII/DII)',
  'Quarterly Results': 'तिमाही नतीजे',
  'Company Info': 'कंपनी की जानकारी',
  'News & Sentiment': 'समाचार और सेंटीमेंट',
  'Dividends & Calendar': 'डिविडेंड और कैलेंडर',
  'Watchlist': 'वॉचलिस्ट',
  'Portfolio Tracker': 'पोर्टफोलियो ट्रैकर',
  'Paper Trading': 'पेपर ट्रेडिंग',
  'Smart Alerts': 'स्मार्ट अलर्ट',
  'IPO Predictor': 'IPO प्रेडिक्टर',
  'Global Markets': 'ग्लोबल मार्केट्स',
  'Trade Journal': 'ट्रेड जर्नल',
  'Model Accuracy': 'मॉडल सटीकता',
  'Investment Tools': 'निवेश टूल्स',
  'Strategy Lab': 'स्ट्रैटेजी लैब',
  'Report Analyzer': 'रिपोर्ट विश्लेषक',
  'Advanced Assistant': 'एडवांस्ड असिस्टेंट',
  'User Account': 'यूज़र अकाउंट',

  'Search ticker (RELIANCE, TCS, NVDA)': 'शेयर खोजें (RELIANCE, TCS, NVDA)',
  'More': 'और देखें',
  'Stock Catalog': 'स्टॉक कैटलॉग',
  'Direct NSE': 'सीधा NSE',
  'Clear': 'साफ़ करें',
  'Select': 'चुनें',
  'Live Quotes': 'लाइव भाव',
  'Stock Catalog & Benchmarks': 'स्टॉक कैटलॉग और इंडेक्स',
  'Select any ticker to load live technical analysis and price forecasting.': 'लाइव तकनीकी विश्लेषण और कीमत पूर्वानुमान देखने के लिए कोई भी स्टॉक चुनें।',
  'All Catalog': 'सभी स्टॉक',
  'Nifty 50 Bluechips': 'निफ्टी 50 ब्लूचिप',
  'High Momentum': 'हाई मोमेंटम',
  'Railways & Defense': 'रेलवे और डिफेंस',
  'US Tech': 'अमेरिकी टेक',
  'Indices': 'इंडेक्स',
  'Open →': 'खोलें →',
  'Search any NSE, BSE, or US ticker from the sidebar': 'साइडबार से कोई भी NSE, BSE या US स्टॉक खोजें',

  'Home': 'होम',
  'Dashboard': 'डैशबोर्ड',
  'Split-View Stock Compare': 'स्टॉक तुलना (Split-View)',
  'Live NSE Option Chain & Greeks': 'लाइव NSE ऑप्शन चेन और ग्रीक्स',
  'Trade Journal & Audit': 'ट्रेड जर्नल और ऑडिट',
  'Model Accuracy Track Record': 'मॉडल सटीकता ट्रैक रिकॉर्ड',
  'IPO Predictor & Live GMP': 'IPO प्रेडिक्टर और लाइव GMP',
  'Charts & Technical Analysis': 'चार्ट और तकनीकी विश्लेषण',
  'AI Signals & Risk Radar': 'AI संकेत और जोखिम रडार',
  'Live Financial News & Sentiment': 'लाइव वित्तीय समाचार और सेंटीमेंट',
  'Market Scanners & Breakouts': 'मार्केट स्कैनर और ब्रेकआउट',
  'NSE 500 Market Heatmap': 'NSE 500 मार्केट हीटमैप',
  'Dividend Radar & Calendar': 'डिविडेंड रडार और कैलेंडर',
  'Company Financials & Profile': 'कंपनी वित्तीय डेटा और प्रोफ़ाइल',
  'Quarterly Financial Results': 'तिमाही वित्तीय नतीजे',
  'Strategy Lab Backtesting': 'स्ट्रैटेजी लैब बैकटेस्टिंग',
  'Financial Report Analyzer': 'वित्तीय रिपोर्ट विश्लेषक',
  'Live Watchlist': 'लाइव वॉचलिस्ट',
  'Smart Price Alerts': 'स्मार्ट प्राइस अलर्ट',
  'Investment Tools & Calculators': 'निवेश टूल्स और कैलकुलेटर',
  'User Account & Profile': 'यूज़र अकाउंट और प्रोफ़ाइल',

  'PredictX — educational analysis only, not financial advice. Market data may be delayed.': 'PredictX — केवल शैक्षिक विश्लेषण के लिए है, वित्तीय सलाह नहीं। बाज़ार का डेटा थोड़ी देरी से अपडेट हो सकता है।',

  'NSE · BSE · US Equities · Real-Time Analytics': 'NSE · BSE · US शेयर · रियल-टाइम एनालिटिक्स',
  'Institutional-grade market intelligence, built for clarity.': 'स्पष्ट और सटीक निर्णय के लिए प्रोफेशनल मार्केट एनालिटिक्स।',
  'Search any ticker from the left sidebar to open live price forecasting, quarterly financials, option chains, and market-wide heatmaps.': 'लाइव प्राइस पूर्वानुमान, तिमाही नतीजे, ऑप्शन चेन और मार्केट हीटमैप देखने के लिए बाईं साइडबार से कोई भी शेयर खोजें।',
  'Open NSE 500 Heatmap': 'NSE 500 हीटमैप खोलें',
  'Market Modules': 'मार्केट मॉड्यूल',
  'Ready to explore': 'एक्सप्लोर करने के लिए तैयार',
  'Deep Stock Research': 'गहन स्टॉक रिसर्च',
  'Search any symbol in the sidebar to unlock ticker-specific forecasting, technicals, and financials.': 'स्टॉक-विशिष्ट पूर्वानुमान, तकनीकी संकेतक और वित्तीय आंकड़े देखने के लिए साइडबार में कोई भी शेयर खोजें।',
  'Option Chain': 'ऑप्शन चेन',
  'Stock Compare': 'स्टॉक तुलना',
  'Smart Money': 'स्मार्ट मनी',
  'IPO & GMP': 'IPO और GMP',
  '30-Day Forecast': '30-दिवसीय पूर्वानुमान',
  'Technical Charts': 'तकनीकी चार्ट',
  'Dividends': 'डिविडेंड',
  'Company Financials': 'कंपनी के वित्तीय आंकड़े',
  'Ask via voice or text for support, resistance, buy/sell levels, and multi-year return estimates.': 'सपोर्ट, रेजिस्टेंस, खरीद/बिक्री स्तर और बहु-वर्षीय रिटर्न अनुमान के लिए टेक्स्ट या वॉइस से पूछें।',
  'Visual treemap of real-time gains and losses across NIFTY 500 stocks and sectors.': 'निफ्टी 500 शेयरों और सेक्टरों में रियल-टाइम बढ़त और गिरावट का विज़ुअल हीटमैप।',
  'Live NSE option chain, Greeks, PCR, and Max Pain levels.': 'लाइव NSE ऑप्शन चेन, ग्रीक्स, PCR और मैक्स पेन स्तर।',
  'Compare two equities side-by-side in real time.': 'दो शेयरों की रियल-टाइम में आमने-सामने तुलना करें।',
  'Track breakout, high-momentum, and high-volume stocks in one place.': 'ब्रेकआउट, हाई-मोमेंटम और हाई-वॉल्यूम शेयरों को एक साथ ट्रैक करें।',
  'FII/DII institutional buying and selling plus ownership breakdown.': 'FII/DII संस्थागत खरीद-बिक्री और शेयरधारिता का विवरण।',
  'Active IPOs, grey market premium, and listing gain estimates.': 'सक्रिय IPO, ग्रे मार्केट प्रीमियम (GMP) और लिस्टिंग लाभ का अनुमान।',
  'Practice with ₹10,00,000 virtual capital at live market prices with leaderboard.': 'लीडरबोर्ड के साथ लाइव मार्केट भाव पर ₹10,00,000 वर्चुअल पूंजी से अभ्यास करें।',
  'Track holdings P&L, risk exposure, and diversification score.': 'होल्डिंग्स लाभ-हानि (P&L), जोखिम और डायवर्सिफिकेशन स्कोर ट्रैक करें।',
  'Inspect historical model performance with transparent backtests.': 'पारदर्शी बैकटेस्ट के साथ मॉडल के पिछले प्रदर्शन की जांच करें।',
  'Log trades and evaluate execution discipline and performance.': 'अपने ट्रेड दर्ज करें और अनुशासन व प्रदर्शन का मूल्यांकन करें।',
  'Position size, tax, brokerage, SIP, EMI, and investment calculators.': 'पोज़िशन साइज़, टैक्स, ब्रोकरेज, SIP, EMI और निवेश कैलकुलेटर।',
  'Target price with confidence range and detailed signal reasoning.': 'विश्वास सीमा (Confidence Range) और विस्तृत कारणों के साथ लक्ष्य कीमत।',
  'Interactive charts with multi-timeframe technical indicators.': 'विभिन्न समय-सीमा और तकनीकी संकेतकों के साथ इंटरैक्टिव चार्ट।',
  'BUY/SELL/HOLD signals, composite score, and risk radar.': 'BUY/SELL/HOLD संकेत, समग्र स्कोर और जोखिम रडार।',
  'Latest market headlines and automated sentiment scoring.': 'ताज़ा बाज़ार सुर्खियाँ और स्वचालित सेंटीमेंट स्कोरिंग।',
  'Dividend history, yield analysis, and upcoming ex-dividend dates.': 'डिविडेंड इतिहास, यील्ड विश्लेषण और आगामी एक्स-डिविडेंड तिथियाँ।',
  'Quarterly results, valuation metrics, and complete company profile.': 'तिमाही नतीजे, मूल्यांकन अनुपात और पूरी कंपनी प्रोफ़ाइल।',

  'Select a stock first': 'पहले एक स्टॉक चुनें',
  'Search for a stock': 'कोई स्टॉक खोजें',
  'Enter a company name or ticker symbol to view live analysis and forecast.': 'लाइव विश्लेषण और पूर्वानुमान देखने के लिए कंपनी का नाम या स्टॉक सिंबल दर्ज करें।',
  'Stock name or ticker symbol...': 'कंपनी का नाम या स्टॉक सिंबल...',
  'Analyze': 'विश्लेषण करें',

  'Overview': 'सारांश (Overview)',
  'Forecast': 'पूर्वानुमान',
  'BUY': 'खरीदें (BUY)',
  'SELL': 'बेचें (SELL)',
  'HOLD': 'होल्ड करें (HOLD)',
  'STRONG BUY': 'मजबूत खरीद (STRONG BUY)',
  'STRONG SELL': 'मजबूत बिक्री (STRONG SELL)',
  'Buy': 'खरीदें',
  'Sell': 'बेचें',
  'Hold': 'होल्ड',
  'Bullish': 'तेज़ी (Bullish)',
  'Bearish': 'मंदी (Bearish)',
  'Neutral': 'तटस्थ (Neutral)',
  'Positive': 'सकारात्मक',
  'Negative': 'नकारात्मक',
  'All': 'सभी',
  'Price': 'कीमत',
  'Current Price': 'वर्तमान कीमत',
  'Live Price': 'लाइव कीमत',
  'Open': 'ओपन',
  'High': 'हाई',
  'Low': 'लो',
  'Close': 'क्लोज़',
  'Previous Close': 'पिछला बंद भाव',
  'Day High': 'दिन का उच्चतम',
  'Day Low': 'दिन का न्यूनतम',
  '52W High': '52 सप्ताह का उच्चतम',
  '52W Low': '52 सप्ताह का न्यूनतम',
  'Volume': 'वॉल्यूम',
  'Avg Volume': 'औसत वॉल्यूम',
  'Market Cap': 'मार्केट कैप',
  'P/E Ratio': 'P/E अनुपात',
  'Dividend Yield': 'डिविडेंड यील्ड',
  'Sector': 'सेक्टर',
  'Industry': 'उद्योग',
  'Exchange': 'एक्सचेंज',
  'Currency': 'मुद्रा',
  'Support': 'सपोर्ट',
  'Resistance': 'रेजिस्टेंस',
  'Target': 'लक्ष्य',
  'Stop Loss': 'स्टॉप लॉस',
  'Risk / Reward': 'जोखिम / लाभ',
  'Confidence': 'विश्वास स्तर',
  'Volatility': 'उतार-चढ़ाव',
  'Momentum': 'मोमेंटम',
  'Trend': 'रुझान',
  'Signal': 'संकेत',
  'Signals': 'संकेत',
  'Score': 'स्कोर',
  'Summary': 'सारांश',
  'Details': 'विवरण',
  'Action': 'कार्रवाई',
  'Status': 'स्थिति',
  'Date': 'तिथि',
  'Time': 'समय',
  'Symbol': 'सिंबल',
  'Stock': 'स्टॉक',
  'Company': 'कंपनी',
  'Quantity': 'मात्रा',
  'Shares': 'शेयर',
  'Avg Price': 'औसत कीमत',
  'Buy Price': 'खरीद मूल्य',
  'Invested': 'निवेशित राशि',
  'Total Invested': 'कुल निवेश',
  'Current Value': 'वर्तमान मूल्य',
  'Portfolio Value': 'पोर्टफोलियो मूल्य',
  'Total Portfolio Value': 'कुल पोर्टफोलियो मूल्य',
  'Portfolio Value Over Time': 'समय के साथ पोर्टफोलियो मूल्य',
  'Total P&L': 'कुल लाभ/हानि',
  'Net P&L': 'शुद्ध लाभ/हानि',
  "Today's P&L": 'आज का लाभ/हानि',
  'Unrealized P&L': 'अवास्तविक लाभ/हानि',
  'Realized P&L': 'वास्तविक लाभ/हानि',
  'Return': 'रिटर्न',
  'Returns': 'रिटर्न',
  'Export CSV': 'CSV एक्सपोर्ट करें',
  'Download CSV': 'CSV डाउनलोड करें',
  'Add Holding': 'होल्डिंग जोड़ें',
  'Add Position': 'पोज़िशन जोड़ें',
  'Add Trade': 'ट्रेड जोड़ें',
  'Add to Watchlist': 'वॉचलिस्ट में जोड़ें',
  'Remove': 'हटाएं',
  'Delete': 'हटाएं',
  'Edit': 'संपादित करें',
  'Save': 'सहेजें',
  'Update': 'अपडेट करें',
  'Reset': 'रीसेट करें',
  'Refresh': 'रीफ़्रेश करें',
  'Reload': 'पुनः लोड करें',
  'Search': 'खोजें',
  'Filter': 'फ़िल्टर',
  'Filters': 'फ़िल्टर',
  'Sort by': 'क्रमबद्ध करें',
  'Loading...': 'लोड हो रहा है...',
  'Holdings': 'होल्डिंग्स',
  'Positions': 'पोज़िशन',
  'Orders': 'ऑर्डर',
  'Trade History': 'ट्रेड इतिहास',
  'Recent Trades': 'हाल के ट्रेड',
  'Portfolio Overview': 'पोर्टफोलियो सारांश',
  'Sector Allocation': 'सेक्टर आवंटन',
  'Daily Gain': 'दैनिक लाभ',
  'Dividend Income': 'डिविडेंड आय',
  'Login': 'लॉगिन',
  'Log in': 'लॉगिन',
  'Sign In': 'साइन इन',
  'Register': 'रजिस्टर करें',
  'Sign Up': 'साइन अप',
  'Logout': 'लॉगआउट',
  'Log out': 'लॉगआउट',
  'Sign Out': 'साइन आउट',
  'Email': 'ईमेल',
  'Email Address': 'ईमेल पता',
  'Password': 'पासवर्ड',
  'Username': 'यूज़रनेम',
  'Full Name': 'पूरा नाम',
  'Profile': 'प्रोफ़ाइल',
  'Settings': 'सेटिंग्स',
  'Top Gainers': 'टॉप गेनर्स (बढ़त)',
  'Top Losers': 'टॉप लूज़र्स (गिरावट)',
  'Most Active': 'सबसे सक्रिय',
  'Breakout Stocks': 'ब्रेकआउट स्टॉक्स',
  'Revenue': 'राजस्व (Revenue)',
  'Net Profit': 'शुद्ध मुनाफा',
  'Operating Profit': 'ऑपरेटिंग मुनाफा',
  'Operating Margin': 'ऑपरेटिंग मार्जिन',
  'Profit Margin': 'प्रॉफ़िट मार्जिन',
  'Net Income': 'शुद्ध आय',
  'Technical Indicators': 'तकनीकी संकेतक',
  'Moving Averages': 'मूविंग एवरेज',
  'Price Forecast': 'कीमत पूर्वानुमान',
  'Compare Stocks': 'स्टॉक की तुलना करें',
  'Run Backtest': 'बैकटेस्ट चलाएं',
  'Backtest Results': 'बैकटेस्ट परिणाम',
  'Win Rate': 'जीत दर (Win Rate)',
  'Max Drawdown': 'अधिकतम गिरावट',
  'Sharpe Ratio': 'शार्प अनुपात',
  'Total Trades': 'कुल ट्रेड',
  'Total Return': 'कुल रिटर्न',
  'Virtual Capital': 'वर्चुअल पूंजी',
  'Available Cash': 'उपलब्ध नकद',
  'Place Order': 'ऑर्डर लगाएं',
  'Execute Trade': 'ट्रेड करें',
  'Calculate': 'गणना करें',
  'Monthly Investment': 'मासिक निवेश',
  'Expected Return Rate': 'अपेक्षित रिटर्न दर',
  'Time Period': 'समय अवधि',
  'Estimated Returns': 'अनुमानित रिटर्न',
  'Total Value': 'कुल मूल्य',
  'Upcoming IPOs': 'आगामी IPO',
  'Active IPOs': 'सक्रिय IPO',
  'Listed IPOs': 'लिस्टेड IPO',
  'Upcoming Dividends': 'आगामी डिविडेंड',
  'Dividend History': 'डिविडेंड इतिहास',
  'Ex-Dividend Date': 'एक्स-डिविडेंड तिथि',
  'Payment Date': 'भुगतान तिथि',
  'Annual Dividend': 'वार्षिक डिविडेंड',
  'Send': 'भेजें',
  'Ask': 'पूछें',
  'Copy': 'कॉपी करें',
  'Close Modal': 'बंद करें',
  'Back': 'वापस',
  'Next': 'आगे',
  'Previous': 'पिछला',
  'Yes': 'हाँ',
  'No': 'नहीं',
};

const STATIC_LOWER_MAP = new Map<string, string>();
for (const [en, hi] of Object.entries(STATIC_EN_TO_HI)) {
  STATIC_LOWER_MAP.set(en.trim().toLowerCase(), hi);
}

const dynamicCache = new Map<string, string>();
let cacheLoaded = false;

function loadDynamicCache(): void {
  if (cacheLoaded || typeof window === 'undefined') return;
  cacheLoaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string' && v.trim()) {
          dynamicCache.set(k, v);
        }
      }
    }
  } catch {
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSaveDynamicCache(): void {
  if (typeof window === 'undefined' || saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const entries = Array.from(dynamicCache.entries()).slice(-MAX_STORED_ENTRIES);
      window.localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch {
    }
  }, 600);
}

function hasDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}

const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'CODE',
  'PRE',
  'SVG',
  'PATH',
  'TEXTAREA',
]);

const NON_TRANSLATABLE_TOKENS = new Set([
  'NSE', 'BSE', 'US', 'UK', 'IDX', 'INDEX', 'INDICES', 'NIFTY', 'SENSEX', 'BANKNIFTY',
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'TATAMOTORS', 'ITC',
  'BEL', 'HAL', 'SUZLON', 'IRFC', 'TATAPOWER', 'ZOMATO', 'BAJFINANCE', 'MARUTI',
  'LT', 'BHARTIARTL', 'HINDUNILVR', 'ADANIPOWER', 'TRENT', 'DMART', 'VEDL', 'COALINDIA',
  'ONGC', 'POWERGRID', 'NTPC', 'BPCL', 'RVNL', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN',
  'META', 'GOOGL', 'AMD', 'NFLX', 'PREDICTX', 'RSI', 'MACD', 'EMA', 'SMA', 'VWAP',
  'ATR', 'ADX', 'OI', 'PCR', 'IV', 'GMP', 'IPO', 'SIP', 'EMI', 'FII', 'DII', 'P&L',
  'PE', 'PB', 'ROE', 'ROCE', 'EPS', 'EBITDA', 'PAT', 'CSV', 'PDF', 'URL', 'AI', 'EN', 'HI',
  'INR', 'USD', 'EUR', 'GBP', 'JPY', 'MCX', 'SEBI', 'RBI', 'FED', 'LTP', 'CE', 'PE',
]);

function shouldSkipText(raw: string): boolean {
  const s = raw.trim();
  if (s.length < 2) return true;
  if (hasDevanagari(s)) return true;

  if (!/[A-Za-z]{2,}/.test(s)) return true;

  // Skip URLs and emails
  if (/^(https?:\/\/|www\.|[\w.+-]+@[\w-]+\.[\w.-]+)$/i.test(s)) return true;

  const upper = s.toUpperCase();
  if (NON_TRANSLATABLE_TOKENS.has(upper)) return true;
  if (/^[A-Z0-9._^&-]{2,14}$/.test(s) && s === upper && !STATIC_LOWER_MAP.has(s.toLowerCase())) {
    return true;
  }

  const letters = (s.match(/[A-Za-z]/g) || []).length;
  const digits = (s.match(/[0-9]/g) || []).length;
  if (digits > 0 && letters <= 3 && s.length <= 16) return true;

  return false;
}

function isInsideSkippedElement(node: Node): boolean {
  let el: Element | null = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  while (el) {
    if (SKIP_TAGS.has(el.tagName)) return true;
    if (el.getAttribute('data-no-translate') === 'true') return true;
    if (el.getAttribute('contenteditable') === 'true') return true;
    el = el.parentElement;
  }
  return false;
}

function lookupLocalHindi(original: string): string | null {
  const trimmed = original.trim();
  const exact = STATIC_EN_TO_HI[trimmed];
  if (exact) return exact;

  const lowerHit = STATIC_LOWER_MAP.get(trimmed.toLowerCase());
  if (lowerHit) return lowerHit;

  const alertTitleMatch = trimmed.match(/^Set Price Alert\s*·\s*(.+)$/i);
  if (alertTitleMatch) {
    return `प्राइस अलर्ट सेट करें · ${alertTitleMatch[1]}`;
  }
  const matchesCount = trimmed.match(/^Matches\s*·\s*(\d+)$/i);
  if (matchesCount) {
    return `परिणाम · ${matchesCount[1]}`;
  }
  const recentCount = trimmed.match(/^Recent\s*·\s*(\d+)$/i);
  if (recentCount) {
    return `हाल ही में खोजे गए · ${recentCount[1]}`;
  }
  const showingSec = trimmed.match(/^Showing\s+(\d+)\s+securities$/i);
  if (showingSec) {
    return `${showingSec[1]} शेयर दिखाए जा रहे हैं`;
  }
  const mktThresh = trimmed.match(/^([A-Z]+)\s+Market\s*·\s*Threshold monitoring$/i);
  if (mktThresh) {
    return `${mktThresh[1]} मार्केट · लक्ष्य निगरानी`;
  }
  const vsCurr = trimmed.match(/^([+-]?\d+(?:\.\d+)?%)\s+vs current$/i);
  if (vsCurr) {
    return `वर्तमान से ${vsCurr[1]}`;
  }

  const cached = dynamicCache.get(trimmed);
  if (cached) return cached;

  return null;
}

function preserveEdgeWhitespace(original: string, translated: string): string {
  const lead = original.match(/^\s*/)?.[0] || '';
  const trail = original.match(/\s*$/)?.[0] || '';
  return `${lead}${translated.trim()}${trail}`;
}

class SiteTranslatorEngine {
  private language: LanguageCode = 'en';
  private observer: MutationObserver | null = null;
  private rafId: number | null = null;
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private isApplying = false;

  private originalTextMap = new WeakMap<Text, string>();
  private appliedHindiMap = new WeakMap<Text, string>();
  private trackedTextNodes = new Set<Text>();

  private originalPlaceholderMap = new WeakMap<Element, string>();
  private appliedPlaceholderMap = new WeakMap<Element, string>();
  private trackedPlaceholders = new Set<Element>();

  private pendingQueue = new Set<string>();
  private inflightStrings = new Set<string>();

  setLanguage(lang: LanguageCode): void {
    loadDynamicCache();
    this.language = lang;

    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }

    if (lang === 'en') {
      this.stopObserver();
      this.restoreAllToEnglish();
      return;
    }

    this.scanAndTranslate();
    this.startObserver();
  }

  destroy(): void {
    this.stopObserver();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.batchTimer !== null) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  private startObserver(): void {
    if (this.observer || typeof MutationObserver === 'undefined' || !document.body) return;
    this.observer = new MutationObserver(() => {
      if (this.isApplying || this.language !== 'hi') return;
      this.scheduleScan();
    });
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  private stopObserver(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  private scheduleScan(): void {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      if (this.language === 'hi') {
        this.scanAndTranslate();
      }
    });
  }

  private restoreAllToEnglish(): void {
    this.isApplying = true;
    try {
      for (const node of Array.from(this.trackedTextNodes)) {
        if (!node.isConnected) {
          this.trackedTextNodes.delete(node);
          continue;
        }
        const orig = this.originalTextMap.get(node);
        const applied = this.appliedHindiMap.get(node);
        // Only restore if React hasn't replaced the text with something else
        if (orig !== undefined && applied !== undefined && node.nodeValue === applied) {
          node.nodeValue = orig;
        }
        this.appliedHindiMap.delete(node);
      }

      for (const el of Array.from(this.trackedPlaceholders)) {
        if (!el.isConnected) {
          this.trackedPlaceholders.delete(el);
          continue;
        }
        const orig = this.originalPlaceholderMap.get(el);
        const applied = this.appliedPlaceholderMap.get(el);
        if (orig !== undefined && applied !== undefined && el.getAttribute('placeholder') === applied) {
          el.setAttribute('placeholder', orig);
        }
        this.appliedPlaceholderMap.delete(el);
      }
    } finally {
      this.isApplying = false;
    }
  }

  private scanAndTranslate(): void {
    if (typeof document === 'undefined' || !document.body || this.language !== 'hi') return;
    this.isApplying = true;
    let newlyQueued = false;

    try {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let current: Node | null;
      while ((current = walker.nextNode())) {
        const textNode = current as Text;
        const val = textNode.nodeValue || '';
        if (!val.trim()) continue;
        if (isInsideSkippedElement(textNode)) continue;

        const lastApplied = this.appliedHindiMap.get(textNode);
        if (lastApplied !== undefined && val === lastApplied) {
          continue;
        }

        if (shouldSkipText(val)) continue;

        this.originalTextMap.set(textNode, val);
        this.trackedTextNodes.add(textNode);

        const hit = lookupLocalHindi(val);
        if (hit) {
          const formatted = preserveEdgeWhitespace(val, hit);
          textNode.nodeValue = formatted;
          this.appliedHindiMap.set(textNode, formatted);
        } else {
          const trimmed = val.trim();
          if (trimmed.length <= 280 && !this.inflightStrings.has(trimmed)) {
            this.pendingQueue.add(trimmed);
            newlyQueued = true;
          }
        }
      }

      const inputs = document.body.querySelectorAll('input[placeholder], textarea[placeholder]');
      inputs.forEach((el) => {
        if (isInsideSkippedElement(el)) return;
        const ph = el.getAttribute('placeholder') || '';
        if (!ph.trim()) return;

        const lastApplied = this.appliedPlaceholderMap.get(el);
        if (lastApplied !== undefined && ph === lastApplied) return;
        if (shouldSkipText(ph)) return;

        this.originalPlaceholderMap.set(el, ph);
        this.trackedPlaceholders.add(el);

        const hit = lookupLocalHindi(ph);
        if (hit) {
          el.setAttribute('placeholder', hit);
          this.appliedPlaceholderMap.set(el, hit);
        } else if (ph.trim().length <= 220 && !this.inflightStrings.has(ph.trim())) {
          this.pendingQueue.add(ph.trim());
          newlyQueued = true;
        }
      });

      if (this.trackedTextNodes.size > 2000) {
        for (const n of Array.from(this.trackedTextNodes)) {
          if (!n.isConnected) this.trackedTextNodes.delete(n);
        }
      }
    } finally {
      this.isApplying = false;
    }

    if (newlyQueued) {
      this.scheduleDynamicFlush();
    }
  }

  private scheduleDynamicFlush(): void {
    if (this.batchTimer !== null) return;
    this.batchTimer = setTimeout(() => {
      this.batchTimer = null;
      void this.flushPendingQueue();
    }, 120);
  }

  private async flushPendingQueue(): Promise<void> {
    if (this.language !== 'hi' || this.pendingQueue.size === 0) return;

    const batch = Array.from(this.pendingQueue).slice(0, 24);
    for (const s of batch) {
      this.pendingQueue.delete(s);
      this.inflightStrings.add(s);
    }

    const payloadStrings: Record<string, string> = {};
    batch.forEach((text, i) => {
      payloadStrings[`s_${i}`] = text;
    });

    try {
      const res = await fetch('/api/translate/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetLanguage: 'hi',
          strings: payloadStrings,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok && data?.translations) {
        let updated = false;
        batch.forEach((orig, i) => {
          const translated = String(data.translations[`s_${i}`] || '').trim();
          if (translated && translated !== orig) {
            dynamicCache.set(orig, translated);
            updated = true;
          }
        });
        if (updated) {
          scheduleSaveDynamicCache();
          if (this.language === 'hi') {
            this.scanAndTranslate();
          }
        }
      }
    } catch {
    } finally {
      for (const s of batch) {
        this.inflightStrings.delete(s);
      }
      if (this.language === 'hi' && this.pendingQueue.size > 0) {
        this.scheduleDynamicFlush();
      }
    }
  }
}

let singletonEngine: SiteTranslatorEngine | null = null;

export function getSiteTranslator(): SiteTranslatorEngine {
  if (!singletonEngine) {
    singletonEngine = new SiteTranslatorEngine();
  }
  return singletonEngine;
}
