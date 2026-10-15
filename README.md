# 📈 PredictX — Stock Prediction & Analysis Dashboard

A modern, high-performance web dashboard for analyzing, screening, and forecasting stocks across **NSE, BSE, US markets, and major Indian indices** — combining an interactive multi-day price forecaster, rule-based quantitative trading signals, technical scanners, live options chain analytics with Black-Scholes Greeks, portfolio tracking, and financial calculators.

> ⚠️ **Disclaimer:** This project is for educational and informational purposes only. Nothing it produces — predictions, signals, scores, or summaries — constitutes financial or investment advice. Always conduct independent research before making market decisions.

---

## ✨ Key Features & Modules

### 📊 1. Dashboard & Price Forecasting
- **Time-Series Validation Curve**: Visual comparison of historical training data, actual prices, and model predictions with accuracy metrics.
- **Explainable Buy / Sell / Hold Signal**: Transparent quantitative scoring (-100 to +100) factoring in RSI, MACD crossovers, moving average slopes, and Bollinger Band positioning.
- **Confidence Scoring**: Error-derived confidence rating on forecast accuracy.
- **Historical Data Export**: Instant CSV download for historical trading sessions.

### 📈 2. Charts & Technical Analysis
- **Multi-Timeframe Analysis**: Daily, Weekly, and Monthly resolutions.
- **Technical Overlays**: SMA (20, 50, 100, 200), EMA (20, 50), Bollinger Bands, Supertrend, Fibonacci Retracement levels, and Classic Floor Pivot Points (P, R1, R2, S1, S2).
- **Oscillator Panels**: Interactive RSI(14) oscillator, MACD (12, 26, 9) with histogram, and trading volume bars.
- **Pattern Recognition**: Automated detection of candlestick formations (Doji, Hammer, Shooting Star, Bullish/Bearish Engulfing, Morning/Evening Star).

### 🤖 3. AI Features & Risk Profiling
- **Multi-Horizon Projections**: Next-day, 7-day, and 30-day forecast curves.
- **Quantitative Risk Metrics**: Annualized historical volatility %, maximum drawdown %, and beta vs benchmark.
- **Natural Language Market Summary**: Plain-English synthesized narrative covering price movement, trend classification, and upcoming targets.

### 🔍 4. Real-Time Scanners
- **Breakout Scanner**: Identifies symbols breaking above prior 20-day highs with expanding volume.
- **Gap Up / Gap Down Scanner**: Configurable threshold slider detecting opening session price discontinuities.
- **Momentum Scanner**: Symbols ranked by Rate of Change (ROC) across user-defined lookback windows.
- **Swing / Golden Cross Scanner**: Filters for SMA 50 crossing above SMA 200 and pullback setups.

### 🌍 5. Global Markets & Movers Heatmap
- **World Benchmarks**: S&P 500, NASDAQ 100, Dow Jones, NIFTY 50, BANK NIFTY, FTSE 100, Nikkei 225, Hang Seng, Dollar Index (DXY), Brent Crude Oil, Natural Gas, and Gold.
- **Top Movers Heatmap**: Visual color-coded performance tiles with volume distribution.
- **Market Mood & Breadth**: Advances vs Declines ratio and sentiment bias gauge.

### ⚡ 6. AI Option Analyzer
- **Real-Time Option Chain**: Comprehensive Call (CE) and Put (PE) grid across strikes around ATM for NIFTY, BANK NIFTY, and FIN NIFTY.
- **Black-Scholes Greeks Engine**: Real-time Delta, Gamma, Theta, and Vega computed per leg.
- **Implied Volatility (IV) & Put-Call Ratio (PCR)**: Instant institutional sentiment indicator with rule-based AI option bias reading (Buy Call, Buy Put, Watch, No Trade).

### 🚀 7. IPO Predictor
- **Listing-Gain Recommendation**: AI Apply / Avoid score driven by Grey Market Premium (GMP %), QIB institutional oversubscription multiples, total issue size, and sector momentum.

### 💼 8. Portfolio & Watchlist Tracker
- **Holdings Management**: Quantity, buy price, live quote, invested capital, current valuation, and unrealized P/L ($ / ₹ and %).
- **Portfolio Health Score**: Algorithmic rating evaluating sector diversification, single-asset concentration, and aggregate volatility.
- **Rule-Based Rebalancing Advice**: Automated warnings for over-concentrated positions.
- **Watchlist**: Quick symbol access and ticker monitoring.

