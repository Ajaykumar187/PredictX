import streamlit as st

from utils.data_fetch import get_history, get_info
from utils.indicators import add_all_indicators
from utils.ai_engine import (train_lstm, forecast_future, confidence_score,
                              buy_sell_hold_signal, risk_analysis, ai_market_summary)
from utils.market import format_currency, strip_suffix


def run_analysis(yf_symbol: str, market: str, start="2015-01-01", force=False):
    cache = st.session_state.setdefault("analysis_cache", {})
    if not force and yf_symbol in cache:
        return cache[yf_symbol]

    df = get_history(yf_symbol, start=start)
    if df.empty or len(df) < 120:
        return None

    df_ind = add_all_indicators(df)
    info = get_info(yf_symbol)

    lstm_result = train_lstm(df["Close"], timesteps=60, epochs=1)
    conf = confidence_score(lstm_result["predictions"], lstm_result["actual"])

    forecast_30 = forecast_future(
        lstm_result["model"], lstm_result["scaler"], lstm_result["scaled"],
        lstm_result["timesteps"], days_ahead=30
    )
    forecast_next_day = forecast_30[:1]
    forecast_7d = forecast_30[:7]

    signal, score, reasons = buy_sell_hold_signal(df_ind)
    risk = risk_analysis(df["Close"])

    latest_price = float(df["Close"].iloc[-1])
    prev_price = float(df["Close"].iloc[-2])
    change = latest_price - prev_price
    change_pct = (change / prev_price) * 100 if prev_price else 0.0

    currency_fmt = lambda v: format_currency(v, market)

    summary = ai_market_summary(
        strip_suffix(yf_symbol), market, latest_price, change_pct,
        signal, score, risk, forecast_7d, currency_fmt
    )

    result = {
        "symbol": strip_suffix(yf_symbol), "yf_symbol": yf_symbol, "market": market,
        "df": df, "df_ind": df_ind, "info": info,
        "lstm": lstm_result, "confidence": conf,
        "forecast_30": forecast_30, "forecast_7d": forecast_7d, "forecast_next_day": forecast_next_day,
        "signal": signal, "score": score, "reasons": reasons, "risk": risk,
        "latest_price": latest_price, "change": change, "change_pct": change_pct,
        "currency_fmt": currency_fmt, "summary": summary, "loaded": True
    }
    cache[yf_symbol] = result
    st.session_state.analysis_cache = cache
    st.session_state.last_symbol = yf_symbol
    return result


def get_chatbot_context(result):
    if not result:
        return {"loaded": False}
    row = result["df_ind"].iloc[-1]
    return {
        "loaded": True, "symbol": result["symbol"], "currency_fmt": result["currency_fmt"],
        "latest_price": result["latest_price"], "change_pct": result["change_pct"],
        "rsi": row["RSI14"], "macd_bullish": row["MACD"] > row["MACD_Signal"],
        "signal": result["signal"], "score": result["score"], "risk": result["risk"],
        "forecast_7d": result["forecast_7d"], "info": result["info"]
    }
