import plotly.graph_objects as go
import streamlit as st

from utils.styling import inject_css, navbar, loading
from utils.sidebar import stock_selector_sidebar
from utils.pipeline import run_analysis
from utils.backtester import backtest_sma_crossover, backtest_rsi_strategy
from utils.auth import require_login_ui, current_user
from utils.paper_trading import paper_buy, paper_sell, get_paper_account, reset_paper_account
from utils.data_fetch import get_quote_snapshot

st.set_page_config(page_title="Strategy Lab", layout="wide", initial_sidebar_state="expanded")

market, symbol_input, yf_symbol, load_clicked = stock_selector_sidebar()

inject_css()
navbar("Strategy Lab", "Backtest simple rule-based strategies, and a no-real-money paper trading account")

tab_backtest, tab_paper = st.tabs(["Backtester", "Paper Trading"])

with tab_backtest:
    st.caption("Long-only, single-position, no commissions/slippage modelled. This shows how a rule *would have* "
               "played out on historical data — it is not a guarantee of future performance.")
    with loading(f"Loading {yf_symbol}..."):
        result = run_analysis(yf_symbol, market, force=load_clicked)

    if result is None:
        st.info("Load a stock from the sidebar to backtest a strategy on it.")
    else:
        strategy = st.selectbox("Strategy", ["SMA Crossover", "RSI Mean-Reversion"])
        initial_capital = st.number_input("Initial capital", min_value=1000.0, value=100000.0)

        if strategy == "SMA Crossover":
            c1, c2 = st.columns(2)
            fast = c1.number_input("Fast SMA", min_value=2, value=20)
            slow = c2.number_input("Slow SMA", min_value=3, value=50)
            equity, trades, summary = backtest_sma_crossover(result["df"], fast, slow, initial_capital)
        else:
            c1, c2, c3 = st.columns(3)
            window = c1.number_input("RSI window", min_value=2, value=14)
            oversold = c2.number_input("Buy below RSI", min_value=1, value=30)
            overbought = c3.number_input("Sell above RSI", min_value=1, value=70)
            equity, trades, summary = backtest_rsi_strategy(result["df"], window, oversold, overbought, initial_capital)

        m1, m2, m3, m4 = st.columns(4)
        m1.metric("Total return", f"{summary['total_return_pct']:+.2f}%")
        m2.metric("Max drawdown", f"{summary['max_drawdown_pct']:.2f}%")
        m3.metric("Trades", summary["num_trades"])
        m4.metric("Win rate", f"{summary['win_rate_pct']:.0f}%")

        bh_return = (result["df"]["Close"].iloc[-1] / result["df"]["Close"].iloc[0] - 1) * 100
        st.caption(f"Buy & hold over the same period would have returned {bh_return:+.2f}%.")

        fig = go.Figure()
        fig.add_trace(go.Scatter(x=equity.index, y=equity, name="Strategy equity", line=dict(color="#2563eb")))
        buy_hold_equity = result["df"]["Close"] / result["df"]["Close"].iloc[0] * initial_capital
        fig.add_trace(go.Scatter(x=buy_hold_equity.index, y=buy_hold_equity, name="Buy & hold", line=dict(color="#94a3b8", dash="dot")))
        fig.update_layout(height=400, margin=dict(t=20), yaxis_title="Portfolio value")
        st.plotly_chart(fig, use_container_width=True)

        if trades:
            st.markdown("### Trade log")
            st.dataframe(trades, use_container_width=True)

with tab_paper:
    if not require_login_ui():
        st.stop()
    user = current_user()
    account = get_paper_account(user)

    st.markdown("### Your paper trading account")
    st.caption("No real money, no other players — a personal simulator to practice entries/exits.")

    snap = get_quote_snapshot(yf_symbol)
    live_price = snap.get("price") if snap else None

    holdings_value = sum(p["qty"] * (live_price if p["symbol"] == symbol_input.upper() and live_price else p["buy_price"])
                          for p in account["positions"])
    m1, m2, m3 = st.columns(3)
    m1.metric("Cash", f"{account['cash']:,.2f}")
    m2.metric("Positions value (approx.)", f"{holdings_value:,.2f}")
    m3.metric("Total (approx.)", f"{account['cash'] + holdings_value:,.2f}")

    if live_price:
        st.write(f"Current price for **{symbol_input.upper()}**: {live_price:,.2f}")
    c1, c2, c3 = st.columns(3)
    qty = c1.number_input("Quantity", min_value=1, value=10, key="paper_qty")
    trade_price = c2.number_input("Price", min_value=0.0, value=float(live_price) if live_price else 100.0, key="paper_price")
    if c3.button("Buy"):
        ok, msg = paper_buy(user, symbol_input.upper(), qty, trade_price)
        (st.success if ok else st.error)(msg)
    if c3.button("Sell"):
        ok, msg = paper_sell(user, symbol_input.upper(), qty, trade_price)
        (st.success if ok else st.error)(msg)

    if account["positions"]:
        st.markdown("### Open positions")
        st.dataframe(account["positions"], use_container_width=True)
    if account["history"]:
        st.markdown("### Trade history")
        st.dataframe(account["history"][::-1], use_container_width=True)

    if st.button("Reset paper account to Rs. 10,00,000"):
        reset_paper_account(user)
        st.rerun()
