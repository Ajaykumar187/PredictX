NSE_UNIVERSE = [
    "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS",
    "HINDUNILVR.NS", "SBIN.NS", "BHARTIARTL.NS", "ITC.NS", "KOTAKBANK.NS",
    "LT.NS", "AXISBANK.NS", "BAJFINANCE.NS", "MARUTI.NS", "ASIANPAINT.NS",
    "SUNPHARMA.NS", "TITAN.NS", "WIPRO.NS", "ADANIENT.NS", "TATAMOTORS.NS"
]

US_UNIVERSE = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "JPM",
    "V", "UNH", "JNJ", "WMT", "PG", "HD", "DIS", "NFLX", "AMD", "INTC"
]

SECTOR_ETFS_US = {
    "Technology": "XLK", "Financials": "XLF", "Energy": "XLE",
    "Healthcare": "XLV", "Consumer Discretionary": "XLY", "Utilities": "XLU",
    "Industrials": "XLI", "Materials": "XLB", "Real Estate": "XLRE"
}

SECTOR_GROUPS_NSE = {
    "IT": ["TCS.NS", "INFY.NS", "WIPRO.NS"],
    "Banking": ["HDFCBANK.NS", "ICICIBANK.NS", "SBIN.NS", "KOTAKBANK.NS", "AXISBANK.NS"],
    "Energy": ["RELIANCE.NS", "ADANIENT.NS"],
    "Auto": ["MARUTI.NS", "TATAMOTORS.NS"],
    "FMCG": ["HINDUNILVR.NS", "ITC.NS"],
    "Pharma": ["SUNPHARMA.NS"]
}


def universe_for_market(market: str):
    return NSE_UNIVERSE if market in ("NSE", "BSE") else US_UNIVERSE


def sector_groups_for_market(market: str):
    return SECTOR_GROUPS_NSE if market in ("NSE", "BSE") else SECTOR_ETFS_US
