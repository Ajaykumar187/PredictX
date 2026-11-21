# 📈 PredictX — Fullstack AI Stock Prediction & Market Analytics Dashboard

PredictX is an end-to-end stock prediction, quantitative research, and market analysis platform designed for Indian markets (**NSE & BSE**), **US markets (NASDAQ / NYSE)**, and **Global Indices & Commodities**.

It integrates real-time market data, rule-based quantitative models, Black-Scholes options pricing, institutional Smart Money (FII/DII) tracking, paper trading with leaderboards, voice-driven AI interactions, and comprehensive financial calculators.

---

> ⚠️ **Disclaimer:** PredictX is an educational and analytical research project. Quantitative models, technical signals, forecast curves, and IPO ratings do not constitute certified financial or investment advice. Always verify with registered financial advisors and perform personal risk assessments.

---

## 🌟 Key Highlights & Modules

### 📊 1. Core Forecasting & Analysis
- **Algorithmic Forecasting Engine**: Multi-horizon price projections (1-day, 7-day, 30-day) with statistical confidence scoring and error boundaries.
- **Model Accuracy & Track Record**: Real-time prediction logging (`/trackrecord`) comparing past predicted targets with actual market closes.
- **Explainable Quantitative Signals**: Multi-indicator scoring (-100 to +100) combining RSI, MACD crossovers, moving average slopes, Bollinger Band positioning, and volume expansion.
- **Historical Data Export**: One-click CSV and JSON export of historical trading sessions and OHLCV data.

### 📈 2. Interactive Charts & Technical Overlays
- **Multi-Timeframe Candlestick & Area Charts**: Seamlessly switch between Daily, Weekly, and Monthly resolutions.
- **Technical Indicator Suite**:
  - Overlays: SMA (20, 50, 100, 200), EMA (20, 50), Bollinger Bands (20, 2), Supertrend (10, 3), Fibonacci Retracements, and Classic Floor Pivots (P, R1-R2, S1-S2).
  - Oscillators: RSI(14) with overbought/oversold bands, MACD (12, 26, 9) with histogram bars, and volume moving averages.
- **Automated Candlestick Pattern Detection**: Highlights Doji, Hammer, Inverted Hammer, Shooting Star, Bullish & Bearish Engulfing, and Morning/Evening Star patterns.

### ⚡ 3. Institutional Option Chain & Greeks Engine
- **Live Option Chain**: Real-time Call (CE) and Put (PE) grid around At-The-Money (ATM) for NIFTY, BANK NIFTY, FIN NIFTY, and SENSEX.
- **Black-Scholes Greeks Calculator**: Dynamic Delta, Gamma, Theta, and Vega computed per leg and strike.
- **Open Interest Analytics**:
  - Total Open Interest distribution charts.
  - Change in OI (Open Interest unwinding vs accumulation).
  - Put-Call Ratio (PCR) trend indicator and Max Pain estimation.
- **Broker Gateway**: Direct integration with **Angel One SmartAPI** for live option chain streams and tick-level updates.

### 🐋 4. Smart Money & Institutional Flows
- **FII / DII Flow Tracker**: Daily and monthly institutional net cash equity and F&O position changes.
- **Bulk & Block Deals**: Real-time radar capturing large institutional orders and promoter transactions.
- **Sector Rotation Heatmap**: Visual capital flow mapping across Banking, IT, Auto, Pharma, FMCG, Metal, and Energy.
- **Smart Money Sentiment Gauge**: Composite institutional conviction reading.

### 🎮 5. Paper Trading Simulator & Leaderboard
- **Virtual ₹10,00,000 Portfolio**: Risk-free sandbox environment with realistic market execution for stocks and indices.
- **Order Management & Journal**: Market buy/sell orders, stop-loss triggers, portfolio P&L tracking, and trade log history.
- **Global Leaderboard**: Public performance ranking system with optional Supabase persistence.
- **Trade Journal & Psychology**: Log trade thesis, entry/exit rationale, mistakes, and emotional state.

### 🤖 6. AI Assistant & Voice Intelligence
- **Ask PredictX**: Natural language and Hinglish financial assistant for stock queries, technical summaries, and valuation insights.
- **Voice Commands**: Voice-activated navigation, symbol lookup, and voice-prompted stock analysis.
- **Financial Report & Filing Analyzer**: Heuristic scanner evaluating earnings releases, concalls, and corporate filings for key financial metrics (revenue, EBITDA, margins, net profit) and tone sentiment.

### 📅 7. Dividends & Income Investing
- **Dividend Calendar**: Upcoming ex-dividend dates, record dates, and payout distributions.
- **Dividend Yield Tracker**: Historical dividend yields, dividend growth trajectories, and sustainability metrics.
- **Portfolio Dividend Projector**: Forecast expected annual dividend income based on your current holdings.

