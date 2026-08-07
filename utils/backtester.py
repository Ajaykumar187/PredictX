import numpy as np
import pandas as pd

from utils.indicators import sma, rsi as calc_rsi


def _run_signals(df: pd.DataFrame, in_position: pd.Series, initial_capital: float = 100000.0):
    close = df["Close"]
    cash = initial_capital
    shares = 0
    equity_curve = []
    trades = []
    entry_price = None
    entry_date = None

    for date, price, want_long in zip(df.index, close, in_position):
        if want_long and shares == 0:
            shares = cash / price
            cash = 0
            entry_price, entry_date = price, date
        elif not want_long and shares > 0:
            cash = shares * price
            pnl_pct = (price / entry_price - 1) * 100
            trades.append({"entry_date": entry_date, "exit_date": date,
                            "entry_price": round(entry_price, 2), "exit_price": round(price, 2),
                            "return_pct": round(pnl_pct, 2)})
            shares = 0
            entry_price = None
        equity_curve.append(cash + shares * price)

    if shares > 0:
        final_price = close.iloc[-1]
        pnl_pct = (final_price / entry_price - 1) * 100
        trades.append({"entry_date": entry_date, "exit_date": df.index[-1],
                        "entry_price": round(entry_price, 2), "exit_price": round(final_price, 2),
                        "return_pct": round(pnl_pct, 2), "note": "open at end of backtest"})

    equity = pd.Series(equity_curve, index=df.index)
    return equity, trades


def _summarize(equity: pd.Series, trades: list, initial_capital: float):
    total_return_pct = (equity.iloc[-1] / initial_capital - 1) * 100 if len(equity) else 0.0
    running_max = equity.cummax()
    drawdown = (equity / running_max - 1) * 100
    max_drawdown = drawdown.min() if len(drawdown) else 0.0
    wins = [t for t in trades if t["return_pct"] > 0]
    win_rate = (len(wins) / len(trades) * 100) if trades else 0.0
    return {
        "final_equity": round(equity.iloc[-1], 2) if len(equity) else initial_capital,
        "total_return_pct": round(total_return_pct, 2),
        "max_drawdown_pct": round(max_drawdown, 2),
        "num_trades": len(trades), "win_rate_pct": round(win_rate, 1)
    }


def backtest_sma_crossover(df: pd.DataFrame, fast: int = 20, slow: int = 50, initial_capital: float = 100000.0):
    fast_sma = sma(df["Close"], fast)
    slow_sma = sma(df["Close"], slow)
    in_position = (fast_sma > slow_sma).fillna(False)
    equity, trades = _run_signals(df, in_position, initial_capital)
    summary = _summarize(equity, trades, initial_capital)
    return equity, trades, summary


def backtest_rsi_strategy(df: pd.DataFrame, window: int = 14, oversold: float = 30,
                           overbought: float = 70, initial_capital: float = 100000.0):
    rsi_series = calc_rsi(df["Close"], window)
    in_position = pd.Series(False, index=df.index)
    holding = False
    for i in range(len(df)):
        if not holding and rsi_series.iloc[i] < oversold:
            holding = True
        elif holding and rsi_series.iloc[i] > overbought:
            holding = False
        in_position.iloc[i] = holding
    equity, trades = _run_signals(df, in_position, initial_capital)
    summary = _summarize(equity, trades, initial_capital)
    return equity, trades, summary
