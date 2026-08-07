import os
import pathlib
import requests
import pandas as pd
from functools import lru_cache

MASTER_URL = "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json"
CACHE_FILE = str(pathlib.Path(__file__).resolve().parent.parent / "data" / "OpenAPIScripMaster.json")


@lru_cache(maxsize=1)
def load_master():
    os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)

    if os.path.exists(CACHE_FILE):
        print("Loading Instrument Master from cache...")
        df = pd.read_json(CACHE_FILE)
    else:
        print("Downloading Instrument Master...")

        response = requests.get(MASTER_URL, timeout=120)
        response.raise_for_status()

        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            f.write(response.text)

        df = pd.read_json(CACHE_FILE)

    if "strike" in df.columns:
        df["strike"] = pd.to_numeric(df["strike"], errors="coerce")

    return df


def get_equity(symbol):
    df = load_master()

    symbol = symbol.upper()

    result = df[
        (df["exch_seg"] == "NSE") &
        (df["name"].astype(str).str.upper() == symbol)
    ]

    if result.empty:
        result = df[
            (df["exch_seg"] == "NSE") &
            (df["symbol"].astype(str).str.upper().str.contains(symbol))
        ]

    if result.empty:
        return None

    row = result.iloc[0]

    return {
        "token": str(row["token"]),
        "symbol": row["symbol"],
        "name": row["name"],
        "exchange": row["exch_seg"]
    }


def get_option_contracts(index="NIFTY"):
    df = load_master()

    result = df[
        (df["instrumenttype"] == "OPTIDX") &
        (df["name"].astype(str).str.upper() == index.upper())
    ].copy()

    if not result.empty:
        result.sort_values(["expiry", "strike"], inplace=True)

    return result


def get_expiries(index="NIFTY"):
    df = get_option_contracts(index)

    if df.empty:
        return []

    return sorted(df["expiry"].dropna().unique())


def get_chain(index="NIFTY", expiry=None):
    df = get_option_contracts(index)

    if expiry:
        df = df[df["expiry"] == expiry]

    return df.reset_index(drop=True)

def get_index(index):
    df = load_master()

    index = index.upper()

    result = df[
        (df["instrumenttype"] == "AMXIDX")
        &
        (df["name"].str.upper() == index)
    ]

    if result.empty:

        result = df[
            (df["symbol"].str.upper().str.contains(index))
        ]

    if result.empty:
        return None

    row = result.iloc[0]

    return {
        "token": str(row["token"]),
        "symbol": row["symbol"],
        "exchange": row["exch_seg"]
    }