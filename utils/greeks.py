import math
from scipy.stats import norm


class BlackScholes:

    def __init__(
        self,
        spot,
        strike,
        time_to_expiry,
        risk_free_rate,
        volatility
    ):
        
        self.S = float(spot)
        self.K = float(strike)
        self.T = float(time_to_expiry)
        self.r = float(risk_free_rate)
        self.sigma = float(volatility)

        self.d1 = (
            math.log(self.S / self.K)
            + (
                self.r
                + 0.5 * self.sigma**2
            ) * self.T
        ) / (
            self.sigma * math.sqrt(self.T)
        )

        self.d2 = (
            self.d1
            - self.sigma * math.sqrt(self.T)
        )

    # OPTION PRICE

    def call_price(self):

        return (
            self.S * norm.cdf(self.d1)
            - self.K
            * math.exp(-self.r * self.T)
            * norm.cdf(self.d2)
        )

    def put_price(self):

        return (
            self.K
            * math.exp(-self.r * self.T)
            * norm.cdf(-self.d2)
            - self.S * norm.cdf(-self.d1)
        )

    # DELTA

    def call_delta(self):
        return norm.cdf(self.d1)

    def put_delta(self):
        return norm.cdf(self.d1) - 1

    # GAMMA

    def gamma(self):

        return (
            norm.pdf(self.d1)
            /
            (
                self.S
                * self.sigma
                * math.sqrt(self.T)
            )
        )

    # VEGA

    def vega(self):

        return (
            self.S
            * norm.pdf(self.d1)
            * math.sqrt(self.T)
            / 100
        )

    # THETA

    def call_theta(self):

        first = (
            -self.S
            * norm.pdf(self.d1)
            * self.sigma
            /
            (
                2
                * math.sqrt(self.T)
            )
        )

        second = (
            self.r
            * self.K
            * math.exp(-self.r * self.T)
            * norm.cdf(self.d2)
        )

        return (first - second) / 365

    def put_theta(self):

        first = (
            -self.S
            * norm.pdf(self.d1)
            * self.sigma
            /
            (
                2
                * math.sqrt(self.T)
            )
        )

        second = (
            self.r
            * self.K
            * math.exp(-self.r * self.T)
            * norm.cdf(-self.d2)
        )

        return (first + second) / 365

    # RHO

    def call_rho(self):

        return (
            self.K
            * self.T
            * math.exp(-self.r * self.T)
            * norm.cdf(self.d2)
            / 100
        )

    def put_rho(self):

        return (
            -self.K
            * self.T
            * math.exp(-self.r * self.T)
            * norm.cdf(-self.d2)
            / 100
        )

    # SUMMARY

    def summary(self):

        return {

            "Call Price": round(self.call_price(), 2),
            "Put Price": round(self.put_price(), 2),

            "Call Delta": round(self.call_delta(), 4),
            "Put Delta": round(self.put_delta(), 4),

            "Gamma": round(self.gamma(), 6),

            "Vega": round(self.vega(), 4),

            "Call Theta": round(self.call_theta(), 4),
            "Put Theta": round(self.put_theta(), 4),

            "Call Rho": round(self.call_rho(), 4),
            "Put Rho": round(self.put_rho(), 4)

        }