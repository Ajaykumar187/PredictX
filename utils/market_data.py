import streamlit as st

from utils.angel_api import AngelAPI
from utils.symbol_lookup import get_equity, get_index


@st.cache_resource(show_spinner=False)
def get_angel_client():
    api = AngelAPI()
    return api.login()


class MarketData:
    def __init__(self, client=None):
        self.client = client or get_angel_client()

    def get_ltp(self, symbol):
        info = get_equity(symbol)

        if info is None:
            raise Exception(f"Symbol '{symbol}' not found")

        response = self.client.ltpData(
            exchange=info["exchange"],
            tradingsymbol=info["symbol"],
            symboltoken=info["token"]
        )

        if not response.get("status"):
            raise Exception(response.get("message"))

        return response["data"]

    def get_last_price(self, symbol):
        return self.get_ltp(symbol)["ltp"]

    def get_index_price(self, index):
        info = get_index(index)

        if info is None:
            raise Exception(f"{index} not found")

        response = self.client.ltpData(
            exchange=info["exchange"],
            tradingsymbol=info["symbol"],
            symboltoken=info["token"]
        )

        if response.get("status"):
            return float(response["data"]["ltp"])

        raise Exception(response.get("message", "Unable to fetch LTP"))
