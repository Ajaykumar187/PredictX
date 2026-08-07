import pandas as pd

from utils.symbol_lookup import get_chain
from utils.market_data import MarketData


class OptionChain:

    def __init__(self):
        self.market = MarketData()

    def available_expiries(self, index="NIFTY"):
        df = get_chain(index)

        if df.empty:
            return []

        return sorted(df["expiry"].dropna().unique())

    def get_contracts(self, index="NIFTY", expiry=None):

        df = get_chain(index, expiry)

        if df.empty:
            return pd.DataFrame()

        df = df.copy()

        df["Strike"] = df["strike"] / 100

        df["OptionType"] = df["symbol"].apply(
            lambda x: "CE" if x.endswith("CE") else "PE"
        )

        return df[
            [
                "Strike",
                "OptionType",
                "symbol",
                "token",
                "expiry",
                "lotsize",
                "exch_seg"
            ]
        ].sort_values(
            ["Strike", "OptionType"]
        )

    def get_ltp(self, symbol, token, exchange):

        data = self.market.client.ltpData(
            exchange=exchange,
            tradingsymbol=symbol,
            symboltoken=str(token)
        )

        if not data["status"]:
            return None

        return data["data"]["ltp"]

    def get_live_chain(self, index="NIFTY", expiry=None, limit=20):

        df = self.get_contracts(index, expiry)

        if df.empty:
            return df

        strikes = sorted(df["Strike"].unique())

        if len(strikes) > limit:
            center = len(strikes) // 2
            half = limit // 2
            selected = strikes[max(0, center-half):center+half]
            df = df[df["Strike"].isin(selected)]

        prices = []

        for _, row in df.iterrows():

            try:

                ltp = self.get_ltp(
                    row["symbol"],
                    row["token"],
                    row["exch_seg"]
                )

            except Exception:

                ltp = None

            prices.append(ltp)

        df["LTP"] = prices

        return df.reset_index(drop=True)