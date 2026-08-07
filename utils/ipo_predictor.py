import asyncio
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional

import streamlit as st

try:
    from playwright.sync_api import sync_playwright
    _PLAYWRIGHT_AVAILABLE = True
except ImportError:
    _PLAYWRIGHT_AVAILABLE = False

# Browser-based fetch (same technique used for Option Chain)

def _run_with_proactor_policy(fn, *args):
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    return fn(*args)


def _fetch_via_browser(url: str, referer: str, timeout_ms: int = 30000) -> dict:
    if not _PLAYWRIGHT_AVAILABLE:
        raise RuntimeError(
            "Playwright isn't installed. Run:\n"
            "  pip install playwright\n"
            "  playwright install chromium\n"
            "then restart the app."
        )

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--disable-http2"])
        try:
            context = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/138.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1366, "height": 768},
            )
            page = context.new_page()
            page.goto(referer, wait_until="domcontentloaded", timeout=timeout_ms)
            page.wait_for_timeout(1500)

            result = page.evaluate(
                """
                async (url) => {
                    const res = await fetch(url, {
                        headers: { "Accept": "application/json,text/plain,*/*" }
                    });
                    return { status: res.status, body: await res.text() };
                }
                """,
                url,
            )
            return result
        finally:
            browser.close()


def _fetch_json(url: str, referer: str) -> Any:
    last_error = None
    for attempt in range(2):
        try:
            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(_run_with_proactor_policy, _fetch_via_browser, url, referer)
                result = future.result(timeout=25)
            status = result.get("status")
            body = result.get("body", "")

            if status == 200:
                try:
                    return json.loads(body)
                except Exception:
                    snippet = body[:200].replace("\n", " ")
                    last_error = RuntimeError(
                        f"NSE returned HTTP 200 but the body wasn't valid JSON. Body starts: {snippet!r}"
                    )
            else:
                snippet = body[:200].replace("\n", " ")
                last_error = RuntimeError(
                    f"NSE returned HTTP {status}. Response body starts: {snippet!r}"
                )
        except Exception as e:
            last_error = e

        time.sleep(1.5 * (attempt + 1))

    raise RuntimeError(f"Unable to fetch IPO data after 2 attempts.\n\nLast error: {last_error}")


# Fetch upcoming / active IPOs from NSE

@st.cache_data(ttl=900, show_spinner=False)
def fetch_upcoming_ipos() -> dict:
    sources = {
        "upcoming": (
            "https://www.nseindia.com/api/all-upcoming-issues?category=ipo",
            "https://www.nseindia.com/market-data/all-upcoming-issues-ipo",
        ),
    }

    records = []
    raw_by_source = {}
    errors = {}

    def _fetch_one(label, url, referer):
        try:
            data = _fetch_json(url, referer)
            return label, data, None
        except Exception as e:
            return label, None, str(e)

    # Fetch both sources at the same time instead of one after another
    with ThreadPoolExecutor(max_workers=len(sources)) as executor:
        futures = [
            executor.submit(_fetch_one, label, url, referer)
            for label, (url, referer) in sources.items()
        ]
        for future in futures:
            try:
                label, data, err = future.result(timeout=70)
            except Exception as e:
                continue

            if err:
                errors[label] = err
                raw_by_source[label] = f"(fetch failed: {err})"
                continue

            raw_by_source[label] = data

            found = None
            if isinstance(data, list):
                found = data
            elif isinstance(data, dict):
                for key in ("data", "list", "results"):
                    if key in data and isinstance(data[key], list):
                        found = data[key]
                        break

            if found:
                for item in found:
                    item = dict(item)
                    item["_source"] = label
                    records.append(item)

    return {"records": records, "raw": raw_by_source, "errors": errors}


def _first_present(d: dict, keys: List[str], default=None):
    for k in keys:
        if k in d and d[k] not in (None, ""):
            return d[k]
    return default


def normalize_ipo_record(raw: dict) -> dict:
    company = _first_present(raw, ["companyName", "symbol", "company", "name"])
    symbol = _first_present(raw, ["symbol", "series"])
    start = _first_present(raw, ["issueStartDate", "startDate", "biddingStartDate"])
    end = _first_present(raw, ["issueEndDate", "endDate", "biddingEndDate"])
    price_min = _first_present(raw, ["issuePriceMin", "minPrice", "priceRangeLow", "lowPrice"])
    price_max = _first_present(raw, ["issuePriceMax", "maxPrice", "priceRangeHigh", "highPrice"])
    issue_size = _first_present(raw, ["issueSize", "totalIssueSize", "amount"])
    lot_size = _first_present(raw, ["lotSize", "marketLot"])
    series = _first_present(raw, ["series", "board"])

    return {
        "company": company or "Unknown",
        "symbol": symbol,
        "start_date": start,
        "end_date": end,
        "price_min": price_min,
        "price_max": price_max,
        "issue_size": issue_size,
        "lot_size": lot_size,
        "series": series,
        "raw": raw,
    }

