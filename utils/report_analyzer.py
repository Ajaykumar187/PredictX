import re

import pdfplumber

from utils.sentiment import score_text

POSITIVE_TERMS = ["growth", "profit", "record", "expansion", "improved", "strong", "robust",
                   "increase", "higher", "surge", "outperform", "milestone", "upgrade"]
NEGATIVE_TERMS = ["loss", "decline", "impairment", "default", "litigation", "downgrade",
                  "weak", "shortfall", "restructuring", "write-off", "delay", "risk factor"]
FINANCIAL_LINE_KEYWORDS = ["revenue", "net profit", "net income", "total income", "ebitda",
                           "eps", "earnings per share", "total expenses", "net loss", "dividend"]


def extract_text_from_pdf(uploaded_file, max_pages: int = 60) -> str:
    text_parts = []
    with pdfplumber.open(uploaded_file) as pdf:
        for page in pdf.pages[:max_pages]:
            page_text = page.extract_text() or ""
            text_parts.append(page_text)
    return "\n".join(text_parts)


def _count_terms(text_lower: str, terms: list) -> dict:
    return {t: len(re.findall(r"\b" + re.escape(t) + r"\b", text_lower)) for t in terms}


def extract_financial_lines(text: str, limit: int = 25) -> list:
    lines = text.split("\n")
    hits = []
    number_pattern = re.compile(r"[\d,]+\.?\d*")
    for line in lines:
        lower = line.lower()
        if any(k in lower for k in FINANCIAL_LINE_KEYWORDS) and number_pattern.search(line):
            hits.append(line.strip())
        if len(hits) >= limit:
            break
    return hits


def analyze_report(text: str) -> dict:
    if not text or not text.strip():
        return {"error": "No extractable text found — this PDF may be scanned images rather than real text."}

    text_lower = text.lower()
    pos_counts = _count_terms(text_lower, POSITIVE_TERMS)
    neg_counts = _count_terms(text_lower, NEGATIVE_TERMS)
    total_pos = sum(pos_counts.values())
    total_neg = sum(neg_counts.values())

    sample = text[len(text) // 3: len(text) // 3 + 4000]
    sentiment = score_text(sample)

    financial_lines = extract_financial_lines(text)

    if total_pos > total_neg * 1.5:
        tone = "Predominantly positive language"
    elif total_neg > total_pos * 1.5:
        tone = "Predominantly cautionary/negative language"
    else:
        tone = "Mixed / balanced language"

    return {
        "word_count": len(text.split()),
        "positive_term_counts": {k: v for k, v in pos_counts.items() if v > 0},
        "negative_term_counts": {k: v for k, v in neg_counts.items() if v > 0},
        "total_positive_hits": total_pos, "total_negative_hits": total_neg,
        "tone_summary": tone, "sample_sentiment": sentiment,
        "financial_lines": financial_lines
    }
