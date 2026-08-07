import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from utils.styling import inject_css, navbar, loading, badge
from utils.sidebar import stock_selector_sidebar
from utils.auth import require_login_ui, current_user
from utils.storage import get_portfolio, save_portfolio, get_watchlist, save_watchlist
from utils.data_fetch import get_quote_snapshot, get_info, get_history
from utils.market import detect_market, format_currency, strip_suffix
from utils.portfolio_analytics import (rank_universe, sector_allocation, portfolio_health_score,
                                        rebalancing_suggestion)
from utils.indicators import volatility as calc_volatility

st.set_page_config(page_title="Portfolio", layout="wide", initial_sidebar_state="expanded")

market, symbol_input, yf_symbol, load_clicked = stock_selector_sidebar()

inject_css()
navbar("Portfolio Management", "Holdings, P/L, calculators, watchlist, and portfolio insights")

if not require_login_ui():
    st.stop()

user = current_user()

tab_portfolio, tab_calc, tab_watchlist, tab_insights = st.tabs(
    ["Holdings & P/L", "Calculators", "Watchlist", "Insights"])

# Holdings & P/L
with tab_portfolio:
    st.markdown("### Add a holding")
    with st.form("add_holding"):
        c1, c2, c3, c4 = st.columns(4)
        h_market = c1.selectbox("Market", ["NSE", "BSE", "US", "INDEX"])
        h_symbol_default = "NIFTY 50" if h_market == "INDEX" else ("RELIANCE" if h_market != "US" else "AAPL")
        h_symbol = c2.text_input("Symbol", value=h_symbol_default,
                                  help="For Index, try NIFTY 50, BANK NIFTY, FIN NIFTY, SENSEX, or MIDCAP NIFTY.")
        h_qty = c3.number_input("Quantity", min_value=1, value=10)
        h_buy_price = c4.number_input("Buy price / unit", min_value=0.0, value=100.0)
        submitted = st.form_submit_button("Add to portfolio")
        if submitted:
            holdings = get_portfolio(user)
            holdings.append({
                "market": h_market, "symbol": h_symbol.upper(),
                "yf_symbol": detect_market(h_symbol, h_market),
                "quantity": h_qty, "buy_price": h_buy_price
            })
            save_portfolio(user, holdings)
            st.success(f"Added {h_qty} × {h_symbol.upper()} to your portfolio.")
            st.rerun()

    holdings = get_portfolio(user)
    if not holdings:
        st.info("No holdings yet — add one above.")
    else:
        rows = []
        total_invested = 0
        total_current = 0
        for h in holdings:
            snap = get_quote_snapshot(h["yf_symbol"])
            current_price = snap.get("price", h["buy_price"])
            invested = h["quantity"] * h["buy_price"]
            current_value = h["quantity"] * current_price
            pnl = current_value - invested
            pnl_pct = (pnl / invested * 100) if invested else 0
            total_invested += invested
            total_current += current_value
            rows.append({
                "Symbol": h["symbol"], "Market": h["market"], "Qty": h["quantity"],
                "Buy Price": h["buy_price"], "Current Price": round(current_price, 2),
                "Invested": round(invested, 2), "Current Value": round(current_value, 2),
                "P/L": round(pnl, 2), "P/L %": round(pnl_pct, 2)
            })
        df = pd.DataFrame(rows)
        st.dataframe(df, use_container_width=True)

        total_pnl = total_current - total_invested
        total_pnl_pct = (total_pnl / total_invested * 100) if total_invested else 0
        c1, c2, c3 = st.columns(3)
        c1.metric("Total invested", f"{total_invested:,.2f}")
        c2.metric("Current value", f"{total_current:,.2f}")
        c3.metric("Total P/L", f"{total_pnl:,.2f}", f"{total_pnl_pct:+.2f}%")

        remove_symbol = st.selectbox("Remove a holding", ["—"] + [h["symbol"] for h in holdings])
        if remove_symbol != "—" and st.button("Remove"):
            holdings = [h for h in holdings if h["symbol"] != remove_symbol]
            save_portfolio(user, holdings)
            st.rerun()

