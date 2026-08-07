import numpy as np
import pandas as pd

from utils.data_fetch import get_history, get_quote_snapshot

GLOBAL_SYMBOLS = {
    "Dow Jones": "^DJI", "NASDAQ": "^IXIC", "S&P 500": "^GSPC",
    "FTSE 100": "^FTSE", "Nikkei 225": "^N225", "Hang Seng": "^HSI",
    "Dollar Index (DXY)": "DX-Y.NYB", "Crude Oil (WTI)": "CL=F", "Natural Gas": "NG=F",
}

def fetch_global_snapshot():
    rows = []
    for name, symbol in GLOBAL_SYMBOLS.items():
        snap = get_quote_snapshot(symbol)
        if snap:
            rows.append({"name": name, **snap})
    return pd.DataFrame(rows)


def market_breadth(history: dict):
    above_50sma = 0
    momentum_values = []
    counted = 0
    for symbol, df in history.items():
        if len(df) < 55:
            continue
        counted += 1
        sma50 = df["Close"].rolling(50).mean().iloc[-1]
        if df["Close"].iloc[-1] > sma50:
            above_50sma += 1
        momentum_values.append((df["Close"].iloc[-1] / df["Close"].iloc[-11] - 1) * 100)

    pct_above_50sma = (above_50sma / counted * 100) if counted else 50.0
    avg_momentum = float(np.mean(momentum_values)) if momentum_values else 0.0
    return pct_above_50sma, avg_momentum, counted


def market_mood_index(pct_above_50sma, avg_momentum):
    breadth_component = pct_above_50sma
    momentum_component = max(0, min(100, 50 + avg_momentum * 4))
    composite = round(breadth_component * 0.6 + momentum_component * 0.4, 1)

    if composite < 25:
        label = "Extreme Fear"
    elif composite < 45:
        label = "Fear"
    elif composite < 55:
        label = "Neutral"
    elif composite < 75:
        label = "Greed"
    else:
        label = "Extreme Greed"
    return composite, label
