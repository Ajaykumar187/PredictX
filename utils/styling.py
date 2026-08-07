import streamlit as st

LIGHT = {
    "bg": "#ffffff", "text": "#0a0a0a", "card_bg": "#f5f7fa",
    "navy": "#0a2540", "navy2": "#163f73", "border": "#e5e7eb",
    "input_bg": "#ffffff", "input_text": "#000000"
}
DARK = {
    "bg": "#0b0f19", "text": "#f1f5f9", "card_bg": "#131826",
    "navy": "#0a2540", "navy2": "#163f73", "border": "#232a3b",
    "input_bg": "#1b2233", "input_text": "#f1f5f9"
}


def get_theme():
    if "theme" not in st.session_state:
        st.session_state.theme = "Light"
    return DARK if st.session_state.theme == "Dark" else LIGHT


def theme_toggle_sidebar():
    st.sidebar.markdown("---")
    choice = st.sidebar.radio("Appearance", ["Light", "Dark"],
                               index=0 if st.session_state.get("theme", "Light") == "Light" else 1,
                               horizontal=True, key="theme_radio")
    st.session_state.theme = choice


def inject_css():
    t = get_theme()
    accent = "#FF6B1A"
    st.markdown(f"""
    <style>
    .stApp {{ background-color: {t['bg']}; color: {t['text']}; }}
    header {{ background: transparent !important; }}
    header [data-testid="stToolbar"], header [data-testid="stStatusWidget"],
    header [data-testid="stDecoration"], header [data-testid="stMainMenu"] {{ visibility: hidden !important; }}
    footer {{ visibility: hidden; }}

    [data-testid="collapsedControl"] {{
        visibility: visible !important;
        display: flex !important;
        opacity: 1 !important;
        background: linear-gradient(135deg, {t['navy']}, {t['navy2']}) !important;
        border-radius: 8px !important;
    }}
    [data-testid="collapsedControl"] svg {{
        visibility: visible !important;
        color: white !important; fill: white !important; stroke: white !important;
    }}
    .stApp, .stApp p, .stApp span, .stApp label, .stApp li {{ color: {t['text']}; }}
    .stApp h1, .stApp h2, .stApp h3, .stApp h4, .stApp h5 {{ color: {t['text']}; }}

    .navbar {{
        background: linear-gradient(135deg, {t['navy']}, {t['navy2']});
        padding: 16px 30px; border-radius: 12px; margin-bottom: 22px;
        animation: fadeIn .6s ease;
    }}
    .navbar-title {{ color: white; font-size: 26px; font-weight: 800; }}
    .navbar-sub {{ color: rgba(255,255,255,.75); font-size: 13px; margin-top: 2px;}}

    .card {{
        background-color: {t['card_bg']}; padding: 22px; border-radius: 14px;
        box-shadow: 0px 4px 14px rgba(0,0,0,0.10); text-align: center;
        border: 1px solid {t['border']};
        transition: transform .2s ease, box-shadow .2s ease;
        animation: fadeInUp .5s ease;
    }}
    .card:hover {{ transform: translateY(-4px); box-shadow: 0px 10px 22px rgba(0,0,0,0.16); }}
    .card, .card * {{ color: {t['text']}; }}

    .badge {{
        display:inline-block; padding: 4px 12px; border-radius: 999px;
        font-size: 12px; font-weight: 700; letter-spacing:.02em;
    }}
    .badge-green {{ background:#e8f7ee; color:#16A34A; }}
    .badge-red {{ background:#fdecec; color:#DC2626; }}
    .badge-amber {{ background:#fff6e3; color:#B45309; }}
    .badge-navy {{ background:#e7edf6; color:{t['navy']}; }}
    span.badge.badge-green {{ color:#16A34A !important; }}
    span.badge.badge-red {{ color:#DC2626 !important; }}
    span.badge.badge-amber {{ color:#B45309 !important; }}
    span.badge.badge-navy {{ color:{t['navy']} !important; }}

    section[data-testid="stSidebar"] {{ background-color: {t['navy']}; }}
    section[data-testid="stSidebar"] * {{ color: white; }}
    section[data-testid="stSidebar"] div[data-baseweb="input"] > div{{
        background:#ffffff !important;
        border-radius:10px !important;
        border:1px solid #d1d5db !important;
    }}

    section[data-testid="stSidebar"] div[data-baseweb="input"] input{{
        color:#000000 !important;
        -webkit-text-fill-color:#000000 !important;
        background:transparent !important;
        caret-color:#000000 !important;
        font-weight:600 !important;
    }}

    section[data-testid="stSidebar"] div[data-baseweb="input"] input::placeholder{{
        color:#777777 !important;
    }}
    section[data-testid="stSidebar"] div[data-baseweb="select"] > div {{
        background-color: #ffffff !important;
    }}
    section[data-testid="stSidebar"] div[data-baseweb="select"] * {{
        color: #000000 !important;
        -webkit-text-fill-color: #000000 !important;
    }}
    section[data-testid="stSidebar"] div[data-baseweb="select"] input {{
        caret-color: transparent !important;
    }}
    div[data-testid="stSelectbox"] input,
    div[data-baseweb="select"] input,
    div[data-baseweb="popover"] input,
    div[data-testid="stSelectbox"] input:focus,
    div[data-baseweb="select"] input:focus {{
        caret-color: transparent !important;
        cursor: default !important;
        pointer-events: none !important;
    }}

    input, textarea {{ color: {t['input_text']} !important; background-color: {t['input_bg']} !important; }}

    div[data-baseweb="select"] > div {{
        background-color: {t['input_bg']} !important; color: {t['input_text']} !important;
        border-color: {t['border']} !important;
    }}
    div[data-baseweb="select"] span {{ color: {t['input_text']} !important; }}
    div[data-baseweb="popover"] div[data-baseweb="menu"], ul[data-baseweb="menu"] {{
        background-color: {t['input_bg']} !important;
    }}
    li[role="option"] {{ color: {t['input_text']} !important; background-color: {t['input_bg']} !important; }}
    li[role="option"]:hover {{ background-color: {t['card_bg']} !important; }}

    div[data-testid="stRadio"] label, div[data-testid="stCheckbox"] label {{ color: {t['text']} !important; }}

    div[data-testid="stAlert"] {{
        background-color: {t['card_bg']} !important; border: 1px solid {t['border']};
        border-radius: 10px;
    }}
    div[data-testid="stAlert"] * {{ color: {t['text']} !important; }}

    div[data-testid="stExpander"] {{
        background-color: {t['card_bg']} !important; border: 1px solid {t['border']} !important;
        border-radius: 10px; overflow: hidden;
    }}
    div[data-testid="stExpander"] summary, div[data-testid="stExpander"] p {{ color: {t['text']} !important; }}

    .stTabs [data-baseweb="tab-list"] {{ gap: 6px; border-bottom: 1px solid {t['border']}; }}
    .stTabs [data-baseweb="tab"] {{ color: {t['text']}; opacity: .65; }}
    .stTabs [aria-selected="true"] {{ color: {accent} !important; opacity: 1; border-bottom-color: {accent} !important; }}

    div[data-testid="stDataFrame"] {{ border: 1px solid {t['border']}; border-radius: 10px; }}

    div[data-testid="stForm"] {{
        background-color: {t['card_bg']}; border: 1px solid {t['border']}; border-radius: 12px; padding: 16px;
    }}

    div[data-testid="stProgress"] > div > div {{ background-color: {t['border']}; }}

    .stButton > button, div[data-testid="stFormSubmitButton"] > button {{
        background: linear-gradient(135deg, {t['navy']}, {t['navy2']});
        color: white; border-radius: 30px; padding: 10px 24px;
        font-size: 15px; font-weight: 700; border: none;
        box-shadow: 0px 4px 12px rgba(10,37,64,0.35);
        transition: transform .15s ease;
    }}
    .stButton > button:hover, div[data-testid="stFormSubmitButton"] > button:hover {{ transform: scale(1.04); }}
    .stButton > button p, div[data-testid="stFormSubmitButton"] > button p {{ color: white !important; }}
    .stDownloadButton > button {{
        background: linear-gradient(135deg, {t['navy']}, {t['navy2']});
        color: white; border-radius: 30px; border: none;
    }}
    .stDownloadButton > button p {{ color: white !important; }}

    div[data-testid="stMetric"], div[data-testid="metric-container"] {{
        background-color: {t['card_bg']}; border: 1px solid {t['border']};
        padding: 14px; border-radius: 12px;
    }}
    div[data-testid="stMetric"] *, div[data-testid="metric-container"] * {{ color: {t['text']} !important; }}

    @keyframes fadeIn {{ from {{opacity:0;}} to {{opacity:1;}} }}
    @keyframes fadeInUp {{ from {{opacity:0; transform: translateY(10px);}} to {{opacity:1; transform: translateY(0);}} }}

    @media (max-width: 640px) {{
        .navbar-title {{ font-size: 20px; }}
        .card {{ padding: 14px; }}
    }}
    </style>
    """, unsafe_allow_html=True)


def navbar(title="Stock Prediction Dashboard", subtitle="Search • Analyze • Predict"):
    st.markdown(f"""
    <div class="navbar">
        <div class="navbar-title">{title}</div>
        <div class="navbar-sub">{subtitle}</div>
    </div>
    """, unsafe_allow_html=True)


def loading(message="Working on it..."):
    return st.spinner(message)


def badge(text, kind="navy"):
    return f'<span class="badge badge-{kind}">{text}</span>'