# AI Recommendation Engine (rule-based, transparent)

def ipo_ai_score(
    issue_size_cr: Optional[float] = None,
    price_band_high: Optional[float] = None,
    price_band_low: Optional[float] = None,
    lot_size: Optional[int] = None,
    overall_subscription_x: Optional[float] = None,
    qib_subscription_x: Optional[float] = None,
    gmp_percent: Optional[float] = None,
    sector_momentum: Optional[str] = None,
) -> dict:

    score = 0
    max_possible = 0
    reasons = []

    # Grey Market Premium (unofficial, but the single strongest signal)
    if gmp_percent is not None:
        max_possible += 3
        if gmp_percent >= 30:
            score += 3
            reasons.append(f"GMP is {gmp_percent:+.0f}% of the issue price — strong listing-gain expectation.")
        elif gmp_percent >= 10:
            score += 2
            reasons.append(f"GMP is {gmp_percent:+.0f}% — healthy positive listing expectation.")
        elif gmp_percent > 0:
            score += 1
            reasons.append(f"GMP is {gmp_percent:+.0f}% — mildly positive, but not a strong signal either way.")
        elif gmp_percent == 0:
            reasons.append("GMP is flat (0%) — market is pricing this at par, no edge either way.")
        else:
            score -= 2
            reasons.append(f"GMP is {gmp_percent:+.0f}% (negative) — grey market expects a discount on listing.")

    # Overall subscription
    if overall_subscription_x is not None:
        max_possible += 2
        if overall_subscription_x >= 50:
            score += 2
            reasons.append(f"Overall subscription {overall_subscription_x:.1f}x — very strong demand.")
        elif overall_subscription_x >= 10:
            score += 1
            reasons.append(f"Overall subscription {overall_subscription_x:.1f}x — strong demand.")
        elif overall_subscription_x >= 1:
            reasons.append(f"Overall subscription {overall_subscription_x:.1f}x — modest, fully covered demand.")
        else:
            score -= 2
            reasons.append(f"Overall subscription only {overall_subscription_x:.1f}x — issue is undersubscribed.")

    # QIB subscription (institutional appetite -- weighted more)
    if qib_subscription_x is not None:
        max_possible += 2
        if qib_subscription_x >= 20:
            score += 2
            reasons.append(f"QIB (institutional) subscription {qib_subscription_x:.1f}x — big institutions are keen.")
        elif qib_subscription_x >= 3:
            score += 1
            reasons.append(f"QIB subscription {qib_subscription_x:.1f}x — reasonable institutional interest.")
        elif qib_subscription_x > 0:
            reasons.append(f"QIB subscription only {qib_subscription_x:.1f}x — muted institutional interest.")
        else:
            score -= 1
            reasons.append("No meaningful QIB subscription reported.")

    # Issue size (smaller issues have historically shown bigger pops, but are riskier)
    if issue_size_cr is not None:
        max_possible += 1
        if issue_size_cr < 300:
            score += 1
            reasons.append(f"Small issue size (₹{issue_size_cr:.0f} Cr) — more room for a listing-day pop, but also more volatile.")
        elif issue_size_cr > 3000:
            reasons.append(f"Large issue size (₹{issue_size_cr:.0f} Cr) — typically calmer listing, less explosive but more stable.")
        else:
            reasons.append(f"Mid-sized issue (₹{issue_size_cr:.0f} Cr) — no strong size-based bias.")

    # Sector momentum (soft factor)
    if sector_momentum:
        max_possible += 1
        if sector_momentum == "Hot":
            score += 1
            reasons.append("Sector is currently in favour with the market — a tailwind for listing demand.")
        elif sector_momentum == "Weak":
            score -= 1
            reasons.append("Sector is currently out of favour — a headwind for listing demand.")
        else:
            reasons.append("Sector sentiment is neutral — no strong pull either way.")

    if max_possible == 0:
        return {
            "recommendation": "INSUFFICIENT DATA",
            "confidence": 0,
            "score": 0,
            "reasons": ["No inputs were provided — add at least GMP, subscription numbers, or issue size for a reading."],
        }

    # Normalize score into a 0-100 confidence-ish scale
    normalized = score / max_possible

    if normalized >= 0.5:
        recommendation = "APPLY"
    elif normalized >= 0.15:
        recommendation = "APPLY (Cautiously)"
    elif normalized > -0.15:
        recommendation = "NEUTRAL"
    elif normalized > -0.5:
        recommendation = "AVOID (Risky)"
    else:
        recommendation = "AVOID"

    confidence = min(95, max(30, round(55 + normalized * 40)))

    return {
        "recommendation": recommendation,
        "confidence": confidence,
        "score": score,
        "reasons": reasons,
    }
