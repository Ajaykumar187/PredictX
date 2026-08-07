import os
import matplotlib.pyplot as plt
import pandas as pd
import streamlit as st

st.set_page_config(page_title="Stock Prediction Dashboard", layout="wide", initial_sidebar_state="expanded")

try:
    for _key, _value in st.secrets.items():
        if isinstance(_value, str):
            os.environ.setdefault(_key, _value)
except Exception:
    pass

from utils.styling import inject_css, navbar, loading
from utils.sidebar import stock_selector_sidebar
from utils.market import format_currency, strip_suffix
from utils.pipeline import run_analysis
from utils.diagnostics import find_stray_page_files

market, symbol_input, yf_symbol, load_clicked = stock_selector_sidebar()

inject_css()

st.markdown("""
<style>
button[aria-label="Close sidebar"], 
button[aria-label="Open sidebar"],
[data-testid="stSidebarCollapseButton"] {
    background-color: #132942 !important;
    border: 1px solid #00BCD4 !important;
    border-radius: 8px !important;
}

button[aria-label="Close sidebar"] svg, 
button[aria-label="Open sidebar"] svg,
[data-testid="stSidebarCollapseButton"] svg {
    fill: #00BCD4 !important;
    stroke: #00BCD4 !important;
}

div[data-baseweb="input"] > div {
    background: #ffffff !important;
}

div[data-baseweb="input"] input {
    color: #000000 !important;
    -webkit-text-fill-color: #000000 !important;
    caret-color: #000000 !important;
    font-weight: 600 !important;
}

div[data-baseweb="input"] input::placeholder{
    color:#777777 !important;
}

div[data-baseweb="input"]:focus-within{
    border:2px solid #2196F3 !important;
    border-radius:10px;
}
</style>
""", unsafe_allow_html=True)

navbar("Stock Prediction Dashboard", "Search • Analyze • Predict — NSE, BSE & US markets")

stray_files = find_stray_page_files()
if stray_files:
    st.warning(
        "Found old/duplicate page file(s) in your `pages/` folder, which is usually why the sidebar "
        "shows repeated or garbled entries and why fixes can seem like they 'didn't apply': \n\n"
        + "\n".join(f"- `{f}`" for f in stray_files)
        + "\n\nRun `python cleanup_old_pages.py` from your project folder, then fully restart "
          "(Ctrl+C and re-run `streamlit run app.py` — a browser refresh alone isn't enough)."
    )

# FEATURE CARDS (customizable)
show_cards = st.checkbox("Show feature cards", value=st.session_state.get("show_feature_cards", True))
st.session_state.show_feature_cards = show_cards

if show_cards:
    c1, c2, c3, c4 = st.columns(4)
    with c1:
        st.markdown("<div class='card'><h3>AI Prediction</h3><p>LSTM forecasting + rule-based Buy/Sell/Hold</p></div>", unsafe_allow_html=True)
    with c2:
        st.markdown("<div class='card'><h3>Multi-market</h3><p>NSE/BSE/US stocks, plus Nifty 50, Bank Nifty & other indices</p></div>", unsafe_allow_html=True)
    with c3:
        st.markdown("<div class='card'><h3>AI Option Analyzer</h3><p>Live Angel One chain, Greeks, IV, and an AI signal</p></div>", unsafe_allow_html=True)
    with c4:
        st.markdown("<div class='card'><h3>Themeable UI</h3><p>Light / dark mode, responsive layout</p></div>", unsafe_allow_html=True)

st.markdown("")

with st.expander("Feature roadmap (what's implemented where)"):
    st.markdown("""
| Phase | Where to find it |
|---|---|
| 1. Core Features | This page — now also select **Index** as a market for Nifty 50, Bank Nifty, Fin Nifty, Sensex, Midcap Nifty |
| 2. Charts & Analysis | **Charts & Analysis** page |
| 3. AI Features | **AI Features** page |
| 4. Company Information | **Company Info** page |
| 5. News & Sentiment | **News & Sentiment** page |
| 6. Portfolio Management | **Portfolio** page |
| 7. Alerts | **Alerts** page |
| 8. User Account | **Account** page |
| 9. Dashboard UI | Theme toggle in every sidebar; animated cards throughout |
| 10. Advanced Features | **Advanced** page |
| 11. Option Chain | **AI Option Analyzer** page — live Angel One SmartAPI chain, Greeks, IV, and an AI Buy/Watch/Avoid signal |
| 12. IPO Predictor | **IPO Predictor** page — live NSE upcoming-IPO list plus a manual GMP/subscription-based AI Apply/Avoid reading |
""")

recently_viewed = st.session_state.get("recently_viewed", [])
if recently_viewed:
    st.markdown("##### Recently viewed")
    rv_cols = st.columns(min(6, len(recently_viewed)))
    for i, sym in enumerate(recently_viewed[:6]):
        if rv_cols[i].button(strip_suffix(sym), key=f"rv_{sym}"):
            st.session_state.yf_symbol = sym
            st.session_state.stock_loaded = True

# MAIN LOGIC 
if load_clicked or st.session_state.get("stock_loaded"):
    try:
        with loading(f"Downloading and analysing {yf_symbol}..."):
            result = run_analysis(yf_symbol, market, force=load_clicked)

        if result is None:
            st.error("Invalid stock symbol, or not enough historical data (need 120+ trading days).")
            st.stop()

        recently_viewed = st.session_state.get("recently_viewed", [])
        if yf_symbol in recently_viewed:
            recently_viewed.remove(yf_symbol)
        recently_viewed.insert(0, yf_symbol)
        st.session_state.recently_viewed = recently_viewed[:6]

        df = result["df"]
        latest_price = result["latest_price"]
        change = result["change"]
        change_pct = result["change_pct"]
        currency_fmt = result["currency_fmt"]

        st.subheader(f"{result['symbol']} · {market}")

        m1, m2, m3, m4 = st.columns(4)
        m1.metric("Current Price", currency_fmt(latest_price))
        m2.metric("Change", f"{change:.2f}", f"{change_pct:.2f}%")
        m3.metric("Data Points", len(df))
        m4.metric("Model Confidence", f"{result['confidence']}%")

        st.markdown("### Historical Data")
        st.dataframe(df.tail(15).sort_index(ascending=False), use_container_width=True)
        st.download_button("Download full history (CSV)", df.to_csv().encode("utf-8"),
                            file_name=f"{result['symbol']}_history.csv", mime="text/csv")

        st.markdown("### LSTM Price Prediction (validation)")
        lstm = result["lstm"]
        train = df["Close"][:lstm["train_len"]]
        valid_index = df.index[lstm["train_len"]:lstm["train_len"] + len(lstm["actual"])]
        valid = pd.DataFrame({
            "Close": lstm["actual"], "Predictions": lstm["predictions"]
        }, index=valid_index)

        fig, ax = plt.subplots(figsize=(12, 6))
        ax.plot(train.index, train.values, label="Training", color="#0a2540")
        ax.plot(valid.index, valid["Close"], label="Actual", color="#ff9900")
        ax.plot(valid.index, valid["Predictions"], label="Predicted", color="#2ecc71")
        ax.legend()
        ax.set_title(f"{result['symbol']} — Price Prediction")
        st.pyplot(fig)

        st.success("Analysis complete — check the other pages in the sidebar for charts, AI signals, company info, news, portfolio tools, alerts, and more.")
        st.session_state.stock_loaded = True

    except Exception as e:
        st.error(f"Error: {e}")
else:
    st.info("Choose a market and symbol in the sidebar, then click **Load / Refresh Stock** to begin.")
