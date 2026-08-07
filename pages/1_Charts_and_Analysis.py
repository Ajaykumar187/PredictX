import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import streamlit as st

from utils.styling import inject_css, navbar, loading, badge
from utils.sidebar import stock_selector_sidebar
from utils.pipeline import run_analysis
from utils.data_fetch import get_history
from utils.indicators import trend_line, fibonacci_levels, add_all_indicators, add_advanced_indicators
from utils.patterns import detect_candlestick_patterns, summarize_recent_patterns, detect_chart_patterns

st.set_page_config(page_title="Charts & Analysis", layout="wide", initial_sidebar_state="expanded")

market, symbol_input, yf_symbol, load_clicked = stock_selector_sidebar()

inject_css()
navbar("Charts & Analysis", "Candlesticks, 20+ indicators, patterns, and multi-timeframe views")

with loading(f"Loading {yf_symbol}..."):
    result = run_analysis(yf_symbol, market, force=load_clicked)

if result is None:
    st.info("Load a stock from the sidebar to see charts.")
    st.stop()

symbol = result["symbol"]

# Multi-timeframe 
timeframe = st.radio("Timeframe", ["Daily", "Weekly", "Monthly"], horizontal=True)
interval_map = {"Daily": "1d", "Weekly": "1wk", "Monthly": "1mo"}
if timeframe == "Daily":
    df_raw = result["df"]
else:
    with loading(f"Loading {timeframe.lower()} data..."):
        df_raw = get_history(result["yf_symbol"], period="5y", interval=interval_map[timeframe])
    if df_raw.empty:
        st.warning(f"No {timeframe.lower()} data available — showing daily instead.")
        df_raw = result["df"]

df = add_advanced_indicators(add_all_indicators(df_raw))

chart_type = st.radio("Price chart type", ["Candlestick", "Line"], horizontal=True)

overlay_options = st.multiselect(
    "Overlays",
    ["SMA20", "SMA50", "SMA100", "SMA200", "EMA20", "EMA50", "Bollinger Bands", "Trend Line",
     "Ichimoku Cloud", "Supertrend", "Donchian Channel", "Keltner Channel", "Parabolic SAR",
     "Fibonacci Retracement", "Pivot Points"],
    default=["SMA20", "SMA50"]
)

oscillator_choice = st.selectbox(
    "Extra oscillator panel", ["None", "ADX", "ATR", "Stochastic RSI", "CCI", "OBV", "MFI"]
)

fig = make_subplots(
    rows=3, cols=1, shared_xaxes=True, row_heights=[0.55, 0.2, 0.25], vertical_spacing=0.03,
    subplot_titles=(f"{symbol} Price ({timeframe})", "Volume", "RSI (14)")
)

if chart_type == "Candlestick":
    fig.add_trace(go.Candlestick(
        x=df.index, open=df["Open"], high=df["High"], low=df["Low"], close=df["Close"],
        name="Price", increasing_line_color="#16A34A", decreasing_line_color="#DC2626"
    ), row=1, col=1)
else:
    fig.add_trace(go.Scatter(x=df.index, y=df["Close"], mode="lines", name="Close", line=dict(color="#0a2540")), row=1, col=1)

overlay_colors = {
    "SMA20": "#2563eb", "SMA50": "#f59e0b", "SMA100": "#7c3aed", "SMA200": "#dc2626",
    "EMA20": "#0ea5e9", "EMA50": "#f97316"
}
for name in ["SMA20", "SMA50", "SMA100", "SMA200", "EMA20", "EMA50"]:
    if name in overlay_options:
        fig.add_trace(go.Scatter(x=df.index, y=df[name], mode="lines", name=name,
                                  line=dict(width=1.4, color=overlay_colors[name])), row=1, col=1)

if "Bollinger Bands" in overlay_options:
    fig.add_trace(go.Scatter(x=df.index, y=df["BB_Upper"], mode="lines", name="BB Upper",
                              line=dict(width=1, color="rgba(120,120,120,.6)")), row=1, col=1)
    fig.add_trace(go.Scatter(x=df.index, y=df["BB_Lower"], mode="lines", name="BB Lower",
                              line=dict(width=1, color="rgba(120,120,120,.6)"), fill="tonexty",
                              fillcolor="rgba(120,120,120,.08)"), row=1, col=1)

if "Trend Line" in overlay_options:
    tl, slope = trend_line(df["Close"])
    direction = "upward" if slope > 0 else "downward"
    fig.add_trace(go.Scatter(x=df.index, y=tl, mode="lines", name=f"Trend ({direction})",
                              line=dict(width=2, dash="dash", color="#111827")), row=1, col=1)

