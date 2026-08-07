import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from utils.styling import inject_css, navbar, loading
from utils.sidebar import stock_selector_sidebar
from utils.pipeline import run_analysis, get_chatbot_context
from utils.data_fetch import get_history, get_batch_snapshot
from utils.market import detect_market, strip_suffix
from utils.screener_universe import universe_for_market, sector_groups_for_market
from utils.export_report import build_pdf_report, build_excel_report
from utils.chatbot import answer as chatbot_answer
from utils.voice import text_to_speech_bytes, speech_to_text_from_file

st.set_page_config(page_title="Advanced", layout="wide", initial_sidebar_state="expanded")

market, symbol_input, yf_symbol, load_clicked = stock_selector_sidebar()

inject_css()
navbar("Advanced Features", "Compare stocks, sector performance, screener, exports, and an assistant")

tabs = st.tabs(["Compare Stocks", "Sector Performance", "Gainers/Losers/Active",
                "Screener", "Export Report", "Assistant"])

# Compare Stocks
with tabs[0]:
    st.markdown("### Compare two or more stocks (normalised to 100 at start)")
    default_syms = "RELIANCE, TCS, INFY" if market != "US" else "AAPL, MSFT, GOOGL"
    symbols_raw = st.text_input("Symbols (comma-separated)", value=default_syms)
    symbols = [s.strip() for s in symbols_raw.split(",") if s.strip()]

    if st.button("Compare"):
        fig = go.Figure()
        for s in symbols:
            yfs = detect_market(s, market)
            df = get_history(yfs, start="2023-01-01")
            if df.empty:
                st.warning(f"No data for {s}")
                continue
            normalised = df["Close"] / df["Close"].iloc[0] * 100
            fig.add_trace(go.Scatter(x=df.index, y=normalised, mode="lines", name=strip_suffix(yfs)))
        fig.update_layout(height=500, yaxis_title="Normalised price (start = 100)", margin=dict(t=20))
        st.plotly_chart(fig, use_container_width=True)

# Sector Performance
with tabs[1]:
    st.markdown("### Sector performance (curated groups)")
    groups = sector_groups_for_market(market)
    period_days = st.slider("Lookback (days)", 5, 180, 30)
    if st.button("Load sector performance"):
        rows = []
        for sector, syms in groups.items():
            syms = syms if isinstance(syms, list) else [syms]
            changes = []
            for s in syms:
                df = get_history(s, period=f"{period_days + 5}d")
                if len(df) > 1:
                    changes.append((df["Close"].iloc[-1] / df["Close"].iloc[0] - 1) * 100)
            if changes:
                rows.append({"Sector": sector, "Avg Change %": round(sum(changes) / len(changes), 2)})
        if rows:
            df = pd.DataFrame(rows).sort_values("Avg Change %", ascending=False)
            fig = go.Figure(go.Bar(
                x=df["Sector"], y=df["Avg Change %"],
                marker_color=["#16A34A" if v >= 0 else "#DC2626" for v in df["Avg Change %"]]
            ))
            fig.update_layout(height=420, margin=dict(t=20))
            st.plotly_chart(fig, use_container_width=True)
            st.dataframe(df, use_container_width=True)

# Gainers / Losers / Most Active
with tabs[2]:
    st.markdown("### Top Gainers, Losers & Most Active (curated universe)")
    st.caption("Based on a fixed list of well-known symbols, not the full exchange — a real screener API would be needed for exchange-wide rankings.")
    if st.button("Refresh market movers"):
        universe = universe_for_market(market)
        with loading("Fetching quotes..."):
            snap_df = get_batch_snapshot(universe)
        if not snap_df.empty:
            snap_df["symbol"] = snap_df["symbol"].apply(strip_suffix)
            c1, c2, c3 = st.columns(3)
            with c1:
                st.markdown("**Top Gainers**")
                st.dataframe(snap_df.sort_values("pct", ascending=False).head(5)[["symbol", "price", "pct"]],
                             use_container_width=True)
            with c2:
                st.markdown("**Top Losers**")
                st.dataframe(snap_df.sort_values("pct").head(5)[["symbol", "price", "pct"]],
                             use_container_width=True)
            with c3:
                st.markdown("**Most Active (by volume)**")
                st.dataframe(snap_df.sort_values("volume", ascending=False).head(5)[["symbol", "price", "volume"]],
                             use_container_width=True)

