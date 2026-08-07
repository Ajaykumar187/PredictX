from utils.market_data import MarketData
from utils.greeks import BlackScholes
from utils.implied_volatility import ImpliedVolatility
from utils.ai_signal import AISignalEngine

class OptionAnalyzerService:

    def __init__(self, client):
        self.market = MarketData(client)

    def analyze(
        self,
        symbol,
        strike,
        option_price,
        option_type,
        days_to_expiry,
        rsi,
        ema_fast,
        ema_slow,
        risk_free_rate=0.06
    ):

        spot = self.market.get_last_price(symbol)

        iv = ImpliedVolatility.calculate(
            market_price=option_price,
            S=spot,
            K=strike,
            T=days_to_expiry / 365,
            r=risk_free_rate,
            option_type=option_type
        )

        if iv is None:
            iv = 20.0

        bs = BlackScholes(
            spot=spot,
            strike=strike,
            time_to_expiry=days_to_expiry / 365,
            risk_free_rate=risk_free_rate,
            volatility=iv / 100
        )

        greeks = bs.summary()

        ai = AISignalEngine(
            spot=spot,
            strike=strike,
            call_delta=greeks["Call Delta"],
            put_delta=greeks["Put Delta"],
            iv=iv,
            rsi=rsi,
            ema_fast=ema_fast,
            ema_slow=ema_slow
        ).generate()

        return {
            "spot": spot,
            "iv": iv,
            "greeks": greeks,
            "ai": ai
        }