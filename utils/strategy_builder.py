import numpy as np

from utils.payoff import OptionPayoff


class StrategyBuilder:

    def __init__(self, spot):
        self.spot = spot
        self.prices = OptionPayoff.price_range(spot)
        self.legs = []

    def add_leg(
        self,
        option_type,
        position,
        strike,
        premium,
        quantity=1
    ):

        self.legs.append({
            "option_type": option_type.lower(),
            "position": position.lower(),
            "strike": strike,
            "premium": premium,
            "quantity": quantity
        })

    def calculate(self):

        total = np.zeros_like(self.prices)

        for leg in self.legs:

            if leg["option_type"] == "call":

                if leg["position"] == "long":

                    pnl = OptionPayoff.long_call(
                        leg["strike"],
                        leg["premium"],
                        self.prices
                    )

                else:

                    pnl = OptionPayoff.short_call(
                        leg["strike"],
                        leg["premium"],
                        self.prices
                    )

            else:

                if leg["position"] == "long":

                    pnl = OptionPayoff.long_put(
                        leg["strike"],
                        leg["premium"],
                        self.prices
                    )

                else:

                    pnl = OptionPayoff.short_put(
                        leg["strike"],
                        leg["premium"],
                        self.prices
                    )

            total += pnl * leg["quantity"]

        return self.prices, total

    def summary(self):

        prices, pnl = self.calculate()

        return {
            "Max Profit": round(np.max(pnl), 2),
            "Max Loss": round(np.min(pnl), 2),
            "Breakeven Approx": round(
                prices[np.argmin(np.abs(pnl))], 2
            )
        }