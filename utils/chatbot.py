def answer(question: str, context: dict) -> str:
    q = question.lower().strip()
    symbol = context.get("symbol", "the stock")
    currency_fmt = context.get("currency_fmt", lambda v: f"{v:.2f}")

    if not context.get("loaded"):
        return "Load a stock from the sidebar first, then ask me about its price, trend, RSI, MACD, or forecast."

    if any(k in q for k in ["price", "trading at", "current value"]):
        return f"{symbol} last traded at {currency_fmt(context['latest_price'])} ({context['change_pct']:+.2f}% vs previous close)."

    if "rsi" in q:
        rsi_v = context["rsi"]
        state = "oversold" if rsi_v < 30 else "overbought" if rsi_v > 70 else "neutral"
        return f"RSI14 for {symbol} is {rsi_v:.1f}, which is {state}."

    if "macd" in q:
        return ("MACD is above its signal line (bullish momentum)." if context["macd_bullish"]
                else "MACD is below its signal line (bearish momentum).")

    if any(k in q for k in ["buy", "sell", "hold", "signal", "recommend"]):
        return f"The current rule-based signal for {symbol} is **{context['signal']}** (score {context['score']:+d}/100). This isn't financial advice — just a summary of the indicators."

    if any(k in q for k in ["risk", "volatil", "drawdown"]):
        r = context["risk"]
        return f"{symbol} shows {r['risk_label'].lower()} risk: {r['annual_volatility_pct']}% annualised volatility and a max drawdown of {r['max_drawdown_pct']}%."

    if any(k in q for k in ["forecast", "predict", "next week", "tomorrow", "30 day", "30-day"]):
        f = context["forecast_7d"]
        return f"The 7-day LSTM forecast projects {symbol} moving toward {currency_fmt(f[-1])} (from {currency_fmt(context['latest_price'])} today)."

    if any(k in q for k in ["52", "high", "low"]):
        info = context.get("info", {})
        hi = info.get("fiftyTwoWeekHigh")
        lo = info.get("fiftyTwoWeekLow")
        if hi and lo:
            return f"{symbol}'s 52-week range is {currency_fmt(lo)} – {currency_fmt(hi)}."
        return "52-week high/low isn't available for this symbol right now."

    if any(k in q for k in ["pe", "p/e", "eps", "market cap", "dividend"]):
        info = context.get("info", {})
        return (f"PE: {info.get('trailingPE', 'N/A')} | EPS: {info.get('trailingEps', 'N/A')} | "
                f"Market cap: {info.get('marketCap', 'N/A')} | Dividend yield: {info.get('dividendYield', 'N/A')}")

    return ("I can answer questions about price, RSI, MACD, buy/sell/hold signal, risk, "
            "forecasts, 52-week range, PE/EPS/market cap/dividend for the currently loaded stock. "
            "Try asking things like \"what's the RSI?\" or \"should I buy?\"")
