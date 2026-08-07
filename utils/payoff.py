import numpy as np


class OptionPayoff:

    @staticmethod
    def price_range(spot, percentage=20, points=300):
        """
        Generate expiry price range.
        """
        low = spot * (1 - percentage / 100)
        high = spot * (1 + percentage / 100)

        return np.linspace(low, high, points)

    @staticmethod
    def long_call(strike, premium, prices):
        return np.maximum(prices - strike, 0) - premium

    @staticmethod
    def long_put(strike, premium, prices):
        return np.maximum(strike - prices, 0) - premium

    @staticmethod
    def short_call(strike, premium, prices):
        return premium - np.maximum(prices - strike, 0)

    @staticmethod
    def short_put(strike, premium, prices):
        return premium - np.maximum(strike - prices, 0)