import streamlit as st

from utils.styling import inject_css, navbar
from utils.sidebar import stock_selector_sidebar
from utils.ipo_predictor import ipo_ai_score

st.set_page_config(page_title="IPO Predictor", layout="wide", initial_sidebar_state="expanded")

market, symbol_input, yf_symbol, load_clicked = stock_selector_sidebar()

inject_css()
navbar("IPO Predictor", "A rule-based Apply/Avoid AI reading, based on the numbers you enter")

st.caption(
    "Fill in whatever you know about an IPO — the more fields you fill, the sharper the reading. "
    "Grey Market Premium (GMP) and subscription multiples are the strongest signals if you have them "
    "from a source you trust; everything else is optional."
)

company_name = st.text_input("Company name (optional, just for display)", value="")

c1, c2 = st.columns(2)
with c1:
    price_low = st.number_input("Price band — lower (₹)", min_value=0.0, value=0.0, step=1.0)
    issue_size = st.number_input("Issue size (₹ Crore)", min_value=0.0, value=0.0, step=10.0)
    overall_sub = st.number_input("Overall subscription (x times)", min_value=0.0, value=0.0, step=0.5,
                                   help="e.g. 12.5 means the issue was subscribed 12.5 times over")
with c2:
    price_high = st.number_input("Price band — upper (₹)", min_value=0.0, value=0.0, step=1.0)
    lot_size = st.number_input("Lot size (shares per lot)", min_value=0, value=0, step=1)
    qib_sub = st.number_input("QIB subscription (x times)", min_value=0.0, value=0.0, step=0.5,
                               help="Institutional (Qualified Institutional Buyer) subscription multiple")

gmp_percent = st.number_input(
    "Grey Market Premium, as % of issue price (unofficial — leave at 0 if unknown)",
    min_value=0.0, value=0.0, step=0.1
)

sector_momentum = st.selectbox("Current sector sentiment", ["Neutral", "Hot", "Weak"])

analyze = st.button("Get AI Recommendation", type="primary")

if analyze:
    result = ipo_ai_score(
        issue_size_cr=issue_size if issue_size > 0 else None,
        price_band_high=price_high if price_high > 0 else None,
        price_band_low=price_low if price_low > 0 else None,
        lot_size=int(lot_size) if lot_size > 0 else None,
        overall_subscription_x=overall_sub if overall_sub > 0 else None,
        qib_subscription_x=qib_sub if qib_sub > 0 else None,
        gmp_percent=float(gmp_percent),
        sector_momentum=sector_momentum,
    )

    st.markdown("---")
    title = f"AI Recommendation — {company_name}" if company_name else "AI Recommendation"
    st.subheader(title)

    m1, m2, m3 = st.columns(3)
    m1.metric("Recommendation", result["recommendation"])
    m2.metric("Confidence", f"{result['confidence']}%")
    m3.metric("Score", result["score"])

    if "APPLY" in result["recommendation"] and "Cautiously" not in result["recommendation"]:
        st.success(f"🟢 {result['recommendation']}")
    elif "APPLY" in result["recommendation"]:
        st.info(f"🔵 {result['recommendation']}")
    elif "AVOID" in result["recommendation"]:
        st.error(f"🔴 {result['recommendation']}")
    else:
        st.warning(f"🟡 {result['recommendation']}")

    with st.expander("AI Analysis", expanded=True):
        for reason in result["reasons"]:
            st.write("•", reason)

    st.caption(
        "This is a rule-based heuristic reading, not financial advice. GMP and subscription figures are "
        "unofficial market indicators and can move right up until listing day — treat this as one input "
        "among several, not a guarantee."
    )
