import numpy as np
import pandas as pd

from utils.indicators import rsi as calc_rsi, sma


def fast_technical_score(df: pd.DataFrame) -> dict:
    close = df["Close"]
    if len(close) < 60:
        return {"score": 0, "rsi": 50.0, "momentum_10d": 0.0, "above_sma50": False}

    rsi_val = float(calc_rsi(close, 14).iloc[-1])
    sma50 = sma(close, 50).iloc[-1]
    momentum_10d = float((close.iloc[-1] / close.iloc[-11] - 1) * 100) if len(close) > 11 else 0.0
    above_sma50 = bool(close.iloc[-1] > sma50) if pd.notna(sma50) else False

    score = 0
    if 40 <= rsi_val <= 65:
        score += 20
    elif rsi_val < 30:
        score += 15
    elif rsi_val > 75:
        score -= 15  
    score += 20 if above_sma50 else -20
    score += max(-20, min(20, momentum_10d * 2))

    return {"score": round(score, 1), "rsi": round(rsi_val, 1),
            "momentum_10d": round(momentum_10d, 2), "above_sma50": above_sma50}


def rank_universe(history: dict) -> pd.DataFrame:
    rows = []
    for symbol, df in history.items():
        s = fast_technical_score(df)
        rows.append({"symbol": symbol, **s})
    df_out = pd.DataFrame(rows)
    return df_out.sort_values("score", ascending=False).reset_index(drop=True) if not df_out.empty else df_out


def sector_allocation(holdings: list, info_lookup: dict) -> pd.DataFrame:
    rows = []
    for h in holdings:
        info = info_lookup.get(h["yf_symbol"], {})
        sector = info.get("sector") or "Unknown / Index"
        rows.append({"sector": sector, "value": h.get("current_value", 0)})
    df = pd.DataFrame(rows)
    if df.empty:
        return df
    grouped = df.groupby("sector", as_index=False)["value"].sum()
    total = grouped["value"].sum()
    grouped["pct"] = (grouped["value"] / total * 100).round(1) if total else 0
    return grouped.sort_values("value", ascending=False)


def portfolio_health_score(sector_df: pd.DataFrame, num_holdings: int, avg_volatility_pct: float) -> dict:
    if sector_df.empty or num_holdings == 0:
        return {"score": 0, "label": "No holdings yet", "notes": []}

    notes = []
    num_sectors = len(sector_df)
    max_sector_pct = sector_df["pct"].max()

    diversification_score = min(40, num_sectors * 8)
    concentration_penalty = max(0, (max_sector_pct - 30) * 0.6)
    holdings_score = min(20, num_holdings * 4)
    volatility_penalty = max(0, (avg_volatility_pct - 25) * 0.5)

    score = diversification_score + holdings_score + 40 - concentration_penalty - volatility_penalty
    score = round(max(0, min(100, score)), 1)

    if num_sectors <= 2:
        notes.append(f"Only {num_sectors} sector(s) represented — concentrated across sectors.")
    if max_sector_pct > 50:
        notes.append(f"One sector makes up {max_sector_pct:.0f}% of the portfolio — high concentration risk.")
    if num_holdings < 5:
        notes.append(f"Only {num_holdings} holding(s) — limited diversification.")
    if avg_volatility_pct > 40:
        notes.append(f"Average holding volatility is {avg_volatility_pct:.0f}% (annualised) — a high-risk portfolio.")
    if not notes:
        notes.append("Reasonably diversified across sectors and holdings.")

    label = "Healthy" if score >= 70 else "Needs attention" if score >= 45 else "High risk / concentrated"
    return {"score": score, "label": label, "notes": notes}


def rebalancing_suggestion(sector_df: pd.DataFrame, target_pct: dict = None) -> list:
    if sector_df.empty:
        return []
    suggestions = []
    for _, row in sector_df.iterrows():
        target = target_pct.get(row["sector"], 25) if target_pct else 35
        if row["pct"] > target:
            suggestions.append(f"**{row['sector']}** is {row['pct']:.0f}% of the portfolio (above the {target}% guideline) — consider trimming.")
    if not suggestions:
        suggestions.append("No sector is over-concentrated relative to the guideline — no rebalancing flagged.")
    return suggestions
