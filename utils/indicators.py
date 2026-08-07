import pandas as pd
import numpy as np


def _resolve_series(data, column="Close"):
    if isinstance(data, pd.Series):
        return data
    return data[column]


class TechnicalIndicators:

    @staticmethod
    def sma(data, period=20, column="Close"):
        """Simple Moving Average"""
        return _resolve_series(data, column).rolling(period).mean()

    @staticmethod
    def ema(data, period=20, column="Close"):
        """Exponential Moving Average"""
        return _resolve_series(data, column).ewm(span=period, adjust=False).mean()

    @staticmethod
    def rsi(data, period=14, column="Close"):
        """Relative Strength Index"""

        series = _resolve_series(data, column)
        delta = series.diff()

        gain = delta.clip(lower=0)
        loss = -delta.clip(upper=0)

        avg_gain = gain.rolling(period).mean()
        avg_loss = loss.rolling(period).mean()

        rs = avg_gain / avg_loss

        rsi = 100 - (100 / (1 + rs))

        return rsi

    @staticmethod
    def macd(data, column="Close"):

        series = _resolve_series(data, column)

        ema12 = series.ewm(span=12, adjust=False).mean()
        ema26 = series.ewm(span=26, adjust=False).mean()

        macd = ema12 - ema26

        signal = macd.ewm(span=9, adjust=False).mean()

        histogram = macd - signal

        return macd, signal, histogram

    @staticmethod
    def bollinger_bands(data, period=20, column="Close"):

        series = _resolve_series(data, column)

        sma = series.rolling(period).mean()

        std = series.rolling(period).std()

        upper = sma + 2 * std
        lower = sma - 2 * std

        return upper, sma, lower

    @staticmethod
    def atr(df, period=14):

        high_low = df["High"] - df["Low"]

        high_close = np.abs(
            df["High"] - df["Close"].shift()
        )

        low_close = np.abs(
            df["Low"] - df["Close"].shift()
        )

        tr = pd.concat(
            [high_low, high_close, low_close],
            axis=1
        ).max(axis=1)

        atr = tr.rolling(period).mean()

        return atr

    @staticmethod
    def vwap(df):

        tp = (
            df["High"]
            + df["Low"]
            + df["Close"]
        ) / 3

        vwap = (
            (tp * df["Volume"]).cumsum()
            /
            df["Volume"].cumsum()
        )

        return vwap

def add_all_indicators(df):
    

    df = df.copy()

    ti = TechnicalIndicators()

    df["SMA20"] = ti.sma(df, 20)
    df["SMA50"] = ti.sma(df, 50)
    df["SMA100"] = ti.sma(df, 100)
    df["SMA200"] = ti.sma(df, 200)
    df["EMA20"] = ti.ema(df, 20)
    df["EMA50"] = ti.ema(df, 50)

    df["RSI14"] = ti.rsi(df, 14)

    macd, signal, hist = ti.macd(df)

    df["MACD"] = macd
    df["MACD_Signal"] = signal
    df["MACD_Histogram"] = hist
    df["MACD_Hist"] = hist

    upper, middle, lower = ti.bollinger_bands(df)

    df["BB_Upper"] = upper
    df["BB_Middle"] = middle
    df["BB_Lower"] = lower

    # ATR
    df["ATR14"] = ti.atr(df)

    # VWAP
    df["VWAP"] = ti.vwap(df)

    return df

# Compatibility Wrappers

def sma(df, period=20, column="Close"):
    return TechnicalIndicators.sma(df, period, column)


def ema(df, period=20, column="Close"):
    return TechnicalIndicators.ema(df, period, column)


def rsi(df, period=14, column="Close"):
    return TechnicalIndicators.rsi(df, period, column)


def macd(df, column="Close"):
    return TechnicalIndicators.macd(df, column)


def bollinger_bands(df, period=20, column="Close"):
    return TechnicalIndicators.bollinger_bands(df, period, column)


def atr(df, period=14):
    return TechnicalIndicators.atr(df, period)


def volatility(close_series, window=20):
    returns = close_series.pct_change()
    return returns.rolling(window).std() * np.sqrt(252) * 100


def vwap(df):
    return TechnicalIndicators.vwap(df)


# Trend line & Fibonacci (used by the Charts & Analysis page)

def trend_line(close_series):
    """
    Simple linear-regression trend line over the whole series.
    Returns (trend_as_series, slope).
    """
    values = close_series.values.astype(float)
    x = np.arange(len(values))
    mask = ~np.isnan(values)

    if mask.sum() < 2:
        return pd.Series(np.nan, index=close_series.index), 0.0

    slope, intercept = np.polyfit(x[mask], values[mask], 1)
    trend = slope * x + intercept

    return pd.Series(trend, index=close_series.index), float(slope)


