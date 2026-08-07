import math
from scipy.stats import norm


class ImpliedVolatility:

    @staticmethod
    def _d1(S, K, T, r, sigma):
        return (
            math.log(S / K)
            + (r + 0.5 * sigma ** 2) * T
        ) / (sigma * math.sqrt(T))

    @staticmethod
    def _d2(d1, sigma, T):
        return d1 - sigma * math.sqrt(T)

    @staticmethod
    def _call_price(S, K, T, r, sigma):
        d1 = ImpliedVolatility._d1(S, K, T, r, sigma)
        d2 = ImpliedVolatility._d2(d1, sigma, T)

        return (
            S * norm.cdf(d1)
            - K * math.exp(-r * T) * norm.cdf(d2)
        )

    @staticmethod
    def _put_price(S, K, T, r, sigma):
        d1 = ImpliedVolatility._d1(S, K, T, r, sigma)
        d2 = ImpliedVolatility._d2(d1, sigma, T)

        return (
            K * math.exp(-r * T) * norm.cdf(-d2)
            - S * norm.cdf(-d1)
        )

    @staticmethod
    def _vega(S, K, T, r, sigma):
        d1 = ImpliedVolatility._d1(S, K, T, r, sigma)

        return (
            S
            * norm.pdf(d1)
            * math.sqrt(T)
        )

    @staticmethod
    def calculate(
        market_price,
        S,
        K,
        T,
        r,
        option_type="call",
        tolerance=1e-5,
        max_iterations=100
    ):

        sigma = 0.20

        for _ in range(max_iterations):

            if option_type.lower() == "call":
                price = ImpliedVolatility._call_price(
                    S, K, T, r, sigma
                )
            else:
                price = ImpliedVolatility._put_price(
                    S, K, T, r, sigma
                )

            diff = price - market_price

            if abs(diff) < tolerance:
                return round(sigma * 100, 2)

            vega = ImpliedVolatility._vega(
                S, K, T, r, sigma
            )

            if abs(vega) < 1e-8:
                break

            sigma = sigma - diff / vega

            if sigma <= 0:
                sigma = 0.01

        return None