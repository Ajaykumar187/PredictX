import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from utils.styling import inject_css, navbar, loading, badge
from utils.sidebar import stock_selector_sidebar
from utils.pipeline import run_analysis
from utils.storage import append_prediction_history
from utils.auth import current_user

st.set_page_config(page_title="AI Features", layout="wide", initial_sidebar_state="expanded")

market, symbol_input, yf_symbol, load_clicked = stock_selector_sidebar()

inject_css()
navbar("AI Features", "Signal, multi-day forecasts, confidence, risk, and a plain-English summary")

with loading(f"Running AI analysis for {yf_symbol}..."):
    result = run_analysis(yf_symbol, market, force=load_clicked)

if result is None:
    st.info("Load a stock from the sidebar to see AI features.")
    st.stop()

currency_fmt = result["currency_fmt"]
signal = result["signal"]
score = result["score"]

badge_kind = {"BUY": "green", "SELL": "red", "HOLD": "amber"}[signal]
st.markdown(f"### Signal: {badge(signal, badge_kind)} &nbsp; (score {score:+d} / 100)", unsafe_allow_html=True)
st.progress((score + 100) / 200)

with st.expander("Why this signal?", expanded=True):
    for reason in result["reasons"]:
        st.write("• " + reason)
st.caption("Rule-based, fully explainable — not a licensed financial advisor and not investment advice.")

st.markdown("---")
col1, col2, col3 = st.columns(3)
col1.metric("Next-day forecast", currency_fmt(result["forecast_next_day"][0]))
col2.metric("7-day forecast", currency_fmt(result["forecast_7d"][-1]))
col3.metric("Model confidence", f"{result['confidence']}%")

st.markdown("### 30-Day Price Forecast")
forecast_df = pd.DataFrame({
    "Day": list(range(1, 31)),
    "Forecast": result["forecast_30"]
})
fig = go.Figure()
fig.add_trace(go.Scatter(x=forecast_df["Day"], y=forecast_df["Forecast"], mode="lines+markers",
                          name="Forecast", line=dict(color="#2563eb")))
fig.update_layout(height=380, xaxis_title="Days ahead", yaxis_title="Forecast price",
                   margin=dict(t=20, b=20))
st.plotly_chart(fig, use_container_width=True)
st.dataframe(forecast_df.style.format({"Forecast": lambda v: currency_fmt(v)}), use_container_width=True)

st.markdown("### Risk Analysis")
risk = result["risk"]
r1, r2, r3 = st.columns(3)
r1.metric("Risk level", risk["risk_label"])
r2.metric("Annualised volatility", f"{risk['annual_volatility_pct']}%")
r3.metric("Max drawdown", f"{risk['max_drawdown_pct']}%")
if risk["beta"] is not None:
    st.caption(f"Beta vs benchmark: {risk['beta']}")

st.markdown("### AI Market Summary")
st.info(result["summary"])

if current_user():
    if st.button("Save this prediction to my history"):
        append_prediction_history(current_user(), {
            "symbol": result["symbol"], "market": market,
            "latest_price": result["latest_price"], "signal": signal, "score": score,
            "forecast_7d": list(result["forecast_7d"]), "confidence": result["confidence"],
            "timestamp": pd.Timestamp.now().isoformat()
        })
        st.success("Saved to your prediction history (see the Account page).")
else:
    st.caption("Log in on the Account page to save this prediction to your history.")
