import streamlit as st

from utils.styling import inject_css, navbar, loading
from utils.sidebar import stock_selector_sidebar
from utils.pipeline import run_analysis
from utils.market import format_large_number
from utils.data_fetch import get_calendar, get_dividends_and_splits, get_history, get_company_logo
from utils.screener_universe import sector_groups_for_market

st.set_page_config(page_title="Company Info", layout="wide", initial_sidebar_state="expanded")

market, symbol_input, yf_symbol, load_clicked = stock_selector_sidebar()

inject_css()
navbar("Company Information", "Profile, sector, leadership, and key ratios")

with loading(f"Loading company profile for {yf_symbol}..."):
    result = run_analysis(yf_symbol, market, force=load_clicked)

if result is None:
    st.info("Load a stock from the sidebar to see company information.")
    st.stop()

info = result["info"]
currency_fmt = result["currency_fmt"]

company_name = info.get("longName", result["symbol"])

col_logo, col_head = st.columns([1, 4])
with col_logo:
    logo_bytes = get_company_logo(info.get("website"))
    if logo_bytes:
        st.image(logo_bytes, width=90)
    else:
        initial = (company_name or "?").strip()[0].upper()
        st.markdown(
            f"""<div style="width:72px;height:72px;border-radius:50%;
            background:linear-gradient(135deg,#0a2540,#163f73);
            display:flex;align-items:center;justify-content:center;
            font-size:32px;font-weight:800;color:white;">{initial}</div>""",
            unsafe_allow_html=True,
        )
with col_head:
    st.markdown(f"## {company_name}")
    st.caption(f"{info.get('sector', 'N/A')} · {info.get('industry', 'N/A')} · {info.get('country', 'N/A')}")
    if info.get("website"):
        st.write(f"[{info['website']}]({info['website']})")

st.markdown("### Company Profile")
st.write(info.get("longBusinessSummary", "No profile summary available for this symbol."))

officers = info.get("companyOfficers", [])
ceo = next((o.get("name") for o in officers if o.get("title") and "CEO" in o.get("title", "")), None)
if not ceo and officers:
    ceo = officers[0].get("name")

st.markdown("### Leadership")
st.write(f"**CEO / Top executive:** {ceo or 'Not available from this data source.'}")

st.markdown("### Key Ratios")
r1, r2, r3, r4 = st.columns(4)
r1.metric("Market Cap", format_large_number(info.get("marketCap")))
r2.metric("PE Ratio (TTM)", f"{info.get('trailingPE'):.2f}" if info.get("trailingPE") else "N/A")
r3.metric("EPS (TTM)", f"{info.get('trailingEps'):.2f}" if info.get("trailingEps") else "N/A")
dy = info.get("dividendYield")
r4.metric("Dividend Yield", f"{dy * 100:.2f}%" if dy else "N/A")

r5, r6, r7, r8 = st.columns(4)
hi = info.get("fiftyTwoWeekHigh")
lo = info.get("fiftyTwoWeekLow")
r5.metric("52-Week High", currency_fmt(hi) if hi else "N/A")
r6.metric("52-Week Low", currency_fmt(lo) if lo else "N/A")
r7.metric("Beta", f"{info.get('beta'):.2f}" if info.get("beta") else "N/A")
r8.metric("Employees", format_large_number(info.get("fullTimeEmployees")) if info.get("fullTimeEmployees") else "N/A")

st.markdown("### Additional Details")
d1, d2, d3, d4 = st.columns(4)
d1.metric("Open", currency_fmt(info.get("open")) if info.get("open") else "N/A")
d2.metric("Previous Close", currency_fmt(info.get("previousClose")) if info.get("previousClose") else "N/A")
day_low = info.get("dayLow")
day_high = info.get("dayHigh")
d3.metric("Day Range", f"{currency_fmt(day_low)} - {currency_fmt(day_high)}" if day_low and day_high else "N/A")
d4.metric("Volume", format_large_number(info.get("volume")) if info.get("volume") else "N/A")

d5, d6, d7, d8 = st.columns(4)
d5.metric("Avg Volume", format_large_number(info.get("averageVolume")) if info.get("averageVolume") else "N/A")
d6.metric("Shares Outstanding", format_large_number(info.get("sharesOutstanding")) if info.get("sharesOutstanding") else "N/A")
pm = info.get("profitMargins")
d7.metric("Profit Margin", f"{pm * 100:.2f}%" if pm else "N/A")
om = info.get("operatingMargins")
d8.metric("Operating Margin", f"{om * 100:.2f}%" if om else "N/A")

d9, d10, d11, d12 = st.columns(4)
d9.metric("Book Value", currency_fmt(info.get("bookValue")) if info.get("bookValue") else "N/A")
d10.metric("Price/Book", f"{info.get('priceToBook'):.2f}" if info.get("priceToBook") else "N/A")
d11.metric("Exchange", info.get("exchange", "N/A"))
d12.metric("Currency", info.get("currency", "N/A"))

st.markdown("### Corporate Actions")
cal = get_calendar(result["yf_symbol"])
earnings_dates = cal.get("Earnings Date") if cal else None
if earnings_dates:
    dates_list = earnings_dates if isinstance(earnings_dates, list) else [earnings_dates]
    st.write(f"**Next earnings date:** {', '.join(str(d) for d in dates_list)}")
else:
    st.write("**Next earnings date:** Not available for this symbol.")

dividends, splits = get_dividends_and_splits(result["yf_symbol"])
c1, c2 = st.columns(2)
with c1:
    st.markdown("**Recent dividends**")
    if dividends is not None and len(dividends) > 0:
        st.dataframe(dividends.tail(8).sort_index(ascending=False), use_container_width=True)
    else:
        st.caption("No dividend history found.")
with c2:
    st.markdown("**Recent splits**")
    if splits is not None and len(splits) > 0:
        st.dataframe(splits.tail(8).sort_index(ascending=False), use_container_width=True)
    else:
        st.caption("No stock-split history found.")

st.markdown("### Sector Analysis")
sector_groups = sector_groups_for_market(market)
peer_group = None
for sector_name, syms in sector_groups.items():
    syms_list = syms if isinstance(syms, list) else [syms]
    if result["yf_symbol"] in syms_list or any(s.split(".")[0] == result["symbol"] for s in syms_list):
        peer_group = (sector_name, syms_list)
        break

if peer_group:
    sector_name, syms_list = peer_group
    st.write(f"Peer group: **{sector_name}** — {', '.join(s.replace('.NS', '') for s in syms_list)}")
    rows = []
    for s in syms_list:
        hist = get_history(s, period="3mo")
        if len(hist) > 1:
            ret = (hist["Close"].iloc[-1] / hist["Close"].iloc[0] - 1) * 100
            rows.append({"Symbol": s.replace(".NS", ""), "3-month return %": round(ret, 2)})
    if rows:
        st.dataframe(rows, use_container_width=True)
else:
    st.caption("This symbol isn't part of a curated peer group in this app (peer groups only cover the "
               "curated screener universe, not every listed company).")

