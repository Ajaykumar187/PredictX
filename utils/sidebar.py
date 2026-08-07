import streamlit as st

from utils.market import detect_market, INDEX_DISPLAY_NAMES
from utils.styling import theme_toggle_sidebar

MARKETS = ["NSE", "BSE", "US", "Index"]


def stock_selector_sidebar():
    st.sidebar.header("Stock Controls")

    market_choice = st.sidebar.radio(
        "Select Market", MARKETS,
        index=MARKETS.index(st.session_state.get("market_choice", "NSE")),
        key="market_radio"
    )
    st.session_state.market_choice = market_choice

    if market_choice == "Index":
        default_index = st.session_state.get("symbol_input", "NIFTY 50")
        if default_index not in INDEX_DISPLAY_NAMES:
            default_index = "NIFTY 50"
        symbol_input = st.sidebar.selectbox(
            "Select Index", INDEX_DISPLAY_NAMES,
            index=INDEX_DISPLAY_NAMES.index(default_index), key="index_select"
        )
        market = "INDEX"
    else:
        market = market_choice
        default_symbol = st.session_state.get("symbol_input", "RELIANCE" if market != "US" else "AAPL")
        if default_symbol in INDEX_DISPLAY_NAMES:
            default_symbol = "RELIANCE" if market != "US" else "AAPL"
        symbol_input = st.sidebar.text_input("Enter Stock Symbol", value=default_symbol, key="symbol_text")

    load_clicked = st.sidebar.button("Load / Refresh Stock", key="load_btn")

    st.session_state.market = market
    st.session_state.symbol_input = symbol_input
    yf_symbol = detect_market(symbol_input, market)
    st.session_state.yf_symbol = yf_symbol

    if load_clicked:
        st.session_state.stock_loaded = True

    theme_toggle_sidebar()

    return market, symbol_input, yf_symbol, load_clicked