# Calculators
with tab_calc:
    st.markdown("### Profit / Loss Calculator")
    c1, c2, c3 = st.columns(3)
    buy_price = c1.number_input("Buy price", min_value=0.0, value=100.0, key="pl_buy")
    sell_price = c2.number_input("Sell price", min_value=0.0, value=120.0, key="pl_sell")
    qty = c3.number_input("Quantity", min_value=1, value=10, key="pl_qty")
    pnl = (sell_price - buy_price) * qty
    pnl_pct = ((sell_price - buy_price) / buy_price * 100) if buy_price else 0
    st.metric("Profit / Loss", f"{pnl:,.2f}", f"{pnl_pct:+.2f}%")

    st.markdown("---")
    st.markdown("### Investment (Lumpsum) Calculator")
    c1, c2, c3 = st.columns(3)
    principal = c1.number_input("Investment amount", min_value=0.0, value=100000.0)
    rate = c2.number_input("Expected annual return (%)", min_value=0.0, value=12.0)
    years = c3.number_input("Duration (years)", min_value=1, value=10)
    future_value = principal * ((1 + rate / 100) ** years)
    st.metric("Future value", f"{future_value:,.2f}", f"+{future_value - principal:,.2f} gain")

    st.markdown("---")
    st.markdown("### SIP Calculator")
    c1, c2, c3 = st.columns(3)
    monthly = c1.number_input("Monthly SIP amount", min_value=0.0, value=5000.0)
    sip_rate = c2.number_input("Expected annual return (%)", min_value=0.0, value=12.0, key="sip_rate")
    sip_years = c3.number_input("Duration (years)", min_value=1, value=10, key="sip_years")
    n = sip_years * 12
    monthly_rate = sip_rate / 100 / 12
    sip_future_value = monthly * (((1 + monthly_rate) ** n - 1) / monthly_rate) * (1 + monthly_rate) if monthly_rate else monthly * n
    invested_total = monthly * n
    st.metric("Maturity value", f"{sip_future_value:,.2f}")
    st.caption(f"Total invested: {invested_total:,.2f} · Estimated gains: {sip_future_value - invested_total:,.2f}")

# Watchlist
with tab_watchlist:
    st.markdown("### Watchlist / Favourite Stocks")
    watchlist = get_watchlist(user)
    c1, c2 = st.columns([3, 1])
    new_symbol = c1.text_input("Add symbol to watchlist", value=symbol_input)
    if c2.button("Add"):
        entry = {"market": market, "symbol": new_symbol.upper(), "yf_symbol": detect_market(new_symbol, market)}
        if entry not in watchlist:
            watchlist.append(entry)
            save_watchlist(user, watchlist)
            st.rerun()

    if not watchlist:
        st.info("Your watchlist is empty.")
    else:
        rows = []
        for w in watchlist:
            snap = get_quote_snapshot(w["yf_symbol"])
            rows.append({
                "Symbol": w["symbol"], "Market": w["market"],
                "Price": snap.get("price", "N/A"),
                "Change %": round(snap.get("pct", 0), 2) if snap else "N/A"
            })
        st.dataframe(pd.DataFrame(rows), use_container_width=True)
        remove_w = st.selectbox("Remove from watchlist", ["—"] + [w["symbol"] for w in watchlist])
        if remove_w != "—" and st.button("Remove from watchlist"):
            watchlist = [w for w in watchlist if w["symbol"] != remove_w]
            save_watchlist(user, watchlist)
            st.rerun()

