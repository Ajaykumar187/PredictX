def _indian_grouping(value: float) -> str:
    sign = "-" if value < 0 else ""
    value = abs(value)
    s = f"{value:,.2f}"
    integer, decimal = s.split(".")
    integer = integer.replace(",", "")
    if len(integer) > 3:
        head = integer[:-3]
        tail = integer[-3:]
        head_rev = head[::-1]
        grouped = ",".join([head_rev[i:i + 2] for i in range(0, len(head_rev), 2)])
        integer = grouped[::-1] + "," + tail
    return f"{sign}{integer}.{decimal}"


def format_inr(value: float) -> str:
    if value is None:
        return "₹0.00"
    return f"₹{_indian_grouping(value)}"


def format_usd(value: float) -> str:
    if value is None:
        return "$0.00"
    sign = "-" if value < 0 else ""
    return f"{sign}${abs(value):,.2f}"


def format_index_points(value: float) -> str:
    if value is None:
        return "0.00 pts"
    return f"{_indian_grouping(value)} pts"


def format_currency(value: float, market: str) -> str:
    if market == "US":
        return format_usd(value)
    if market == "INDEX":
        return format_index_points(value)
    return format_inr(value)


INDEX_MAP = {
    "NIFTY 50": "^NSEI",
    "NIFTY50": "^NSEI",
    "NIFTY": "^NSEI",
    "BANK NIFTY": "^NSEBANK",
    "BANKNIFTY": "^NSEBANK",
    "FIN NIFTY": "^CNXFIN",
    "FINNIFTY": "^CNXFIN",
    "SENSEX": "^BSESN",
    "MIDCAP NIFTY": "^NSEMDCP50",
}
INDEX_DISPLAY_NAMES = ["NIFTY 50", "BANK NIFTY", "FIN NIFTY", "SENSEX", "MIDCAP NIFTY"]

NSE_OPTION_INDEX_CODES = {
    "NIFTY 50": "NIFTY", "NIFTY50": "NIFTY", "NIFTY": "NIFTY",
    "BANK NIFTY": "BANKNIFTY", "BANKNIFTY": "BANKNIFTY",
    "FIN NIFTY": "FINNIFTY", "FINNIFTY": "FINNIFTY",
    "MIDCAP NIFTY": "MIDCPNIFTY",
}


def format_large_number(value):
    if value is None:
        return "N/A"
    try:
        value = float(value)
    except (TypeError, ValueError):
        return "N/A"
    abs_v = abs(value)
    if abs_v >= 1e12:
        return f"{value / 1e12:.2f}T"
    if abs_v >= 1e9:
        return f"{value / 1e9:.2f}B"
    if abs_v >= 1e7:
        return f"{value / 1e7:.2f} Cr"
    if abs_v >= 1e5:
        return f"{value / 1e5:.2f} L"
    if abs_v >= 1e3:
        return f"{value / 1e3:.2f}K"
    return f"{value:.2f}"


def detect_market(symbol: str, market: str) -> str:
    symbol = symbol.upper().strip()
    if market == "INDEX":
        return INDEX_MAP.get(symbol, symbol if symbol.startswith("^") else f"^{symbol}")
    if market == "NSE" and not symbol.endswith(".NS"):
        return symbol + ".NS"
    if market == "BSE" and not symbol.endswith(".BO"):
        return symbol + ".BO"
    return symbol


def strip_suffix(symbol: str) -> str:
    if symbol in ("^NSEI",):
        return "NIFTY 50"
    if symbol in ("^NSEBANK",):
        return "BANK NIFTY"
    if symbol in ("^CNXFIN",):
        return "FIN NIFTY"
    if symbol in ("^BSESN",):
        return "SENSEX"
    if symbol in ("^NSEMDCP50",):
        return "MIDCAP NIFTY"
    return symbol.replace(".NS", "").replace(".BO", "")
