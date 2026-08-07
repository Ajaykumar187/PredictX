# 📈 PredictX — Stock Prediction & Analysis Dashboard

A full-featured Streamlit dashboard for analyzing and forecasting stocks across **NSE, BSE, US markets, and major Indian indices** — combining an LSTM price forecaster, rule-based trading signals, technical scanners, a live NSE option chain, portfolio tools, and multi-channel price alerts, all in one app.

> ⚠️ **Disclaimer:** This project is for educational and informational purposes only. Nothing it produces — predictions, signals, scores, or summaries — is financial advice. Always do your own research before making investment decisions.

---

## ✨ Features

### 📊 Charts, Analysis & AI
- LSTM-based multi-day price forecasting with a validation chart (train vs. actual vs. predicted)
- Rule-based Buy / Sell / Hold signal with a confidence score and plain-language risk summary
- 20+ technical indicators — SMA, EMA, RSI, MACD, Bollinger Bands, Ichimoku Cloud, Supertrend, ADX, ATR, Stochastic RSI, CCI, OBV, MFI, Pivot Points, Donchian & Keltner Channels, Parabolic SAR
- Fibonacci retracement overlay, multi-timeframe (Daily/Weekly/Monthly) charts
- Rule-based candlestick pattern recognition (Doji, Hammer, Engulfing, Morning/Evening Star) and chart-pattern scanning (Double Top/Bottom, Head & Shoulders)

### 🌍 Markets Covered
- **NSE**, **BSE**, and **US** stocks
- Indices as first-class citizens: **NIFTY 50, BANK NIFTY, FIN NIFTY, SENSEX, MIDCAP NIFTY**
- **Global Markets** page — Dow Jones, NASDAQ, S&P 500, FTSE 100, Nikkei 225, Hang Seng, Dollar Index, Crude Oil, Natural Gas, plus a top-movers heatmap and a market-wide breadth ("mood") index

### 🔍 Scanners & Smart Alerts
- Breakout, Gap Up/Down, Momentum, and Swing (golden cross) scanners over a curated symbol universe
- Smart Alerts on your watchlist — Breakout, Volume Spike, RSI Extremes, MACD Crossover, upcoming Earnings
- Custom price-target alerts (above/below), checked on demand

### 🔔 Notifications
- **Email** and **SMS** delivery for triggered alerts — configured once in **Account → Notifications**
- Alerts are always sent to *your own* registered email/phone, never a manually-typed recipient
- Uses your own SMTP (e.g. Gmail App Password) and Twilio credentials — no data leaves your local setup

### 💼 Portfolio & Investment Tools
- Portfolio tracking with sector allocation, a health score (diversification + concentration + volatility), and rule-based rebalancing suggestions
- Fast technical ranking of your holdings and a benchmark-vs-NIFTY comparison
- Watchlist with quick access from the Alerts and Scanners pages
- EMI, CAGR, XIRR, brokerage estimator, capital gains (STCG/LTCG) estimator, retirement & goal planners

### 🧪 Strategy Lab
- Backtester for SMA crossover and RSI mean-reversion strategies — equity curve, trade log, win rate, max drawdown vs. buy-and-hold
- Single-user, no-real-money paper trading simulator

### 🤖 AI Option Analyzer (Angel One SmartAPI)
- Live option chain for NIFTY/BANKNIFTY/FINNIFTY via your own Angel One SmartAPI login (see `.env.example`)
- ATM strike detection, per-leg Greeks (Delta/Gamma/Theta/Vega) and Implied Volatility
- Rule-based AI Buy Call / Watch / No Trade signal, driven by trend (EMA), RSI, and IV

### 🚀 IPO Predictor
- Live upcoming-IPO list pulled from NSE
- Manual analyzer: enter GMP, subscription multiples, issue size and sector sentiment for a transparent Apply/Avoid AI reading

### 📰 Company Info & News
- Company profile, corporate actions (earnings dates, dividends, splits), sector-peer comparison
- News feed with VADER sentiment scoring and a simplified Fear & Greed proxy
- AI Report Analyzer — upload an annual report/investor deck PDF for a heuristic tone scan and key-figure extraction

### 🔐 Accounts & Security
- Local signup/login with salted password hashing
- **Two-Factor Authentication (2FA)** — standard TOTP with QR code setup (compatible with Google Authenticator / Authy)
- Editable profile (email, phone), password change, and login history — all organized under **Profile / Security / Notifications / Activity** tabs on the Account page

### 🎨 UI/UX
- Light/Dark theme toggle with a customizable accent color
- Responsive, card-based layout with a shared navbar across every page
- Recently-viewed quick-access buttons on the Home page

