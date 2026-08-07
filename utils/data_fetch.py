import re

import pandas as pd
import requests
import streamlit as st
import yfinance as yf


@st.cache_data(ttl=300, show_spinner=False)
def get_history(symbol: str, start: str = "2010-01-01", period: str = None, interval: str = "1d") -> pd.DataFrame:
    ticker = yf.Ticker(symbol)
    if period:
        df = ticker.history(period=period, interval=interval)
    else:
        df = ticker.history(start=start, interval=interval)
    if df is None or df.empty:
        return pd.DataFrame()
    if df.index.tz is not None:
        df.index = df.index.tz_localize(None)
    df.index.name = "Date"
    return df


@st.cache_data(ttl=600, show_spinner=False)
def get_info(symbol: str) -> dict:
    try:
        return yf.Ticker(symbol).info or {}
    except Exception:
        return {}


@st.cache_data(ttl=600, show_spinner=False)
def get_news(symbol: str, limit: int = 10):
    try:
        news = yf.Ticker(symbol).news or []
        return news[:limit]
    except Exception:
        return []


@st.cache_data(ttl=300, show_spinner=False)
def get_quote_snapshot(symbol: str) -> dict:
    try:
        df = yf.Ticker(symbol).history(period="5d")
        if df.empty or len(df) < 2:
            return {}
        last = float(df["Close"].iloc[-1])
        prev = float(df["Close"].iloc[-2])
        change = last - prev
        pct = (change / prev) * 100 if prev else 0.0
        volume = float(df["Volume"].iloc[-1])
        return {"symbol": symbol, "price": last, "change": change, "pct": pct, "volume": volume}
    except Exception:
        return {}


@st.cache_data(ttl=600, show_spinner=False)
def get_calendar(symbol: str) -> dict:
    try:
        cal = yf.Ticker(symbol).calendar
        if isinstance(cal, dict):
            return cal
        if hasattr(cal, "to_dict"):
            return cal.to_dict()
        return {}
    except Exception:
        return {}


@st.cache_data(ttl=600, show_spinner=False)
def get_dividends_and_splits(symbol: str):
    try:
        ticker = yf.Ticker(symbol)
        dividends = ticker.dividends
        splits = ticker.splits
        return dividends, splits
    except Exception:
        return pd.Series(dtype=float), pd.Series(dtype=float)


def get_batch_snapshot(symbols):
    rows = []
    for s in symbols:
        snap = get_quote_snapshot(s)
        if snap:
            rows.append(snap)
    return pd.DataFrame(rows)


@st.cache_data(ttl=86400, show_spinner=False)
def get_company_logo(website: str):
    if not website:
        return None
    domain = re.sub(r"^https?://", "", website.strip()).split("/")[0]
    domain = domain.replace("www.", "")
    if not domain:
        return None
    url = f"https://logo.clearbit.com/{domain}?size=128"
    try:
        resp = requests.get(url, timeout=6)
        if resp.status_code == 200 and resp.headers.get("content-type", "").startswith("image"):
            return resp.content
    except Exception:
        pass
    return None