### 🧪 9. Strategy Lab (Backtester & Paper Trading)
- **Quantitative Strategy Backtester**: Test SMA Crossover or RSI Mean-Reversion rules against historical data with an interactive equity curve, maximum drawdown, and win rate vs. Buy & Hold benchmark.
- **Paper Trading Simulator**: Realistic sandbox trading with virtual cash balances, market buy/sell order execution, and full transaction history.

### 🧮 10. Investment Tools & Calculators
- **EMI Calculator**: Principal, interest rate, and tenure breakdown with interest-to-principal amortisation.
- **CAGR Calculator**: Compounded annual growth rate computation.
- **XIRR Calculator**: Annualized returns across irregular investment cash flows.
- **Brokerage & Regulatory Charges**: Indian exchange calculation including STT, turnover charges, GST, SEBI fee, and stamp duty.
- **Capital Gains Tax**: Revised Budget 2024 taxation (STCG 20%, LTCG 12.5% with ₹1.25L exemption).
- **Retirement & Goal SIP Planners**: Target wealth accumulation and inflation-adjusted monthly SIP requirements.

### 🏢 11. Company Information & Financial Report Analyzer
- **Fundamental Profile**: CEO/leadership, sector, industry, website, market capitalization, trailing/forward P/E, EPS, dividend yield, and 52-week ranges.
- **Report Tone Analyzer**: Heuristic keyword scanner extracting positive/cautionary sentiment and line-by-line financial metrics (revenue, profit, EBITDA, margins).