# Insights
with tab_insights:
    holdings = get_portfolio(user)
    if not holdings:
        st.info("Add holdings on the **Holdings & P/L** tab first — insights are computed from your portfolio.")
    else:
        with loading("Crunching portfolio insights..."):
            enriched = []
            history_by_symbol = {}
            for h in holdings:
                snap = get_quote_snapshot(h["yf_symbol"])
                current_price = snap.get("price", h["buy_price"])
                enriched.append({**h, "current_value": h["quantity"] * current_price})
                hist = get_history(h["yf_symbol"], period="6mo")
                if not hist.empty:
                    history_by_symbol[h["yf_symbol"]] = hist

            info_lookup = {h["yf_symbol"]: get_info(h["yf_symbol"]) for h in holdings}

        st.markdown("### Sector Allocation")
        sec_df = sector_allocation(enriched, info_lookup)
        if not sec_df.empty:
            c1, c2 = st.columns([1, 1])
            with c1:
                fig = go.Figure(go.Pie(labels=sec_df["sector"], values=sec_df["value"], hole=0.45))
                fig.update_layout(height=320, margin=dict(t=10, b=10))
                st.plotly_chart(fig, use_container_width=True)
            with c2:
                st.dataframe(sec_df, use_container_width=True)

        st.markdown("### Portfolio Health Score")
        vols = []
        for sym, hist in history_by_symbol.items():
            v = calc_volatility(hist["Close"]).dropna()
            if not v.empty:
                vols.append(v.iloc[-1])
        avg_vol = sum(vols) / len(vols) if vols else 25.0
        health = portfolio_health_score(sec_df, len(holdings), avg_vol)
        health_kind = "green" if health["label"] == "Healthy" else "amber" if "attention" in health["label"] else "red"
        st.markdown(f"**Score: {health['score']}/100** — {badge(health['label'], health_kind)}", unsafe_allow_html=True)
        st.progress(health["score"] / 100)
        for note in health["notes"]:
            st.write("• " + note)

        st.markdown("### Rebalancing Suggestions")
        for s in rebalancing_suggestion(sec_df):
            st.write("• " + s)
        st.caption("Rule-based guideline (flags any sector over ~35% of the portfolio) — not personalized financial advice.")

        st.markdown("### Your Holdings — Quick Technical Ranking")
        st.caption("A fast rule-based score (RSI + trend + momentum) — not the full LSTM model used on the AI Features page, so it's quick enough to run across your whole portfolio at once.")
        if history_by_symbol:
            ranked = rank_universe(history_by_symbol)
            ranked["symbol"] = ranked["symbol"].apply(strip_suffix)
            st.dataframe(ranked, use_container_width=True)

        st.markdown("### Benchmark Comparison (last 6 months)")
        if history_by_symbol:
            total_value = sum(e["current_value"] for e in enriched)
            portfolio_series = None
            for h in enriched:
                hist = history_by_symbol.get(h["yf_symbol"])
                if hist is None or hist.empty:
                    continue
                weight = h["current_value"] / total_value if total_value else 0
                normalised = hist["Close"] / hist["Close"].iloc[0] * 100 * weight
                portfolio_series = normalised if portfolio_series is None else portfolio_series.add(normalised, fill_value=0)

            benchmark_hist = get_history("^NSEI", period="6mo")
            fig = go.Figure()
            if portfolio_series is not None:
                fig.add_trace(go.Scatter(x=portfolio_series.index, y=portfolio_series, name="Your portfolio (weighted)", line=dict(color="#2563eb")))
            if not benchmark_hist.empty:
                bench_norm = benchmark_hist["Close"] / benchmark_hist["Close"].iloc[0] * 100
                fig.add_trace(go.Scatter(x=bench_norm.index, y=bench_norm, name="NIFTY 50", line=dict(color="#f59e0b")))
            fig.update_layout(height=380, yaxis_title="Normalised (start = 100)", margin=dict(t=20))
            st.plotly_chart(fig, use_container_width=True)
            st.caption("Approximation only — this compares current holdings' price history over the window shown, "
                       "not your actual return since each position's real purchase date (which isn't tracked).")

