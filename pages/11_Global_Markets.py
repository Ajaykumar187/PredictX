import plotly.graph_objects as go
import streamlit as st

from utils.styling import inject_css, navbar, loading
from utils.sidebar import stock_selector_sidebar
from utils.market import strip_suffix
from utils.screener_universe import universe_for_market
from utils.scanners import fetch_universe_history
from utils.global_markets import fetch_global_snapshot, market_breadth, market_mood_index

st.set_page_config(page_title="Global Markets", layout="wide", initial_sidebar_state="expanded")

market, symbol_input, yf_symbol, load_clicked = stock_selector_sidebar()

inject_css()
navbar("Global Markets", "World indices, commodities, a movers heatmap, and market-wide mood")

st.markdown("### World Indices & Commodities")
with loading("Fetching global snapshot..."):
    global_df = fetch_global_snapshot()

if global_df.empty:
    st.warning("Couldn't fetch global market data right now.")
else:
    cols = st.columns(3)
    for i, row in global_df.iterrows():
        with cols[i % 3]:
            st.metric(row["name"], f"{row['price']:,.2f}", f"{row['pct']:+.2f}%")
st.caption("SGX/GIFT Nifty isn't included — there's no reliable free ticker for it via this app's data source.")

st.markdown("---")
st.markdown("### Top Movers Heatmap")
scan_market = "NSE" if market in ("NSE", "BSE", "INDEX") else "US"
universe = universe_for_market(scan_market)

if st.button("Refresh heatmap & market mood"):
    with loading(f"Fetching {len(universe)} symbols concurrently..."):
        st.session_state.gm_history = fetch_universe_history(universe, period="3mo")

history = st.session_state.get("gm_history", {})
if not history:
    st.info("Click **Refresh heatmap & market mood** to load this section.")
else:
    names, changes, sizes = [], [], []
    for symbol, df in history.items():
        if len(df) < 2:
            continue
        pct = (df["Close"].iloc[-1] / df["Close"].iloc[-2] - 1) * 100
        names.append(strip_suffix(symbol))
        changes.append(round(pct, 2))
        sizes.append(float(df["Volume"].iloc[-1]) if "Volume" in df else 1.0)

    fig = go.Figure(go.Treemap(
        labels=names, parents=[""] * len(names), values=sizes,
        marker=dict(colors=changes, colorscale="RdYlGn", cmid=0, showscale=True),
        text=[f"{n}<br>{c:+.2f}%" for n, c in zip(names, changes)], textinfo="text"
    ))
    fig.update_layout(height=420, margin=dict(t=10, b=10))
    st.plotly_chart(fig, use_container_width=True)

    st.markdown("### Market Mood Index (breadth-based)")
    pct_above, avg_mom, counted = market_breadth(history)
    mood_score, mood_label = market_mood_index(pct_above, avg_mom)
    m1, m2, m3 = st.columns(3)
    m1.metric("% above 50-day SMA", f"{pct_above:.0f}%")
    m2.metric("Avg 10-day momentum", f"{avg_mom:+.2f}%")
    m3.metric("Market Mood", mood_label, f"{mood_score}/100")
    st.progress(mood_score / 100)
    st.caption(f"Based on {counted} symbols in the curated universe — a simplified breadth proxy, "
               "not a comprehensive market-wide index.")
