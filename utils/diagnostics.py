import pathlib

EXPECTED_PAGES = {
    "1_Charts_and_Analysis.py",
    "2_AI_Features.py",
    "3_Company_Info.py",
    "4_News_and_Sentiment.py",
    "5_Portfolio.py",
    "6_Alerts.py",
    "7_Account.py",
    "8_Advanced.py",
    "10_Scanners.py",
    "11_Global_Markets.py",
    "12_Investment_Tools.py",
    "13_Strategy_Lab.py",
    "14_Report_Analyzer.py",
    "15_IPO_Predictor.py",
    "16_AI_Option_Analyzer.py",
}


def find_stray_page_files():
    pages_dir = pathlib.Path(__file__).parent.parent / "pages"
    if not pages_dir.exists():
        return []
    return sorted(f.name for f in pages_dir.glob("*.py") if f.name not in EXPECTED_PAGES)
