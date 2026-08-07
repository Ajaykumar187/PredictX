from concurrent.futures import ThreadPoolExecutor, as_completed

import pandas as pd

from utils.data_fetch import get_history


def _fetch_one(symbol: str, period: str = "6mo"):
    try:
        df = get_history(symbol, period=period)
        return symbol, df
    except Exception:
        return symbol, pd.DataFrame()


def fetch_universe_history(symbols, period: str = "6mo", max_workers: int = 8):
    results = {}
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(_fetch_one, s, period) for s in symbols]
        for future in as_completed(futures):
            symbol, df = future.result()
            if not df.empty:
                results[symbol] = df
    return results


def scan_breakouts(history: dict, window: int = 20):
    hits = []
    for symbol, df in history.items():
        if len(df) < window + 2:
            continue
        prior_high = df["High"].iloc[-window - 1:-1].max()
        last_close = df["Close"].iloc[-1]
        if last_close > prior_high:
            hits.append({"symbol": symbol, "close": round(last_close, 2),
                         "prior_high": round(prior_high, 2),
                         "breakout_pct": round((last_close / prior_high - 1) * 100, 2)})
    return pd.DataFrame(hits).sort_values("breakout_pct", ascending=False) if hits else pd.DataFrame()


def scan_gaps(history: dict, min_gap_pct: float = 2.0):
    hits = []
    for symbol, df in history.items():
        if len(df) < 2:
            continue
        prev_close = df["Close"].iloc[-2]
        today_open = df["Open"].iloc[-1]
        gap_pct = (today_open - prev_close) / prev_close * 100
        if abs(gap_pct) >= min_gap_pct:
            hits.append({"symbol": symbol, "prev_close": round(prev_close, 2),
                         "open": round(today_open, 2), "gap_pct": round(gap_pct, 2),
                         "direction": "Gap Up" if gap_pct > 0 else "Gap Down"})
    return pd.DataFrame(hits).sort_values("gap_pct", ascending=False) if hits else pd.DataFrame()


def scan_momentum(history: dict, lookback: int = 10):
    hits = []
    for symbol, df in history.items():
        if len(df) < lookback + 1:
            continue
        roc = (df["Close"].iloc[-1] / df["Close"].iloc[-lookback - 1] - 1) * 100
        hits.append({"symbol": symbol, "close": round(df["Close"].iloc[-1], 2),
                     f"{lookback}d_roc_pct": round(roc, 2)})
    df_out = pd.DataFrame(hits)
    return df_out.sort_values(f"{lookback}d_roc_pct", ascending=False) if not df_out.empty else df_out


def scan_swing(history: dict, sma_fast: int = 20, sma_slow: int = 50):
    hits = []
    for symbol, df in history.items():
        if len(df) < sma_slow + 5:
            continue
        fast = df["Close"].rolling(sma_fast).mean()
        slow = df["Close"].rolling(sma_slow).mean()
        cross_now = fast.iloc[-1] > slow.iloc[-1]
        cross_recent = any((fast.iloc[-i] > slow.iloc[-i]) != (fast.iloc[-i - 1] > slow.iloc[-i - 1])
                            for i in range(1, 4) if len(fast) > i + 1)
        if cross_now and cross_recent:
            hits.append({"symbol": symbol, "close": round(df["Close"].iloc[-1], 2),
                         f"sma{sma_fast}": round(fast.iloc[-1], 2), f"sma{sma_slow}": round(slow.iloc[-1], 2)})
    return pd.DataFrame(hits) if hits else pd.DataFrame()


def scan_volume_spike(history: dict, window: int = 20, spike_multiple: float = 2.0):
    from utils.indicators import rsi as _rsi, macd as _macd

    hits = []
    for symbol, df in history.items():
        if len(df) < window + 2 or "Volume" not in df:
            continue
        avg_vol = df["Volume"].iloc[-window - 1:-1].mean()
        last_vol = df["Volume"].iloc[-1]
        if avg_vol and last_vol >= avg_vol * spike_multiple:
            hits.append({"symbol": symbol, "volume": int(last_vol), "avg_volume": int(avg_vol),
                         "multiple": round(last_vol / avg_vol, 2)})
    return pd.DataFrame(hits).sort_values("multiple", ascending=False) if hits else pd.DataFrame()


def scan_rsi_extreme(history: dict, overbought: float = 70, oversold: float = 30):
    from utils.indicators import rsi as _rsi
    hits = []
    for symbol, df in history.items():
        if len(df) < 20:
            continue
        rsi_val = float(_rsi(df["Close"], 14).iloc[-1])
        if rsi_val >= overbought or rsi_val <= oversold:
            hits.append({"symbol": symbol, "rsi": round(rsi_val, 1),
                         "condition": "Overbought" if rsi_val >= overbought else "Oversold"})
    return pd.DataFrame(hits) if hits else pd.DataFrame()


def scan_macd_crossover(history: dict):
    from utils.indicators import macd as _macd
    hits = []
    for symbol, df in history.items():
        if len(df) < 40:
            continue
        macd_line, signal_line, _ = _macd(df["Close"])
        now_above = macd_line.iloc[-1] > signal_line.iloc[-1]
        prev_above = macd_line.iloc[-2] > signal_line.iloc[-2]
        if now_above != prev_above:
            hits.append({"symbol": symbol, "crossover": "Bullish (MACD > Signal)" if now_above else "Bearish (MACD < Signal)"})
    return pd.DataFrame(hits) if hits else pd.DataFrame()