def fibonacci_levels(high, low):
    """
    Classic retracement levels between a swing high and low.
    """
    diff = high - low
    return {
        "0.0%": high,
        "23.6%": high - diff * 0.236,
        "38.2%": high - diff * 0.382,
        "50.0%": high - diff * 0.5,
        "61.8%": high - diff * 0.618,
        "78.6%": high - diff * 0.786,
        "100.0%": low,
    }


# Advanced indicators (Ichimoku, Supertrend, Donchian, Keltner,
# Parabolic SAR, Pivot Points, ADX, Stochastic RSI, CCI, OBV, MFI)

def _ichimoku(df):
    high, low, close = df["High"], df["Low"], df["Close"]

    tenkan = (high.rolling(9).max() + low.rolling(9).min()) / 2
    kijun = (high.rolling(26).max() + low.rolling(26).min()) / 2
    span_a = ((tenkan + kijun) / 2).shift(26)
    span_b = ((high.rolling(52).max() + low.rolling(52).min()) / 2).shift(26)

    return tenkan, kijun, span_a, span_b


def _supertrend(df, period=10, multiplier=3.0):
    atr = TechnicalIndicators.atr(df, period)
    hl2 = (df["High"] + df["Low"]) / 2

    upper_basic = hl2 + multiplier * atr
    lower_basic = hl2 - multiplier * atr

    final_upper = upper_basic.copy()
    final_lower = lower_basic.copy()
    supertrend = pd.Series(index=df.index, dtype=float)
    direction = pd.Series(index=df.index, dtype=int)

    valid = upper_basic.notna() & lower_basic.notna()
    if not valid.any():
        return supertrend, direction

    start = int(np.argmax(valid.values))

    supertrend.iloc[start] = final_upper.iloc[start]
    direction.iloc[start] = 1

    for i in range(start + 1, len(df)):
        if upper_basic.iloc[i] < final_upper.iloc[i - 1] or df["Close"].iloc[i - 1] > final_upper.iloc[i - 1]:
            final_upper.iloc[i] = upper_basic.iloc[i]
        else:
            final_upper.iloc[i] = final_upper.iloc[i - 1]

        if lower_basic.iloc[i] > final_lower.iloc[i - 1] or df["Close"].iloc[i - 1] < final_lower.iloc[i - 1]:
            final_lower.iloc[i] = lower_basic.iloc[i]
        else:
            final_lower.iloc[i] = final_lower.iloc[i - 1]

        if df["Close"].iloc[i] > final_upper.iloc[i - 1]:
            direction.iloc[i] = 1
        elif df["Close"].iloc[i] < final_lower.iloc[i - 1]:
            direction.iloc[i] = -1
        else:
            direction.iloc[i] = direction.iloc[i - 1]

        supertrend.iloc[i] = final_lower.iloc[i] if direction.iloc[i] == 1 else final_upper.iloc[i]

    return supertrend, direction


def _donchian(df, period=20):
    upper = df["High"].rolling(period).max()
    lower = df["Low"].rolling(period).min()
    return upper, lower


def _keltner(df, period=20, multiplier=2.0):
    ema_mid = TechnicalIndicators.ema(df, period)
    atr = TechnicalIndicators.atr(df, period)
    upper = ema_mid + multiplier * atr
    lower = ema_mid - multiplier * atr
    return upper, lower


def _parabolic_sar(df, af_step=0.02, af_max=0.2):
    high, low = df["High"].values, df["Low"].values
    n = len(df)
    psar = np.zeros(n)

    if n == 0:
        return pd.Series(psar, index=df.index)

    uptrend = True
    af = af_step
    ep = high[0]
    psar[0] = low[0]

    for i in range(1, n):
        prev_psar = psar[i - 1]

        if uptrend:
            psar[i] = prev_psar + af * (ep - prev_psar)
            psar[i] = min(psar[i], low[i - 1], low[i - 2] if i > 1 else low[i - 1])
            if high[i] > ep:
                ep = high[i]
                af = min(af + af_step, af_max)
            if low[i] < psar[i]:
                uptrend = False
                psar[i] = ep
                ep = low[i]
                af = af_step
        else:
            psar[i] = prev_psar + af * (ep - prev_psar)
            psar[i] = max(psar[i], high[i - 1], high[i - 2] if i > 1 else high[i - 1])
            if low[i] < ep:
                ep = low[i]
                af = min(af + af_step, af_max)
            if high[i] > psar[i]:
                uptrend = True
                psar[i] = ep
                ep = high[i]
                af = af_step

    return pd.Series(psar, index=df.index)


