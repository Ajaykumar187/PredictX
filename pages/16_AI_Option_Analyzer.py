import streamlit as st
from datetime import datetime

from utils.styling import inject_css, navbar, loading
from utils.option_chain import OptionChain
from utils.option_analyzer import OptionAnalyzer
from utils.market_data import MarketData
from utils.market import INDEX_MAP
from utils.data_fetch import get_history
from utils.indicators import TechnicalIndicators
from utils.greeks import BlackScholes
from utils.implied_volatility import ImpliedVolatility
from utils.ai_signal import AISignalEngine
from utils.config import RISK_FREE_RATE, DEFAULT_IV

# PAGE CONFIG

st.set_page_config(
    page_title="PredictX AI Option Analyzer",
    page_icon="🤖",
    layout="wide",
    initial_sidebar_state="expanded"
)

inject_css()
navbar("🤖 PredictX AI Option Analyzer", "Live Option Chain Analytics powered by Angel One SmartAPI")

# SIDEBAR

st.sidebar.title("⚙ PredictX")

index = st.sidebar.selectbox(
    "Select Index",
    [
        "NIFTY",
        "BANKNIFTY",
        "FINNIFTY"
    ]
)

try:
    option_chain = OptionChain()
except Exception as e:
    st.error(
        f"Couldn't connect to Angel One SmartAPI ({e}).\n\n"
        "Copy `.env.example` to `.env` in your project folder and fill in your "
        "Angel One SmartAPI credentials, then restart the app."
    )
    st.stop()

expiries = option_chain.available_expiries(index)

expiry = None

if expiries:
    expiry = st.sidebar.selectbox(
        "Expiry",
        expiries
    )

refresh = st.sidebar.button("🔄 Refresh")

if refresh:
    st.cache_data.clear()
    st.rerun()

# HEADER

st.divider()

# LOAD OPTION CHAIN

try:

    with st.spinner("Loading Option Chain..."):

        analyzer = OptionAnalyzer()

        raw_chain = option_chain.get_live_chain(
            index=index,
            expiry=expiry
        )

        if raw_chain.empty:

            st.warning("No contracts found.")

            st.stop()

        chain = analyzer.merge_chain(raw_chain)

except Exception as e:

    st.error(f"Error : {e}")

    st.stop()

# LIVE MARKET OVERVIEW

spot_price = None
atm = None
call_price = None
put_price = None
call_symbol = None
put_symbol = None

try:
    spot_price = option_chain.market.get_index_price(index)
except Exception as e:
    spot_price = None
    st.caption(f"⚠️ Couldn't fetch live spot price for {index}: {e}")

# ATM STRIKE

if spot_price is not None:

    atm = analyzer.find_atm(
        chain,
        spot_price
    )

    chain = analyzer.add_distance(
        chain,
        atm
    )

else:

    atm = chain.iloc[
        len(chain) // 2
    ]["Strike"]

row = chain[
    chain["Strike"] == atm
]

if not row.empty:

    row = row.iloc[0]

    call_price = row["CE_LTP"]
    put_price = row["PE_LTP"]
    call_symbol = row.get("CE_Symbol")
    put_symbol = row.get("PE_Symbol")

# METRIC CARDS

col1, col2, col3, col4 = st.columns(4)

col1.metric(
    "Spot Price",
    f"₹{spot_price:,.2f}" if spot_price else "Unavailable"
)

col2.metric(
    "ATM Strike",
    atm
)

col3.metric(
    "ATM Call",
    f"₹{call_price:.2f}" if call_price else "--"
)

col4.metric(
    "ATM Put",
    f"₹{put_price:.2f}" if put_price else "--"
)

st.divider()

# OPTION CHAIN

st.subheader("📊 Live Option Chain")

st.dataframe(
    chain,
    use_container_width=True,
    hide_index=True
)

# ANALYTICS + AI RECOMMENDATION (ATM strike, CE & PE)

left, right = st.columns([2, 1])

days_to_expiry = None
latest_rsi = None
ema_fast = None
ema_slow = None
tech_error = None

if expiry:
    try:
        expiry_date = datetime.strptime(expiry, "%d%b%Y")
        days_to_expiry = max((expiry_date - datetime.now()).days, 1)
    except Exception:
        days_to_expiry = None