if "Ichimoku Cloud" in overlay_options:
    fig.add_trace(go.Scatter(x=df.index, y=df["Ichimoku_SpanA"], mode="lines", name="Senkou Span A",
                              line=dict(width=1, color="rgba(22,163,74,.5)")), row=1, col=1)
    fig.add_trace(go.Scatter(x=df.index, y=df["Ichimoku_SpanB"], mode="lines", name="Senkou Span B",
                              line=dict(width=1, color="rgba(220,38,38,.5)"), fill="tonexty",
                              fillcolor="rgba(120,120,120,.12)"), row=1, col=1)
    fig.add_trace(go.Scatter(x=df.index, y=df["Ichimoku_Tenkan"], mode="lines", name="Tenkan-sen",
                              line=dict(width=1.2, color="#f59e0b")), row=1, col=1)
    fig.add_trace(go.Scatter(x=df.index, y=df["Ichimoku_Kijun"], mode="lines", name="Kijun-sen",
                              line=dict(width=1.2, color="#2563eb")), row=1, col=1)

if "Supertrend" in overlay_options:
    up_mask = df["Supertrend_Dir"] == 1
    fig.add_trace(go.Scatter(x=df.index[up_mask], y=df["Supertrend"][up_mask], mode="markers",
                              name="Supertrend (up)", marker=dict(size=3, color="#16A34A")), row=1, col=1)
    fig.add_trace(go.Scatter(x=df.index[~up_mask], y=df["Supertrend"][~up_mask], mode="markers",
                              name="Supertrend (down)", marker=dict(size=3, color="#DC2626")), row=1, col=1)

if "Donchian Channel" in overlay_options:
    fig.add_trace(go.Scatter(x=df.index, y=df["Donchian_Upper"], mode="lines", name="Donchian Upper",
                              line=dict(width=1, color="rgba(37,99,235,.5)")), row=1, col=1)
    fig.add_trace(go.Scatter(x=df.index, y=df["Donchian_Lower"], mode="lines", name="Donchian Lower",
                              line=dict(width=1, color="rgba(37,99,235,.5)")), row=1, col=1)

if "Keltner Channel" in overlay_options:
    fig.add_trace(go.Scatter(x=df.index, y=df["Keltner_Upper"], mode="lines", name="Keltner Upper",
                              line=dict(width=1, dash="dot", color="rgba(124,58,237,.6)")), row=1, col=1)
    fig.add_trace(go.Scatter(x=df.index, y=df["Keltner_Lower"], mode="lines", name="Keltner Lower",
                              line=dict(width=1, dash="dot", color="rgba(124,58,237,.6)")), row=1, col=1)

if "Parabolic SAR" in overlay_options:
    fig.add_trace(go.Scatter(x=df.index, y=df["PSAR"], mode="markers", name="Parabolic SAR",
                              marker=dict(size=3, color="#111827")), row=1, col=1)

if "Fibonacci Retracement" in overlay_options:
    recent = df.tail(120)
    levels = fibonacci_levels(float(recent["High"].max()), float(recent["Low"].min()))
    for label, level in levels.items():
        fig.add_hline(y=level, line_dash="dot", line_color="rgba(180,120,0,.5)",
                       annotation_text=label, annotation_position="right", row=1, col=1)

if "Pivot Points" in overlay_options:
    last = df.iloc[-1]
    for label, val, color in [("Pivot", last["Pivot"], "#111827"), ("R1", last["R1"], "#DC2626"),
                               ("R2", last["R2"], "#DC2626"), ("S1", last["S1"], "#16A34A"),
                               ("S2", last["S2"], "#16A34A")]:
        fig.add_hline(y=val, line_dash="dash", line_color=color, annotation_text=label,
                       annotation_position="left", row=1, col=1)

vol_colors = ["#16A34A" if c >= o else "#DC2626" for o, c in zip(df["Open"], df["Close"])]
fig.add_trace(go.Bar(x=df.index, y=df["Volume"], name="Volume", marker_color=vol_colors), row=2, col=1)

fig.add_trace(go.Scatter(x=df.index, y=df["RSI14"], mode="lines", name="RSI14", line=dict(color="#7c3aed")), row=3, col=1)
fig.add_hline(y=70, line_dash="dot", line_color="red", row=3, col=1)
fig.add_hline(y=30, line_dash="dot", line_color="green", row=3, col=1)

fig.update_layout(height=850, xaxis_rangeslider_visible=False, legend=dict(orientation="h", y=1.02),
                   margin=dict(t=60, b=20))
st.plotly_chart(fig, use_container_width=True)

st.markdown("### MACD")
macd_fig = go.Figure()
macd_fig.add_trace(go.Scatter(x=df.index, y=df["MACD"], name="MACD", line=dict(color="#2563eb")))
macd_fig.add_trace(go.Scatter(x=df.index, y=df["MACD_Signal"], name="Signal", line=dict(color="#f59e0b")))
hist_colors = ["#16A34A" if v >= 0 else "#DC2626" for v in df["MACD_Hist"].fillna(0)]
macd_fig.add_trace(go.Bar(x=df.index, y=df["MACD_Hist"], name="Histogram", marker_color=hist_colors))
macd_fig.update_layout(height=300, margin=dict(t=10, b=10))
st.plotly_chart(macd_fig, use_container_width=True)