# Screener
with tabs[3]:
    st.markdown("### Stock Screener (curated universe)")
    universe = universe_for_market(market)
    c1, c2 = st.columns(2)
    min_pct = c1.number_input("Minimum day change %", value=-100.0)
    max_pct = c2.number_input("Maximum day change %", value=100.0)
    if st.button("Run screener"):
        with loading("Screening..."):
            snap_df = get_batch_snapshot(universe)
        if not snap_df.empty:
            snap_df["symbol"] = snap_df["symbol"].apply(strip_suffix)
            filtered = snap_df[(snap_df["pct"] >= min_pct) & (snap_df["pct"] <= max_pct)]
            st.dataframe(filtered, use_container_width=True)
        else:
            st.warning("No data returned.")

# Export Report
with tabs[4]:
    st.markdown("### Export a report for the currently loaded stock")
    cache = st.session_state.get("analysis_cache", {})
    result = cache.get(yf_symbol)

    if result is None:
        st.info("This stock hasn't been analysed yet in this session.")
        if st.button("Run analysis for this stock", key="export_run_analysis"):
            with loading(f"Preparing report for {yf_symbol}..."):
                result = run_analysis(yf_symbol, market)
            st.rerun()
    else:
        forecast_7d_fmt = [result["currency_fmt"](v) for v in result["forecast_7d"]]
        pdf_bytes = build_pdf_report(
            result["symbol"], market, result["currency_fmt"](result["latest_price"]),
            result["change_pct"], result["signal"], result["score"], result["risk"],
            result["forecast_7d"], forecast_7d_fmt, result["summary"]
        )
        st.download_button("Download PDF report", pdf_bytes,
                            file_name=f"{result['symbol']}_report.pdf", mime="application/pdf")

        forecast_df = pd.DataFrame({"Day": range(1, 31), "Forecast": result["forecast_30"]})
        excel_bytes = build_excel_report(result["symbol"], result["df"], result["df_ind"], forecast_df)
        st.download_button("Download Excel report", excel_bytes,
                            file_name=f"{result['symbol']}_report.xlsx",
                            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

# Assistant (chatbot + voice)
with tabs[5]:
    st.markdown("### Chatbot Assistant")
    st.caption("Rule-based assistant answering from the currently loaded stock's data — no external LLM API key needed.")
    cache = st.session_state.get("analysis_cache", {})
    result = cache.get(yf_symbol)
    if result is None:
        st.caption("Tip: analyse a stock on the Home page (or the Export Report tab) first, so I have data to answer from.")
    context = get_chatbot_context(result)

    if "chat_history" not in st.session_state:
        st.session_state.chat_history = []

    question = st.text_input("Ask about the loaded stock (e.g. \"what's the RSI?\", \"should I buy?\")")
    if st.button("Ask") and question:
        reply = chatbot_answer(question, context)
        st.session_state.chat_history.insert(0, (question, reply))

    for q, a in st.session_state.chat_history[:10]:
        st.markdown(f"**You:** {q}")
        st.markdown(f"**Assistant:** {a}")
        st.markdown("---")

    st.markdown("### Voice Assistant")
    st.caption("Server-side apps can't reliably capture a live microphone, so speech-to-text works from an uploaded audio clip; text-to-speech plays back any answer.")

    voice_col1, voice_col2 = st.columns(2)
    with voice_col1:
        st.markdown("**Speech to Text**")
        audio_file = st.file_uploader("Upload a WAV/FLAC clip of your question", type=["wav", "flac"])
        if audio_file and st.button("Transcribe"):
            text, err = speech_to_text_from_file(audio_file)
            if err:
                st.error(err)
            else:
                st.success(f"Transcribed: {text}")
                reply = chatbot_answer(text, context)
                st.info(reply)

    with voice_col2:
        st.markdown("**Text to Speech**")
        tts_text = st.text_area("Text to speak", value=result["summary"] if result else "Load a stock first.")
        if st.button("Generate speech"):
            audio_bytes, err = text_to_speech_bytes(tts_text)
            if err:
                st.error(err)
            else:
                st.audio(audio_bytes, format="audio/mp3")