### 🚀 8. IPO Predictor
- **Listing Day Projection**: Algorithmic Apply / Neutral / Avoid recommendation model.
- **Factors Analyzed**: Current Grey Market Premium (GMP %), Retail / QIB / NII oversubscription multiples, issue valuation (P/E), issue size, and promoter background.

### 🔍 9. Real-Time Scanners
- **Breakout Scanner**: 20-day and 52-week high breakouts backed by 1.5x+ volume spikes.
- **Gap Up / Gap Down Radar**: Session opening price gaps with configurable percentage thresholds.
- **Momentum Scanner**: Rate of Change (ROC) and Relative Strength (RS) screeners.
- **Golden & Death Cross**: 50 SMA and 200 SMA moving average crossover alerts.

### 🧮 10. Financial & Regulatory Calculators
- **Capital Gains Tax Planner**: Updated for Budget 2024 tax slabs (STCG 20%, LTCG 12.5% with ₹1.25L exemption).
- **Brokerage & Transaction Charges**: Computes STT, exchange turnover fees, SEBI charges, GST, and stamp duty for NSE/BSE.
- **Wealth & Retirement Planning**: SIP, Step-Up SIP, CAGR, XIRR, and Loan EMI calculators with amortisation schedules.

---

## 🛠️ Technology Architecture

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Tailwind CSS v4, Lucide Icons |
| **Data Visualization** | Recharts, SVG Financial Charts |
| **Backend API** | Node.js (v22), Express 5, `tsx` TypeScript runtime |
| **Dev Environment** | Vite 6 (Middleware Mode on Port 3000) |
| **Optional Integrations** | Angel One SmartAPI, Supabase (PostgreSQL), Resend (Email Digest) |
| **Data Formats** | RESTful JSON, Black-Scholes Greeks Engine, LocalStorage Engine |

---

## 📂 Project Directory Structure

```
PredictX/
├── index.html                   # HTML entry point with metadata & SEO tags
├── metadata.json                # AI Studio application metadata & capabilities
├── package.json                 # Scripts and dependencies
├── server.ts                    # Fullstack server (Vite middleware + Express API)
├── tsconfig.json                # TypeScript configuration
├── vite.config.ts               # Vite bundler configuration
├── .env.example                 # Environment variables specification
├── README.md                    # Project documentation
│
├── api/                         # Serverless API endpoints
│   └── index.ts                 # Serverless adapter for deployment targets
│
└── src/
    ├── App.tsx                  # Core app router, navigation state & layout
    ├── main.tsx                 # Client application entry point
    ├── index.css                # Tailwind CSS v4 global styling
    │
    ├── components/              # Modular UI components
    │   ├── Navbar.tsx           # Global header with live ticker & theme switcher
    │   ├── Sidebar.tsx          # Collapsible navigation sidebar & market switcher
    │   ├── QuickNavHeader.tsx   # Fast section shortcuts
    │   ├── Footer.tsx           # Global footer & disclaimer
    │   ├── StockSplitView.tsx   # Side-by-side comparative views
    │   ├── NseOptionChainTable  # Interactive options chain
    │   ├── OptionOiChart.tsx    # Total Open Interest visualization
    │   ├── OptionChangeOiChart  # Change in Open Interest visualization
    │   ├── DividendCalendar.tsx # Ex-date and payment dates calendar
    │   ├── StockChatbot.tsx     # Conversational assistant component
    │   └── AlertNotificationToast # Live trigger alerts
    │
    ├── pages/                   # 24 Dashboard views
    │   ├── HomePage.tsx         # Dashboard overview & price prediction chart
    │   ├── AskPredictXPage.tsx  # Conversational AI assistant
    │   ├── ChartsPage.tsx       # Candlestick charts & technical indicators
    │   ├── OptionAnalyzerPage   # Options chain, Greeks, & PCR analytics
    │   ├── SmartMoneyPage.tsx   # Institutional FII/DII flow monitor
    │   ├── PaperTradingPage.tsx # Virtual ₹10,00,000 trading simulator
    │   ├── TradeJournalPage.tsx # Trading journal & psychology notes
    │   ├── TrackRecordPage.tsx  # Forecast accuracy verification
    │   ├── ScannersPage.tsx     # Breakouts, Gaps, Momentum, Crossovers
    │   ├── GlobalMarketsPage    # Global indices, currencies & commodities
    │   ├── StockComparePage.tsx # Head-to-head multi-stock comparisons
    │   ├── DividendPage.tsx     # Dividend calendar & projector
    │   ├── IPOPredictorPage.tsx # IPO listing-day gain predictor
    │   ├── PortfolioPage.tsx    # Portfolio tracker & diversification score
    │   ├── WatchlistPage.tsx    # Multi-market ticker watchlist
    │   ├── InvestmentToolsPage  # Tax, SIP, EMI, and brokerage calculators
    │   ├── StrategyLabPage.tsx  # Historical strategy backtester
    │   ├── ReportAnalyzerPage   # Financial report & concall tone analyzer
    │   ├── CompanyInfoPage.tsx  # Fundamental profile & valuation multiples
    │   ├── NewsPage.tsx         # Market news & sentiment analysis
    │   ├── AlertsPage.tsx       # Price alerts & notification channels
    │   ├── AdvancedPage.tsx     # Sector correlation & advanced utilities
    │   └── AccountPage.tsx      # User profile, 2FA, & Angel One settings
    │
    ├── server/                  # Backend Express routes & services
    │   ├── app.ts               # Express router setup & Yahoo/data fallbacks
    │   ├── angel.ts             # Angel One SmartAPI client & TOTP generator
    │   ├── angelOptions.ts      # Real-time option chain data service
    │   ├── batchQuotes.ts       # Batched quote fetching service
    │   ├── scanner.ts           # Market screening algorithms
    │   ├── smartMoney.ts        # FII / DII tracking services
    │   ├── ipo.ts               # IPO pipeline & subscription parser
    │   └── social.ts            # Leaderboard & Resend email digest service
    │
    └── utils/                   # Mathematics, financial models & utilities
        ├── aiEngine.ts          # Forecast projections & signal scoring
        ├── backtester.ts        # Strategy simulation engine
        ├── calculators.ts       # Tax (Budget 2024), SIP, CAGR, XIRR, EMI
        ├── greeks.ts            # Black-Scholes Delta, Gamma, Theta, Vega
        ├── indicators.ts        # RSI, MACD, Bollinger, Supertrend, Pivots
        ├── ipoModel.ts          # IPO listing gain calculation engine
        ├── marketData.ts        # Curated market data & symbol catalogs
        ├── patterns.ts          # Candlestick pattern recognition
        ├── storage.ts           # LocalStorage persistence manager
        └── voiceAi.ts           # Speech recognition & voice commands
```

