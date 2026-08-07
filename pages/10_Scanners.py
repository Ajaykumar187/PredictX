import streamlit as st

from utils.styling import inject_css, navbar, loading
from utils.sidebar import stock_selector_sidebar
from utils.market import strip_suffix
from utils.screener_universe import universe_for_market
from utils.scanners import fetch_universe_history, scan_breakouts, scan_gaps, scan_momentum, scan_swing

st.set_page_config(page_title="Scanners", layout="wide", initial_sidebar_state="expanded")

market, symbol_input, yf_symbol, load_clicked = stock_selector_sidebar()

inject_css()
navbar("Scanners", "Breakout, gap, momentum, and swing scans over a curated symbol universe")

st.caption("Runs against a fixed list of well-known symbols, not the full exchange — a real screener/scanner "
           "vendor would be needed for exchange-wide coverage. Fetches happen concurrently to keep this fast.")

scan_market = "NSE" if market in ("NSE", "BSE", "INDEX") else "US"
universe = universe_for_market(scan_market)

tab1, tab2, tab3, tab4 = st.tabs(["Breakout", "Gap Up/Down", "Momentum", "Swing (Golden Cross)"])

if "scanner_history" not in st.session_state:
    st.session_state.scanner_history = {}

if st.button("Refresh scanner data"):
    with loading(f"Fetching {len(universe)} symbols concurrently..."):
        st.session_state.scanner_history = fetch_universe_history(universe, period="6mo")

history = st.session_state.scanner_history
if not history:
    st.info("Click **Refresh scanner data** to run the scans.")
    st.stop()

def _display(df):
    if df.empty:
        st.write("No matches right now.")
    else:
        out = df.copy()
        out["symbol"] = out["symbol"].apply(strip_suffix)
        st.dataframe(out, use_container_width=True)

with tab1:
    st.markdown("### Breakout Scanner")
    st.caption("Symbols whose latest close broke above the prior 20-day high.")
    _display(scan_breakouts(history, window=20))

with tab2:
    st.markdown("### Gap Up / Gap Down Scanner")
    min_gap = st.slider("Minimum gap %", 0.5, 10.0, 2.0, 0.5)
    st.caption("Symbols whose most recent open gapped away from the prior close by at least this much.")
    _display(scan_gaps(history, min_gap_pct=min_gap))

with tab3:
    st.markdown("### Momentum Scanner")
    lookback = st.slider("Lookback (trading days)", 3, 30, 10)
    st.caption(f"Ranked by {lookback}-day rate of change.")
    _display(scan_momentum(history, lookback=lookback))

with tab4:
    st.markdown("### Swing Trade Scanner (Golden Cross)")
    st.caption("Fast SMA(20) crossed above slow SMA(50) within the last 3 bars.")
    _display(scan_swing(history, sma_fast=20, sma_slow=50))
