import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, LSTM

from utils.indicators import rsi as calc_rsi, macd as calc_macd, sma


def build_dataset(scaled_data, timesteps):
    x, y = [], []
    for i in range(timesteps, len(scaled_data)):
        x.append(scaled_data[i - timesteps:i, 0])
        y.append(scaled_data[i, 0])
    return np.array(x).reshape(-1, timesteps, 1), np.array(y)


def train_lstm(close_series: pd.Series, timesteps: int = 60, epochs: int = 1):
    values = close_series.values.reshape(-1, 1)
    scaler = MinMaxScaler(feature_range=(0, 1))
    scaled = scaler.fit_transform(values)

    train_len = int(len(scaled) * 0.8)
    train_data = scaled[:train_len]

    x_train, y_train = build_dataset(train_data, timesteps)

    model = Sequential([
        LSTM(50, return_sequences=True, input_shape=(timesteps, 1)),
        LSTM(50),
        Dense(25),
        Dense(1)
    ])
    model.compile(optimizer="adam", loss="mean_squared_error")
    model.fit(x_train, y_train, epochs=epochs, batch_size=32, verbose=0)

    test_data = scaled[train_len - timesteps:]
    x_test, y_test = build_dataset(test_data, timesteps)
    predictions_scaled = model.predict(x_test, verbose=0)
    predictions = scaler.inverse_transform(predictions_scaled)
    actual = scaler.inverse_transform(y_test.reshape(-1, 1))

    return {
        "model": model, "scaler": scaler, "scaled": scaled,
        "train_len": train_len, "timesteps": timesteps,
        "predictions": predictions.flatten(), "actual": actual.flatten()
    }


def forecast_future(model, scaler, scaled_data, timesteps, days_ahead):
    window = scaled_data[-timesteps:].reshape(1, timesteps, 1).copy()
    preds_scaled = []
    for _ in range(days_ahead):
        next_scaled = model.predict(window, verbose=0)[0, 0]
        preds_scaled.append(next_scaled)
        window = np.append(window[:, 1:, :], [[[next_scaled]]], axis=1)
    preds = scaler.inverse_transform(np.array(preds_scaled).reshape(-1, 1)).flatten()
    return preds


def confidence_score(predictions, actual):
    predictions = np.asarray(predictions)
    actual = np.asarray(actual)
    if len(actual) == 0:
        return 50.0
    mape = np.mean(np.abs((actual - predictions) / np.where(actual == 0, 1, actual))) * 100
    score = max(0.0, min(100.0, 100 - mape * 4))
    return round(score, 1)


def buy_sell_hold_signal(df_with_indicators: pd.DataFrame):
    row = df_with_indicators.iloc[-1]
    score = 0
    reasons = []

    if row["RSI14"] < 30:
        score += 25; reasons.append(f"RSI14 is {row['RSI14']:.1f} — oversold territory (bullish).")
    elif row["RSI14"] > 70:
        score -= 25; reasons.append(f"RSI14 is {row['RSI14']:.1f} — overbought territory (bearish).")
    else:
        reasons.append(f"RSI14 is {row['RSI14']:.1f} — neutral.")

    if row["MACD"] > row["MACD_Signal"]:
        score += 20; reasons.append("MACD is above its signal line (bullish momentum).")
    else:
        score -= 20; reasons.append("MACD is below its signal line (bearish momentum).")

    if row["Close"] > row["SMA50"]:
        score += 15; reasons.append("Price is above the 50-day moving average (uptrend).")
    else:
        score -= 15; reasons.append("Price is below the 50-day moving average (downtrend).")

    if pd.notna(row.get("SMA200")) and row["Close"] > row["SMA200"]:
        score += 15; reasons.append("Price is above the 200-day moving average (long-term uptrend).")
    elif pd.notna(row.get("SMA200")):
        score -= 15; reasons.append("Price is below the 200-day moving average (long-term downtrend).")

    if pd.notna(row.get("BB_Upper")) and row["Close"] >= row["BB_Upper"]:
        score -= 10; reasons.append("Price is at/above the upper Bollinger Band (possible pullback).")
    elif pd.notna(row.get("BB_Lower")) and row["Close"] <= row["BB_Lower"]:
        score += 10; reasons.append("Price is at/below the lower Bollinger Band (possible bounce).")

    score = max(-100, min(100, score))
    if score >= 25:
        signal = "BUY"
    elif score <= -25:
        signal = "SELL"
    else:
        signal = "HOLD"
    return signal, score, reasons


def risk_analysis(close_series: pd.Series, index_series: pd.Series = None):
    returns = close_series.pct_change().dropna()
    ann_vol = returns.std() * np.sqrt(252) * 100

    cumulative = (1 + returns).cumprod()
    running_max = cumulative.cummax()
    drawdown = (cumulative / running_max) - 1
    max_drawdown = drawdown.min() * 100

    beta = None
    if index_series is not None and len(index_series) > 10:
        idx_returns = index_series.pct_change().dropna()
        aligned = pd.concat([returns, idx_returns], axis=1, join="inner").dropna()
        aligned.columns = ["stock", "index"]
        if len(aligned) > 10 and aligned["index"].var() > 0:
            beta = aligned["stock"].cov(aligned["index"]) / aligned["index"].var()

    if ann_vol < 20:
        risk_label = "Low"
    elif ann_vol < 40:
        risk_label = "Moderate"
    else:
        risk_label = "High"

    return {
        "annual_volatility_pct": round(ann_vol, 2),
        "max_drawdown_pct": round(max_drawdown, 2),
        "beta": round(beta, 2) if beta is not None else None,
        "risk_label": risk_label
    }


def ai_market_summary(display_symbol, market, latest_price, change_pct, signal, score,
                       risk, forecast_7d, currency_fmt):
    direction = "gained" if change_pct >= 0 else "fallen"
    trend_word = {"BUY": "bullish", "SELL": "bearish", "HOLD": "mixed"}[signal]
    week_direction = "higher" if forecast_7d[-1] > latest_price else "lower"
    week_move_pct = (forecast_7d[-1] - latest_price) / latest_price * 100

    lines = [
        f"**{display_symbol}** has {direction} {abs(change_pct):.2f}% and last traded at {currency_fmt(latest_price)}.",
        f"The combined signal reading is **{trend_word}** ({signal}, score {score:+d}/100) based on RSI, MACD, and moving-average positioning.",
        f"Annualised volatility is {risk['annual_volatility_pct']}% ({risk['risk_label']} risk), with a maximum drawdown of {risk['max_drawdown_pct']}% over the loaded history.",
        f"The 7-day LSTM forecast points {week_direction}, to roughly {currency_fmt(forecast_7d[-1])} ({week_move_pct:+.2f}%).",
        "This summary is generated from rule-based indicators and a statistical model — it is not financial advice."
    ]
    return "\n\n".join(lines)