if oscillator_choice != "None":
    st.markdown(f"### {oscillator_choice}")
    osc_fig = go.Figure()
    if oscillator_choice == "ADX":
        osc_fig.add_trace(go.Scatter(x=df.index, y=df["ADX14"], name="ADX14", line=dict(color="#111827")))
        osc_fig.add_trace(go.Scatter(x=df.index, y=df["Plus_DI"], name="+DI", line=dict(color="#16A34A")))
        osc_fig.add_trace(go.Scatter(x=df.index, y=df["Minus_DI"], name="-DI", line=dict(color="#DC2626")))
    elif oscillator_choice == "ATR":
        osc_fig.add_trace(go.Scatter(x=df.index, y=df["ATR14"], name="ATR14", line=dict(color="#f59e0b")))
    elif oscillator_choice == "Stochastic RSI":
        osc_fig.add_trace(go.Scatter(x=df.index, y=df["StochRSI_K"], name="%K", line=dict(color="#2563eb")))
        osc_fig.add_trace(go.Scatter(x=df.index, y=df["StochRSI_D"], name="%D", line=dict(color="#f59e0b")))
        osc_fig.add_hline(y=80, line_dash="dot", line_color="red")
        osc_fig.add_hline(y=20, line_dash="dot", line_color="green")
    elif oscillator_choice == "CCI":
        osc_fig.add_trace(go.Scatter(x=df.index, y=df["CCI20"], name="CCI20", line=dict(color="#7c3aed")))
        osc_fig.add_hline(y=100, line_dash="dot", line_color="red")
        osc_fig.add_hline(y=-100, line_dash="dot", line_color="green")
    elif oscillator_choice == "OBV":
        osc_fig.add_trace(go.Scatter(x=df.index, y=df["OBV"], name="OBV", line=dict(color="#0ea5e9")))
    elif oscillator_choice == "MFI":
        osc_fig.add_trace(go.Scatter(x=df.index, y=df["MFI14"], name="MFI14", line=dict(color="#f97316")))
        osc_fig.add_hline(y=80, line_dash="dot", line_color="red")
        osc_fig.add_hline(y=20, line_dash="dot", line_color="green")
    osc_fig.update_layout(height=280, margin=dict(t=10, b=10))
    st.plotly_chart(osc_fig, use_container_width=True)

# Pattern recognition
st.markdown("### Candlestick Patterns (last 10 bars)")
pattern_df = detect_candlestick_patterns(df)
recent_patterns = summarize_recent_patterns(pattern_df, lookback=10)
if recent_patterns:
    for date, pattern in recent_patterns:
        st.write(f"- **{pattern}** on {date.strftime('%d %b %Y')}")
else:
    st.caption("No standard candlestick patterns detected in the last 10 bars.")
st.caption("Rule-based on OHLC geometry — candlestick patterns describe what happened, they don't guarantee what happens next.")

st.markdown("### Chart Pattern Scan (heuristic)")
chart_patterns = detect_chart_patterns(df)
if chart_patterns:
    for f in chart_patterns[-5:]:
        st.write(f"- **{f['pattern']}** ({f['start'].strftime('%d %b')} → {f['end'].strftime('%d %b %Y')}): {f['note']}")
else:
    st.caption("No double top/bottom or head & shoulders shape detected in the loaded history.")
st.caption("This is a rough geometric heuristic (peak/trough matching), not a validated pattern-recognition model — chart pattern reading is famously subjective, so treat this as a starting point, not a signal.")

with st.expander("How to read these indicators"):
    st.markdown("""
- **Moving averages (SMA/EMA)**: smoothed price trend — price above a rising MA is generally bullish.
- **RSI**: momentum oscillator 0–100. Above 70 = overbought, below 30 = oversold.
- **MACD**: trend-following momentum indicator; MACD crossing above its signal line is often read as bullish.
- **Bollinger Bands**: volatility bands around a moving average; touching the outer bands can signal overextension.
- **Trend line**: a simple linear regression fit over the loaded history, showing overall direction.
- **Ichimoku Cloud**: the shaded area (Senkou spans) is a forward-looking support/resistance zone; price above the cloud is broadly bullish.
- **Supertrend**: a trailing stop-style line; green dots below price = uptrend, red dots above price = downtrend.
- **ADX**: trend *strength* (not direction) — above 25 suggests a strong trend, below 20 suggests a weak/range-bound market.
- **ATR**: average true range — a volatility measure in price units, often used to size stops.
- **Stochastic RSI**: a more sensitive momentum oscillator than plain RSI; above 80 = overbought, below 20 = oversold.
- **CCI**: commodity channel index — beyond ±100 suggests an extended move.
- **OBV**: on-balance volume — rising OBV alongside rising price supports the trend; divergence can flag weakness.
- **MFI**: volume-weighted RSI — same overbought/oversold reading as RSI, but factoring in volume.
- **Donchian / Keltner Channels**: breakout bands — a Donchian breakout is a classic trend-following entry trigger.
- **Parabolic SAR**: dots flip sides on a trend reversal; often used for trailing stops.
- **Fibonacci Retracement**: horizontal levels between the recent swing high/low, watched as potential support/resistance during a pullback.
- **Pivot Points**: classic floor-trader support/resistance levels computed from the prior period's high/low/close.
""")