def _pivot_points(df):
    prev_high = df["High"].shift(1)
    prev_low = df["Low"].shift(1)
    prev_close = df["Close"].shift(1)

    pivot = (prev_high + prev_low + prev_close) / 3
    r1 = 2 * pivot - prev_low
    s1 = 2 * pivot - prev_high
    r2 = pivot + (prev_high - prev_low)
    s2 = pivot - (prev_high - prev_low)

    return pivot, r1, r2, s1, s2


def _adx(df, period=14):
    high, low, close = df["High"], df["Low"], df["Close"]

    up_move = high.diff()
    down_move = -low.diff()

    plus_dm = np.where((up_move > down_move) & (up_move > 0), up_move, 0.0)
    minus_dm = np.where((down_move > up_move) & (down_move > 0), down_move, 0.0)

    atr = TechnicalIndicators.atr(df, period).replace(0, np.nan)

    plus_di = 100 * pd.Series(plus_dm, index=df.index).rolling(period).mean() / atr
    minus_di = 100 * pd.Series(minus_dm, index=df.index).rolling(period).mean() / atr

    dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)
    adx = dx.rolling(period).mean()

    return adx, plus_di, minus_di


def _stoch_rsi(df, period=14, smooth_k=3, smooth_d=3):
    rsi_series = TechnicalIndicators.rsi(df, period)
    min_rsi = rsi_series.rolling(period).min()
    max_rsi = rsi_series.rolling(period).max()

    stoch = (rsi_series - min_rsi) / (max_rsi - min_rsi).replace(0, np.nan) * 100
    k = stoch.rolling(smooth_k).mean()
    d = k.rolling(smooth_d).mean()

    return k, d


def _cci(df, period=20):
    tp = (df["High"] + df["Low"] + df["Close"]) / 3
    sma_tp = tp.rolling(period).mean()
    mean_dev = tp.rolling(period).apply(lambda x: np.mean(np.abs(x - x.mean())), raw=True)
    cci = (tp - sma_tp) / (0.015 * mean_dev.replace(0, np.nan))
    return cci


def _obv(df):
    direction = np.sign(df["Close"].diff().fillna(0))
    return (direction * df["Volume"]).cumsum()


def _mfi(df, period=14):
    tp = (df["High"] + df["Low"] + df["Close"]) / 3
    money_flow = tp * df["Volume"]

    positive_flow = money_flow.where(tp > tp.shift(1), 0.0)
    negative_flow = money_flow.where(tp < tp.shift(1), 0.0)

    positive_sum = positive_flow.rolling(period).sum()
    negative_sum = negative_flow.rolling(period).sum().replace(0, np.nan)

    money_ratio = positive_sum / negative_sum
    return 100 - (100 / (1 + money_ratio))


def add_advanced_indicators(df):
    df = df.copy()

    tenkan, kijun, span_a, span_b = _ichimoku(df)
    df["Ichimoku_Tenkan"] = tenkan
    df["Ichimoku_Kijun"] = kijun
    df["Ichimoku_SpanA"] = span_a
    df["Ichimoku_SpanB"] = span_b

    supertrend, direction = _supertrend(df)
    df["Supertrend"] = supertrend
    df["Supertrend_Dir"] = direction

    donchian_upper, donchian_lower = _donchian(df)
    df["Donchian_Upper"] = donchian_upper
    df["Donchian_Lower"] = donchian_lower

    keltner_upper, keltner_lower = _keltner(df)
    df["Keltner_Upper"] = keltner_upper
    df["Keltner_Lower"] = keltner_lower

    df["PSAR"] = _parabolic_sar(df)

    pivot, r1, r2, s1, s2 = _pivot_points(df)
    df["Pivot"] = pivot
    df["R1"] = r1
    df["R2"] = r2
    df["S1"] = s1
    df["S2"] = s2

    adx, plus_di, minus_di = _adx(df)
    df["ADX14"] = adx
    df["Plus_DI"] = plus_di
    df["Minus_DI"] = minus_di

    if "ATR14" not in df.columns:
        df["ATR14"] = TechnicalIndicators.atr(df, 14)

    stoch_k, stoch_d = _stoch_rsi(df)
    df["StochRSI_K"] = stoch_k
    df["StochRSI_D"] = stoch_d

    df["CCI20"] = _cci(df, 20)
    df["OBV"] = _obv(df)
    df["MFI14"] = _mfi(df, 14)

    return df