---

## ⚡ Quick Start & Local Setup

### Prerequisites
- **Node.js**: v20 or v22 LTS
- **npm**: v10+

### 1. Clone the repository
```bash
git clone https://github.com/Ajaykumar187/PredictX.git
cd PredictX
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables (Optional)
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in any optional API keys if you wish to enable live broker feeds or email alerts:
```ini
PORT=3000
NODE_ENV=development

# Angel One SmartAPI (Optional: for real-time live Indian market option chain)
ANGEL_BASE_URL=https://apiconnect.angelone.in
ANGEL_API_KEY=
ANGEL_CLIENT_CODE=
ANGEL_PIN=
ANGEL_TOTP_SECRET=

# Supabase (Optional: for cloud leaderboard & sync)
SUPABASE_URL=
SUPABASE_SERVICE_KEY=

# Resend (Optional: for daily email watchlist digest)
RESEND_API_KEY=
RESEND_FROM=
CRON_SECRET=
```
*(If no environment variables are provided, PredictX automatically operates with its built-in market data engine and analytical fallbacks.)*

### 4. Start the application
```bash
npm run dev
```

Visit the dashboard in your browser:
```
http://localhost:3000
```

---

## 🚀 Available Scripts

| Command | Action |
|---|---|
| `npm run dev` | Launches the fullstack development server (Express + Vite) on port 3000 |
| `npm run build` | Compiles TypeScript and builds the optimized production bundle with Vite |
| `npm start` | Runs the production Node.js server (`server.ts`) serving the built client |
| `npm run lint` | Runs TypeScript type-checking without emitting files (`tsc --noEmit`) |
| `npm run preview` | Previews the production build locally via Vite preview on port 3000 |

---

## ☁️ Deployment

PredictX is designed to deploy seamlessly to all modern cloud environments:

### AI Studio & Cloud Run
PredictX is pre-configured for containerized environments. It listens on host `0.0.0.0` and port `3000` via `server.ts`.

### Vercel
PredictX includes a `vercel.json` configuration and an `api/index.ts` serverless handler:
1. Connect your GitHub repository to Vercel.
2. The root configuration will automatically configure the build and API routes.
3. Deploy directly without additional configuration.

### Render / Railway / Docker
Run standard container commands:
- Build command: `npm run build`
- Start command: `npm start`

---

## 🔒 Security & Privacy

- All user portfolios, watchlists, paper trades, and alert configurations are stored privately within your local browser storage by default.
- No broker credentials or personal data are exposed or stored without user consent.
- All server routes validate input parameters and sanitize queries.

---

## 👨‍💻 Author & Maintainer

**Ajay Kumar**
- GitHub: [@Ajaykumar187](https://github.com/Ajaykumar187)

---

## 📄 License

This project is licensed under the MIT License — see the repository for full license terms.
