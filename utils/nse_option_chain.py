import requests
import pandas as pd


class NSEOptionChain:

    BASE = "https://www.nseindia.com"

    HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/138.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json,text/plain,*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.nseindia.com/option-chain"
    }

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(self.HEADERS)

        # Get cookies
        self.session.get(
            "https://www.nseindia.com/option-chain",
            timeout=20
        )

    def fetch(self, symbol="BANKNIFTY"):

        url = (
            f"https://www.nseindia.com/api/"
            f"option-chain-indices?symbol={symbol}"
        )

        r = self.session.get(url, timeout=20)

        r.raise_for_status()

        return r.json()

    def get_expiries(self, symbol="BANKNIFTY"):

        data = self.fetch(symbol)

        return data["records"]["expiryDates"]

    def get_spot(self, symbol="BANKNIFTY"):

        data = self.fetch(symbol)

        return data["records"]["underlyingValue"]

    def get_chain(self,
                  symbol="BANKNIFTY",
                  expiry=None):

        data = self.fetch(symbol)

        rows = []

        for item in data["records"]["data"]:

            if expiry:

                if item["expiryDate"] != expiry:
                    continue

            ce = item.get("CE", {})
            pe = item.get("PE", {})

            rows.append({

                "Strike": item["strikePrice"],

                "CE_OI": ce.get("openInterest"),
                "CE_ChgOI": ce.get("changeinOpenInterest"),
                "CE_Volume": ce.get("totalTradedVolume"),
                "CE_IV": ce.get("impliedVolatility"),
                "CE_LTP": ce.get("lastPrice"),

                "PE_LTP": pe.get("lastPrice"),
                "PE_IV": pe.get("impliedVolatility"),
                "PE_Volume": pe.get("totalTradedVolume"),
                "PE_ChgOI": pe.get("changeinOpenInterest"),
                "PE_OI": pe.get("openInterest"),

            })

        return pd.DataFrame(rows).sort_values("Strike")