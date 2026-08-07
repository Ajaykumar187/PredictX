from datetime import date, datetime

import streamlit as st

from utils.styling import inject_css, navbar
from utils.sidebar import stock_selector_sidebar
from utils.calculators import (emi, cagr, xirr, brokerage_calculator, equity_capital_gains_tax,
                                retirement_planner, goal_planner)

st.set_page_config(page_title="Investment Tools", layout="wide", initial_sidebar_state="expanded")

market, symbol_input, yf_symbol, load_clicked = stock_selector_sidebar()

inject_css()
navbar("Investment Tools", "EMI, CAGR, XIRR, brokerage, tax, retirement & goal planning")
st.caption("Pure calculators — no market data needed. Tax/brokerage figures are simplified estimates; "
           "confirm current rates with your broker or a tax professional before relying on these for filing.")

tabs = st.tabs(["EMI", "CAGR", "XIRR", "Brokerage", "Capital Gains Tax", "Retirement Planner", "Goal Planner"])

with tabs[0]:
    st.markdown("### EMI Calculator")
    c1, c2, c3 = st.columns(3)
    principal = c1.number_input("Loan amount", min_value=0.0, value=1000000.0)
    rate = c2.number_input("Annual interest rate (%)", min_value=0.0, value=8.5)
    tenure_years = c3.number_input("Tenure (years)", min_value=1, value=20)
    result = emi(principal, rate, int(tenure_years * 12))
    m1, m2, m3 = st.columns(3)
    m1.metric("Monthly EMI", f"{result['emi']:,.2f}")
    m2.metric("Total payment", f"{result['total_payment']:,.2f}")
    m3.metric("Total interest", f"{result['total_interest']:,.2f}")

with tabs[1]:
    st.markdown("### CAGR Calculator")
    c1, c2, c3 = st.columns(3)
    begin_v = c1.number_input("Starting value", min_value=0.0, value=100000.0)
    end_v = c2.number_input("Ending value", min_value=0.0, value=200000.0)
    years = c3.number_input("Number of years", min_value=0.1, value=5.0)
    st.metric("CAGR", f"{cagr(begin_v, end_v, years)}%")

with tabs[2]:
    st.markdown("### XIRR Calculator")
    st.caption("Add each cash flow — negative for money invested, positive for money received back (including current value).")
    n_flows = st.number_input("Number of cash flows", min_value=2, max_value=10, value=3)
    cashflows = []
    for i in range(int(n_flows)):
        c1, c2 = st.columns(2)
        d = c1.date_input(f"Date {i+1}", value=date(2023, 1, 1), key=f"xirr_date_{i}")
        amt = c2.number_input(f"Amount {i+1} (negative = invested)", value=-10000.0 if i < n_flows - 1 else 15000.0, key=f"xirr_amt_{i}")
        cashflows.append((datetime.combine(d, datetime.min.time()), amt))
    if st.button("Calculate XIRR"):
        rate = xirr(cashflows)
        st.metric("XIRR", f"{rate}%")

with tabs[3]:
    st.markdown("### Brokerage Calculator")
    c1, c2, c3 = st.columns(3)
    buy_price = c1.number_input("Buy price", min_value=0.0, value=100.0, key="bk_buy")
    sell_price = c2.number_input("Sell price", min_value=0.0, value=110.0, key="bk_sell")
    qty = c3.number_input("Quantity", min_value=1, value=100, key="bk_qty")
    is_intraday = st.checkbox("Intraday trade")
    r = brokerage_calculator(buy_price, sell_price, qty, is_intraday=is_intraday)
    st.dataframe(
        {"Item": ["Turnover", "Brokerage", "STT", "Exchange charges", "SEBI charges", "Stamp duty", "GST",
                  "Total charges", "Gross P&L", "Net P&L"],
         "Amount": [r["turnover"], r["brokerage"], r["stt"], r["exchange_charges"], r["sebi_charges"],
                    r["stamp_duty"], r["gst"], r["total_charges"], r["gross_pnl"], r["net_pnl"]]},
        use_container_width=True
    )

with tabs[4]:
    st.markdown("### Capital Gains Tax Estimator (Listed Equity)")
    c1, c2, c3, c4 = st.columns(4)
    buy_p = c1.number_input("Buy price", min_value=0.0, value=100.0, key="tax_buy")
    sell_p = c2.number_input("Sell price", min_value=0.0, value=150.0, key="tax_sell")
    tax_qty = c3.number_input("Quantity", min_value=1, value=100, key="tax_qty")
    holding_days = c4.number_input("Holding period (days)", min_value=0, value=400)
    r = equity_capital_gains_tax(buy_p, sell_p, tax_qty, holding_days)
    m1, m2, m3 = st.columns(3)
    m1.metric("Gain", f"{r['gain']:,.2f}")
    m2.metric("Term", r["term"])
    m3.metric("Estimated tax", f"{r['tax']:,.2f}", r["rate_used"] or "No tax (loss)")

with tabs[5]:
    st.markdown("### Retirement Planner")
    c1, c2, c3 = st.columns(3)
    cur_age = c1.number_input("Current age", min_value=18, value=30)
    ret_age = c2.number_input("Retirement age", min_value=cur_age + 1, value=60)
    life_exp = c3.number_input("Life expectancy", min_value=ret_age + 1, value=85)
    c4, c5, c6 = st.columns(3)
    monthly_exp = c4.number_input("Current monthly expenses", min_value=0.0, value=50000.0)
    inflation = c5.number_input("Expected inflation (%)", min_value=0.0, value=6.0)
    pre_return = c6.number_input("Expected return before retirement (%)", min_value=0.0, value=12.0)
    post_return = st.number_input("Expected return after retirement (%)", min_value=0.0, value=7.0)
    r = retirement_planner(cur_age, ret_age, monthly_exp, inflation, pre_return, life_exp, post_return)
    m1, m2, m3 = st.columns(3)
    m1.metric("Monthly expenses at retirement", f"{r['monthly_expenses_at_retirement']:,.0f}")
    m2.metric("Corpus needed", f"{r['corpus_needed']:,.0f}")
    m3.metric("Required monthly SIP", f"{r['required_monthly_sip']:,.0f}")

with tabs[6]:
    st.markdown("### Goal Planner")
    c1, c2, c3 = st.columns(3)
    goal_amt = c1.number_input("Goal amount", min_value=0.0, value=1000000.0)
    goal_years = c2.number_input("Years to reach goal", min_value=0.5, value=10.0)
    goal_return = c3.number_input("Expected annual return (%)", min_value=0.0, value=12.0, key="goal_return")
    r = goal_planner(goal_amt, goal_years, goal_return)
    m1, m2, m3 = st.columns(3)
    m1.metric("Required monthly SIP", f"{r['required_monthly_sip']:,.0f}")
    m2.metric("Total invested", f"{r['total_invested']:,.0f}")
    m3.metric("Estimated wealth gain", f"{r['wealth_gain']:,.0f}")