### 🗣️ Voice & Chat
- Text-to-speech (gTTS) summaries
- Speech-to-text from an uploaded audio clip
- A rule-based chatbot that answers questions about the currently loaded stock

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| App framework | [Streamlit](https://streamlit.io/) |
| Market data | [yfinance](https://pypi.org/project/yfinance/), NSE public option-chain API |
| Forecasting | TensorFlow / Keras (LSTM) |
| Data & analysis | pandas, NumPy, scikit-learn |
| Charts | Matplotlib, Plotly |
| Sentiment | VADER Sentiment |
| Reports | fpdf2 (PDF), openpyxl (Excel), pdfplumber (PDF parsing) |
| Auth | pyotp (TOTP 2FA), qrcode |
| Notifications | smtplib (Email), Twilio REST API (SMS) |
| Voice | gTTS, SpeechRecognition |
| Storage | Local JSON files (no external database required) |

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- pip

### Installation

```bash
# 1. Clone or unzip the project
cd predictX

# 2. (Recommended) create a virtual environment
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 3b. Install the headless browser Playwright uses for NSE data (IPO Predictor)
playwright install chromium

# 4. Run the app
streamlit run app.py
```

The app opens at `http://localhost:8501`. Use the sidebar on any page to pick a market (NSE/BSE/US/Index) and symbol, then click **Load / Refresh Stock**.

> First load per symbol trains a small LSTM (a few seconds to ~a minute depending on your machine) and is cached for the rest of your session.

### Setting up the AI Option Analyzer (optional)

The **AI Option Analyzer** page needs your own [Angel One SmartAPI](https://smartapi.angelbroking.com/) credentials:
1. Copy `.env.example` to `.env` in the project root
2. Fill in `ANGEL_API_KEY`, `ANGEL_CLIENT_CODE`, `ANGEL_PIN`, and `ANGEL_TOTP_SECRET` (the TOTP *secret*, not a 6-digit code)
3. Restart the app — the first page load logs in once and reuses that session for the rest of the run

### Setting up notifications (optional)

To receive alert notifications by email or SMS:
1. Go to **Account → Notifications**
2. **Email:** enter your SMTP host/port and a sender email + app password (for Gmail, generate a 16-character App Password, not your login password)
3. **SMS:** enter your own [Twilio](https://www.twilio.com/) Account SID, Auth Token, and Twilio phone number
4. Toggle the channels on and save — alerts will now deliver automatically to the email/phone saved in your **Profile** tab

---

## 📁 Project Structure

```
predictX/
├── app.py                        # Home page — search, load, LSTM forecast
├── cleanup_old_pages.py          # Utility to remove stray/duplicate page files
├── requirements.txt
├── data/                         # Local JSON storage (created at runtime)
├── pages/
│   ├── 1_Charts_and_Analysis.py
│   ├── 2_AI_Features.py
│   ├── 3_Company_Info.py
│   ├── 4_News_and_Sentiment.py
│   ├── 5_Portfolio.py
│   ├── 6_Alerts.py
│   ├── 7_Account.py
│   ├── 8_Advanced.py
│   ├── 10_Scanners.py
│   ├── 11_Global_Markets.py
│   ├── 12_Investment_Tools.py
│   ├── 13_Strategy_Lab.py
│   ├── 14_Report_Analyzer.py
│   ├── 15_IPO_Predictor.py
│   └── 16_AI_Option_Analyzer.py
└── utils/
    ├── market.py                 # Currency formatting, NSE/BSE/US symbol detection
    ├── styling.py                 # Shared CSS, theming, navbar, cards
    ├── sidebar.py                 # Shared market/symbol picker
    ├── data_fetch.py               # Cached yfinance wrappers
    ├── indicators.py               # Technical indicators
    ├── patterns.py                  # Candlestick & chart pattern recognition
    ├── ai_engine.py                  # LSTM training, forecasting, signal/risk rules
    ├── pipeline.py                    # fetch → indicators → LSTM → signal → risk pipeline
    ├── sentiment.py                    # News sentiment + Fear & Greed proxy
    ├── scanners.py                      # Breakout/volume/RSI/MACD scanners
    ├── screener_universe.py              # Curated symbol universe
    ├── option_chain.py                    # NSE option chain fetch & analytics
    ├── global_markets.py                   # Global indices & commodities
    ├── portfolio_analytics.py               # Sector allocation, health score, rebalancing
    ├── calculators.py                        # EMI, CAGR, XIRR, tax, retirement/goal planners
    ├── backtester.py                          # Strategy backtesting engine
    ├── paper_trading.py                        # Paper trading simulator
    ├── report_analyzer.py                       # PDF report keyword/sentiment analysis
    ├── export_report.py                          # PDF/Excel report generation
    ├── chatbot.py                                 # Rule-based Q&A
    ├── voice.py                                    # Text-to-speech / speech-to-text
    ├── auth.py                                      # Signup, login, 2FA, profile, password
    ├── alerts_engine.py                              # Email/SMS senders, alert checks
    ├── storage.py                                     # JSON persistence layer
    └── diagnostics.py                                  # Stray-file / setup diagnostics
```

---

## ⚠️ Known Limitations

- **No background scheduler** — alerts are evaluated only when the Alerts page is opened or refreshed. For always-on alerts, run a small server-side cron job calling the same check logic.
- **Accounts** are local JSON files with salted-SHA256 password hashes — suitable for a demo/single-user deployment, not a production identity provider.
- **Email/SMS delivery** requires your own SMTP app password and Twilio credentials; nothing is bundled or hosted.
- **Scanners/screener** run against a small curated symbol list, not a live full-exchange feed.
- **Fear & Greed Index** is a simplified in-app proxy, not any third-party published index.
- **AI market summaries and the chatbot** are template/rule-based, generated from this app's own computed indicators — not calls to a language model.
- **Voice input** works from an uploaded audio clip rather than live microphone capture, due to Streamlit's server-rendered architecture.

## 📄 License

This project is provided as-is for educational purposes. Add a license of your choice (MIT, Apache 2.0, etc.) before distributing.

## Creator : Ajay kumar (Full Stack Developer)
