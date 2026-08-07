import pandas as pd


class OptionAnalyzer:

    @staticmethod
    def merge_chain(df):

        ce = df[df["OptionType"] == "CE"].copy()
        pe = df[df["OptionType"] == "PE"].copy()

        ce = ce.rename(columns={
            "LTP": "CE_LTP",
            "symbol": "CE_Symbol",
            "token": "CE_Token"
        })

        pe = pe.rename(columns={
            "LTP": "PE_LTP",
            "symbol": "PE_Symbol",
            "token": "PE_Token"
        })

        chain = ce.merge(
            pe,
            on="Strike",
            how="inner"
        )

        return chain[
            [
                "Strike",
                "CE_LTP",
                "PE_LTP",
                "CE_Symbol",
                "PE_Symbol"
            ]
        ].sort_values("Strike")

    @staticmethod
    def find_atm(chain, spot_price):

        idx = (chain["Strike"] - spot_price).abs().idxmin()

        return chain.loc[idx, "Strike"]

    @staticmethod
    def add_distance(chain, atm):

        chain["Distance"] = chain["Strike"] - atm

        return chain