yf_symbol = INDEX_MAP.get(index)
if yf_symbol:
    try:
        hist = get_history(yf_symbol, period="6mo")
        if not hist.empty and len(hist) > 30:
            rsi_series = TechnicalIndicators.rsi(hist, 14)
            ema_fast_series = TechnicalIndicators.ema(hist, 9)
            ema_slow_series = TechnicalIndicators.ema(hist, 21)
            latest_rsi = float(rsi_series.iloc[-1])
            ema_fast = float(ema_fast_series.iloc[-1])
            ema_slow = float(ema_slow_series.iloc[-1])
        else:
            tech_error = f"Not enough historical data for {yf_symbol} yet."
    except Exception as e:
        tech_error = f"Couldn't fetch underlying technicals for {yf_symbol}: {e}"
else:
    tech_error = f"No Yahoo Finance mapping configured for {index}."

can_analyze = (
    spot_price is not None
    and days_to_expiry is not None
    and latest_rsi is not None
    and ema_fast is not None
    and ema_slow is not None
)

with left:

    st.subheader("📈 Analytics — Greeks & Implied Volatility")

    if not can_analyze:
        st.info(
            "Analytics need a live spot price, a valid expiry, and underlying "
            "technicals (RSI/EMA) — one or more of these isn't available right now."
            + (f" ({tech_error})" if tech_error else "")
        )
    else:
        analytics_cols = st.columns(2)

        for col, opt_type, price, label in [
            (analytics_cols[0], "call", call_price, "Call (CE)"),
            (analytics_cols[1], "put", put_price, "Put (PE)"),
        ]:
            with col:
                st.markdown(f"**{label}**")

                if not price:
                    st.caption("No LTP available for this leg.")
                    continue

                try:
                    iv = ImpliedVolatility.calculate(
                        market_price=price,
                        S=spot_price,
                        K=atm,
                        T=days_to_expiry / 365,
                        r=RISK_FREE_RATE,
                        option_type=opt_type,
                    )
                    if iv is None:
                        iv = DEFAULT_IV

                    bs = BlackScholes(
                        spot=spot_price,
                        strike=atm,
                        time_to_expiry=days_to_expiry / 365,
                        risk_free_rate=RISK_FREE_RATE,
                        volatility=iv / 100,
                    )
                    greeks = bs.summary()

                    st.metric("Implied Volatility", f"{iv:.2f}%")
                    g1, g2 = st.columns(2)
                    g1.metric("Delta", greeks["Call Delta"] if opt_type == "call" else greeks["Put Delta"])
                    g2.metric("Theta", greeks["Call Theta"] if opt_type == "call" else greeks["Put Theta"])
                    g3, g4 = st.columns(2)
                    g3.metric("Gamma", greeks["Gamma"])
                    g4.metric("Vega", greeks["Vega"])

                except Exception as e:
                    st.caption(f"Couldn't compute Greeks/IV: {e}")

with right:

    st.subheader("🤖 AI Recommendation")

    if not can_analyze:
        st.info(
            "The AI signal needs the same inputs as the Analytics panel — "
            "check the message on the left for what's missing."
        )
    else:
        try:
            ai = AISignalEngine(
                spot=spot_price,
                strike=atm,
                call_delta=BlackScholes(
                    spot=spot_price,
                    strike=atm,
                    time_to_expiry=days_to_expiry / 365,
                    risk_free_rate=RISK_FREE_RATE,
                    volatility=DEFAULT_IV / 100,
                ).call_delta(),
                put_delta=BlackScholes(
                    spot=spot_price,
                    strike=atm,
                    time_to_expiry=days_to_expiry / 365,
                    risk_free_rate=RISK_FREE_RATE,
                    volatility=DEFAULT_IV / 100,
                ).put_delta(),
                iv=DEFAULT_IV,
                rsi=latest_rsi,
                ema_fast=ema_fast,
                ema_slow=ema_slow,
            ).generate()

            st.metric("Signal", ai["Signal"])
            st.metric("Confidence", f"{ai['Confidence']}%")
            st.metric("Risk", ai["Risk"])

            if ai["Signal"] == "BUY CALL":
                st.success(f"🟢 {ai['Signal']}")
            elif ai["Signal"] == "WATCH":
                st.warning(f"🟡 {ai['Signal']}")
            else:
                st.error(f"🔴 {ai['Signal']}")

            with st.expander("Why this signal?", expanded=True):
                for reason in ai["Reasons"]:
                    st.write("•", reason)

        except Exception as e:
            st.caption(f"Couldn't generate AI signal: {e}")

st.caption(
    "Greeks/IV use each leg's own LTP; the AI signal uses a representative IV "
    "since it scores overall trend/momentum rather than one specific leg. "
    "This is a rule-based heuristic, not financial advice."
)
