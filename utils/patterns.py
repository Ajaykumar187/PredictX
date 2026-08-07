import numpy as np
import pandas as pd


def detect_candlestick_patterns(df: pd.DataFrame) -> pd.DataFrame:
    o, h, l, c = df["Open"], df["High"], df["Low"], df["Close"]
    body = (c - o).abs()
    range_ = (h - l).replace(0, np.nan)
    upper_shadow = h - c.where(c >= o, o)
    lower_shadow = c.where(c <= o, o) - l

    out = pd.DataFrame(index=df.index)

    out["Doji"] = body <= 0.1 * range_

    out["Hammer"] = (lower_shadow >= 2 * body) & (upper_shadow <= 0.3 * body.replace(0, 0.01)) & (c > o)
    out["Shooting_Star"] = (upper_shadow >= 2 * body) & (lower_shadow <= 0.3 * body.replace(0, 0.01)) & (c < o)
    out["Inverted_Hammer"] = (upper_shadow >= 2 * body) & (lower_shadow <= 0.3 * body.replace(0, 0.01)) & (c > o)
    out["Hanging_Man"] = (lower_shadow >= 2 * body) & (upper_shadow <= 0.3 * body.replace(0, 0.01)) & (c < o)

    prev_o, prev_c = o.shift(1), c.shift(1)
    out["Bullish_Engulfing"] = (prev_c < prev_o) & (c > o) & (o <= prev_c) & (c >= prev_o)
    out["Bearish_Engulfing"] = (prev_c > prev_o) & (c < o) & (o >= prev_c) & (c <= prev_o)

    prev2_o, prev2_c = o.shift(2), c.shift(2)
    small_middle = body.shift(1) <= 0.3 * range_.shift(1)
    out["Morning_Star"] = (prev2_c < prev2_o) & small_middle & (c > o) & (c > (prev2_o + prev2_c) / 2)
    out["Evening_Star"] = (prev2_c > prev2_o) & small_middle & (c < o) & (c < (prev2_o + prev2_c) / 2)

    return out.fillna(False)


def summarize_recent_patterns(pattern_df: pd.DataFrame, lookback: int = 5):
    recent = pattern_df.tail(lookback)
    found = []
    for date, row in recent.iterrows():
        hits = [col.replace("_", " ") for col, val in row.items() if val]
        for h in hits:
            found.append((date, h))
    return found


def _local_extrema(series: pd.Series, order: int = 5):
    values = series.values
    n = len(values)
    maxima, minima = [], []
    for i in range(order, n - order):
        window = values[i - order:i + order + 1]
        if values[i] == window.max() and np.argmax(window) == order:
            maxima.append(i)
        if values[i] == window.min() and np.argmin(window) == order:
            minima.append(i)
    return maxima, minima


def detect_chart_patterns(df: pd.DataFrame, order: int = 8, tolerance: float = 0.02):
    close = df["Close"]
    maxima, minima = _local_extrema(close, order)
    findings = []

    for i in range(len(maxima) - 1):
        i1, i2 = maxima[i], maxima[i + 1]
        p1, p2 = close.iloc[i1], close.iloc[i2]
        if abs(p1 - p2) / max(p1, p2) <= tolerance:
            trough_between = [m for m in minima if i1 < m < i2]
            if trough_between:
                findings.append({
                    "pattern": "Double Top", "start": df.index[i1], "end": df.index[i2],
                    "note": f"Peaks at {p1:.2f} and {p2:.2f} — often read as a bearish reversal signal if the neckline breaks."
                })

    for i in range(len(minima) - 1):
        i1, i2 = minima[i], minima[i + 1]
        p1, p2 = close.iloc[i1], close.iloc[i2]
        if abs(p1 - p2) / max(p1, p2) <= tolerance:
            peak_between = [m for m in maxima if i1 < m < i2]
            if peak_between:
                findings.append({
                    "pattern": "Double Bottom", "start": df.index[i1], "end": df.index[i2],
                    "note": f"Troughs at {p1:.2f} and {p2:.2f} — often read as a bullish reversal signal if the neckline breaks."
                })

    for i in range(len(maxima) - 2):
        i1, i2, i3 = maxima[i], maxima[i + 1], maxima[i + 2]
        left, head, right = close.iloc[i1], close.iloc[i2], close.iloc[i3]
        if head > left and head > right and abs(left - right) / max(left, right) <= tolerance * 1.5:
            findings.append({
                "pattern": "Head & Shoulders", "start": df.index[i1], "end": df.index[i3],
                "note": f"Shoulders near {left:.2f}/{right:.2f}, head at {head:.2f} — often read as a bearish reversal signal if the neckline breaks."
            })

    return findings