### 🔔 12. Smart Alerts, Security & User Account
- **Universal Multi-Asset Search**: Search any stock across NSE, BSE, US markets, and Benchmark Indices by ticker or company name (e.g. `SUZLON`, `IRFC`, `TATAPOWER`, `BEL`, `HAL`, `NVDA`, `AAPL`, `NIFTY 50`) with auto-market switching and interactive autocomplete dropdown.
- **100+ Stocks Universe Directory**: Categorized modal directory spanning Nifty 50, High Momentum & Green Energy, Railways & Defense PSUs, US Tech, and Benchmark Indices.
- **Angel One SmartAPI Gateway**: Integration settings for Angel One SmartAPI credentials (API Key, Client Code, MPIN, TOTP Secret) with live handshake verification and active session diagnostics.
- **Price Target Alerts**: Configurable alerts for upward and downward price thresholds.
- **Themeable UI**: Built-in Dark Mode and Light Mode with high-contrast financial palettes and persistent theme state.
- **Security & 2FA**: Account profile management, password updates, and TOTP Two-Factor Authentication preview.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| **Build Tool & Bundler** | [Vite 6](https://vitejs.dev/) |
| **Styling & Theme** | [Tailwind CSS v4](https://tailwindcss.com/) |
| **Charts & Visualizations** | [Recharts](https://recharts.org/) |
| **Icons** | [Lucide React](https://lucide.dev/) |
| **Storage & Persistence** | Browser LocalStorage State Engine |
| **Deployment Platforms** | Vercel, Netlify, GitHub Pages, Render, Cloudflare Pages |

---

## 🚀 Quick Start & Local Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18, 20, or 22 LTS recommended)
- `npm` (bundled with Node.js)

### 1. Clone the repository
```bash
git clone https://github.com/Ajaykumar187/PredictX.git
cd PredictX
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start the local development server
```bash
npm run dev
```
Open your browser and navigate to:
```
http://localhost:3000
```

### 4. Build for production
```bash
npm run build
```
The optimized production bundle will be generated in the `dist/` directory.

---

## 🌐 Deployment Guide

### Option A: Deploy to Vercel (Recommended — 1-Click Free Hosting)

1. Push your latest code to your GitHub repository:
   ```bash
   git add .
   git commit -m "Update PredictX dashboard"
   git push origin main
   ```
2. Log in to [Vercel](https://vercel.com/) with your GitHub account.
3. Click **"Add New..."** → **"Project"** and select your **`PredictX`** repository.
4. Vercel automatically detects the **Vite** framework preset:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Click **"Deploy"** — your live dashboard will be deployed in seconds!

---

### Option B: Deploy to Netlify

1. Log in to [Netlify](https://www.netlify.com/).
2. Select **"Add new site"** → **"Import an existing project"** → Choose **GitHub**.
3. Select your **`PredictX`** repository:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
4. Click **"Deploy PredictX"**.

---

### Option C: Deploy to GitHub Pages

1. Install the `gh-pages` utility:
   ```bash
   npm install --save-dev gh-pages
   ```
2. Add the homepage and deployment scripts to `package.json`:
   ```json
   "homepage": "https://<your-username>.github.io/PredictX",
   "scripts": {
     "predeploy": "npm run build",
     "deploy": "gh-pages -d dist"
   }
   ```
3. Run:
   ```bash
   npm run deploy
   ```

---

## 📁 Project Architecture

```
PredictX/
├── index.html                   # HTML entry point with SEO metadata
├── package.json                 # Project dependencies & scripts
├── tsconfig.json                # TypeScript compiler configuration
├── vite.config.ts               # Vite configuration (port 3000, 0.0.0.0, Tailwind v4)
├── .env.example                 # Optional environment credentials template
├── README.md                    # Project documentation
└── src/
    ├── main.tsx                 # React DOM root render
    ├── App.tsx                  # Root layout, theme sync & module routing
    ├── index.css                # Global Tailwind CSS v4 styling & dark mode setup
    ├── types/
    │   └── index.ts             # Domain models, PriceBar, AnalysisResult, Portfolios
    ├── components/
    │   ├── Navbar.tsx           # Navy gradient header, live ticker, & theme switcher
    │   └── Sidebar.tsx          # Market/symbol selector, recent stocks, navigation & appearance
    ├── utils/
    │   ├── marketData.ts        # Calibrated historical data generator & stock catalogs
    │   ├── indicators.ts        # 20+ technical indicators (SMA, EMA, RSI, MACD, BB, Fib, Pivots)
    │   ├── aiEngine.ts          # Buy/Sell/Hold signal scoring, 30-day forecast & risk metrics
    │   ├── patterns.ts          # Candlestick pattern recognition engine
    │   ├── greeks.ts            # Black-Scholes Greeks, Option Chain generator & PCR analysis
    │   ├── backtester.ts        # Strategy equity curve and trade execution simulator
    │   ├── calculators.ts       # EMI, CAGR, XIRR, Brokerage, Tax, Retirement & SIP tools
    │   ├── ipoPredictor.ts      # GMP and subscription-weighted IPO recommendation engine
    │   └── storage.ts           # LocalStorage state management for portfolio, alerts & accounts
    └── pages/
        ├── HomePage.tsx         # Main dashboard, LSTM validation chart, & historical table
        ├── ChartsPage.tsx       # Candlestick/line chart, technical overlays, & pattern badges
        ├── AIFeaturesPage.tsx   # AI Buy/Sell breakdown, 30-day forecast, & risk metrics
        ├── CompanyInfoPage.tsx  # Company profile, leadership, and key valuation ratios
        ├── NewsPage.tsx         # Curated headlines with sentiment scoring & Fear/Greed gauge
        ├── PortfolioPage.tsx    # Holdings tracking, health score, rebalancing, & watchlist
        ├── AlertsPage.tsx       # Price target alerts and notification channel configurations
        ├── ScannersPage.tsx     # Breakout, Gap, Momentum, and Golden Cross scans
        ├── GlobalMarketsPage.tsx# World indices, commodities, and top movers heatmap
        ├── InvestmentToolsPage.tsx # Suite of 7 financial calculators & tax planners
        ├── StrategyLabPage.tsx  # Quantitative backtester & paper trading account
        ├── ReportAnalyzerPage.tsx # AI heuristic financial filing & report text analyzer
        ├── IPOPredictorPage.tsx # IPO recommendation engine with GMP & subscription inputs
        ├── OptionAnalyzerPage.tsx # Interactive Option Chain with Greeks (Delta, Gamma, Theta, Vega)
        ├── AdvancedPage.tsx     # Stock comparison, sector rotations, chatbot & export
        └── AccountPage.tsx      # User profile, 2FA security settings, and session history
```

---

## 📄 License

This project is open-source and provided for educational purposes. Feel free to customize and expand it for personal research and trading analysis.

## 👨‍💻 Author

**Ajay Kumar** — Full Stack Developer  
GitHub: [@Ajaykumar187](https://github.com/Ajaykumar187)
