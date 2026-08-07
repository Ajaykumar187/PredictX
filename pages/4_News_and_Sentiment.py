import datetime

import streamlit as st

from utils.styling import inject_css, navbar, loading, badge
from utils.sidebar import stock_selector_sidebar
from utils.pipeline import run_analysis
from utils.data_fetch import get_news
from utils.sentiment import score_news_items, aggregate_sentiment, fear_greed_index

st.set_page_config(page_title="News & Sentiment", layout="wide", initial_sidebar_state="expanded")

market, symbol_input, yf_symbol, load_clicked = stock_selector_sidebar()

inject_css()
navbar("News & Sentiment", "Latest headlines, sentiment scoring, and a Fear & Greed proxy")

with loading(f"Loading news for {yf_symbol}..."):
    result = run_analysis(yf_symbol, market, force=load_clicked)
    news_items = get_news(yf_symbol, limit=12)

if result is None:
    st.info("Load a stock from the sidebar to see news & sentiment.")
    st.stop()

scored = score_news_items(news_items)
agg = aggregate_sentiment(scored)

st.markdown("### AI News Summary")
if scored:
    top_titles = [s["title"] for s in scored[:3] if s.get("title")]
    dominant = ("mostly positive" if agg["positive"] > max(agg["negative"], agg["neutral"])
                else "mostly negative" if agg["negative"] > max(agg["positive"], agg["neutral"])
                else "mixed/neutral")
    summary_lines = [
        f"Of the last {len(scored)} headlines for **{result['symbol']}**, sentiment reads as **{dominant}** "
        f"({agg['positive']} positive, {agg['neutral']} neutral, {agg['negative']} negative; "
        f"average compound score {agg['avg_compound']:+.2f})."
    ]
    if top_titles:
        summary_lines.append("Most recent: " + "; ".join(top_titles) + ".")
    st.info(" ".join(summary_lines))
    st.caption("Templated from the same headline sentiment scores shown below — not a language model summary.")
else:
    st.caption("No recent news available to summarize.")

st.markdown("### News Sentiment Summary")
s1, s2, s3, s4 = st.columns(4)
s1.metric("Positive", agg["positive"])
s2.metric("Neutral", agg["neutral"])
s3.metric("Negative", agg["negative"])
s4.metric("Avg. sentiment", f"{agg['avg_compound']:+.2f}")

row = result["df_ind"].iloc[-1]
fg_score, fg_label = fear_greed_index(
    rsi_value=row["RSI14"],
    volatility_pct=result["risk"]["annual_volatility_pct"],
    momentum_pct=result["change_pct"],
    news_compound_avg=agg["avg_compound"]
)
st.markdown("### Fear & Greed Proxy")
fg_kind = "red" if fg_score < 45 else "amber" if fg_score < 55 else "green"
st.markdown(f"**{fg_label}** — {badge(f'{fg_score}/100', fg_kind)}", unsafe_allow_html=True)
st.progress(fg_score / 100)
st.caption("A simplified proxy built from this app's own RSI, volatility, momentum, and news sentiment — not CNN Business's published Fear & Greed Index.")

st.markdown("### Latest Headlines")
if not scored:
    st.write("No recent news returned for this symbol.")
for item in scored:
    title = item.get("title") or "(untitled)"
    publisher = item.get("publisher", "")
    link = item.get("link", "#")
    ts = item.get("providerPublishTime")
    date_str = datetime.datetime.fromtimestamp(ts).strftime("%d %b %Y") if ts else ""
    sent_kind = {"Positive": "green", "Negative": "red", "Neutral": "navy"}[item["sentiment"]]

    st.markdown(f"""
    <div class="card" style="text-align:left; margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong>{title}</strong>
            {badge(item['sentiment'], sent_kind)}
        </div>
        <p style="margin-top:6px; font-size:13px; opacity:.75;">{publisher} · {date_str}</p>
        <a href="{link}" target="_blank">Read more →</a>
    </div>
    """, unsafe_allow_html=True)

st.markdown("### News Impact Analysis")
if agg["avg_compound"] > 0.15:
    st.success("Recent headline sentiment is notably positive — historically this can coincide with short-term buying interest, though price action depends on many other factors.")
elif agg["avg_compound"] < -0.15:
    st.warning("Recent headline sentiment is notably negative — this can coincide with short-term selling pressure, though it's only one input among many.")
else:
    st.info("Recent headline sentiment is roughly neutral — news doesn't appear to be a dominant driver right now.")
