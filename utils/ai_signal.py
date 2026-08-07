class AISignalEngine:

    def __init__(
        self,
        spot,
        strike,
        call_delta,
        put_delta,
        iv,
        rsi,
        ema_fast,
        ema_slow
    ):

        self.spot = spot
        self.strike = strike
        self.call_delta = call_delta
        self.put_delta = put_delta
        self.iv = iv
        self.rsi = rsi
        self.ema_fast = ema_fast
        self.ema_slow = ema_slow

    def generate(self):

        score = 0
        reasons = []

        if self.ema_fast > self.ema_slow:
            score += 25
            reasons.append("Bullish EMA Crossover")
        else:
            score -= 25
            reasons.append("Bearish EMA Crossover")

        if 55 <= self.rsi <= 70:
            score += 20
            reasons.append("Healthy RSI")
        elif self.rsi > 70:
            score -= 10
            reasons.append("Overbought")
        elif self.rsi < 30:
            score += 10
            reasons.append("Oversold")

        if self.iv < 20:
            score += 20
            reasons.append("Low IV")
        elif self.iv > 35:
            score -= 20
            reasons.append("High IV")

        if self.call_delta > 0.50:
            score += 15
            reasons.append("Strong Call Delta")

        if abs(self.spot - self.strike) <= 100:
            score += 10
            reasons.append("ATM Option")

        if score >= 60:
            signal = "BUY CALL"
            risk = "Medium"

        elif score >= 30:
            signal = "WATCH"

            risk = "Low"

        else:
            signal = "NO TRADE"

            risk = "High"

        confidence = max(0, min(score, 100))

        return {

            "Signal": signal,
            "Confidence": confidence,
            "Risk": risk,
            "Reasons": reasons

        }