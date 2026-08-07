import streamlit as st

from utils.styling import inject_css, navbar, loading
from utils.sidebar import stock_selector_sidebar
from utils.report_analyzer import extract_text_from_pdf, analyze_report

st.set_page_config(page_title="Report Analyzer", layout="wide", initial_sidebar_state="expanded")

market, symbol_input, yf_symbol, load_clicked = stock_selector_sidebar()

inject_css()
navbar("AI Financial Report Analyzer", "Upload an annual report / investor presentation PDF for a quick heuristic read")

st.info(
    "This is keyword/lexicon-based text analysis, not a language model reading and reasoning about the "
    "document. It's a quick triage aid — where the interesting numbers are, and whether the language leans "
    "positive or cautionary — not a substitute for actually reading the report."
)

uploaded = st.file_uploader("Upload a PDF (annual report, investor deck, results PDF, etc.)", type=["pdf"])

if uploaded:
    with loading("Extracting text from the PDF..."):
        text = extract_text_from_pdf(uploaded)

    if not text.strip():
        st.error("Couldn't extract any text — this PDF is likely scanned images rather than real text "
                 "(would need OCR, which isn't included here).")
    else:
        with loading("Analyzing..."):
            result = analyze_report(text)

        if "error" in result:
            st.error(result["error"])
        else:
            m1, m2, m3 = st.columns(3)
            m1.metric("Word count", f"{result['word_count']:,}")
            m2.metric("Positive-term hits", result["total_positive_hits"])
            m3.metric("Negative-term hits", result["total_negative_hits"])

            st.markdown(f"### Overall tone: {result['tone_summary']}")
            st.caption(f"Sampled-section sentiment: {result['sample_sentiment']['label']} "
                       f"(compound score {result['sample_sentiment']['compound']:+.2f})")

            c1, c2 = st.columns(2)
            with c1:
                st.markdown("**Positive terms found**")
                st.write(result["positive_term_counts"] or "None found")
            with c2:
                st.markdown("**Negative/cautionary terms found**")
                st.write(result["negative_term_counts"] or "None found")

            st.markdown("### Financial figures mentioned (lines with a keyword + a number)")
            if result["financial_lines"]:
                for line in result["financial_lines"]:
                    st.write("- " + line)
            else:
                st.write("No lines matched common financial keywords like revenue/profit/EBITDA/EPS.")
else:
    st.caption("Upload a PDF to begin.")
