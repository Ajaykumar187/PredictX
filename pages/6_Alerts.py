import streamlit as st

from utils.styling import inject_css, navbar, loading
from utils.sidebar import stock_selector_sidebar
from utils.auth import require_login_ui, current_user
from utils.storage import get_alerts, save_alerts, get_watchlist, get_users, get_notification_settings
from utils.data_fetch import get_quote_snapshot, get_info
from utils.market import detect_market, strip_suffix
from utils.alerts_engine import check_price_alerts, notify_user
from utils.scanners import (fetch_universe_history, scan_breakouts, scan_volume_spike,
                             scan_rsi_extreme, scan_macd_crossover)

st.set_page_config(page_title="Alerts", layout="wide", initial_sidebar_state="expanded")

market, symbol_input, yf_symbol, load_clicked = stock_selector_sidebar()

inject_css()
navbar("Alerts", "Price targets, delivered automatically to your own email & SMS")

st.warning("There is no background scheduler here — alerts are checked whenever you open or refresh this page, "
           "not continuously. For always-on alerts you'd need a small server-side cron job calling the same check.")

if not require_login_ui():
    st.stop()

user = current_user()
profile = get_users().get(user, {})
alerts = get_alerts(user)


def _notification_settings_ready():
    settings = get_notification_settings(user)
    settings["profile_email"] = profile.get("email", "")
    settings["profile_phone"] = profile.get("phone", "")
    return settings


notif_settings = _notification_settings_ready()
email_on = notif_settings.get("email_alerts_enabled")
sms_on = notif_settings.get("sms_alerts_enabled")

if email_on or sms_on:
    channels = ", ".join(c for c, on in [("email", email_on), ("SMS", sms_on)] if on)
    st.success(f"Notifications are ON for **{channels}** — delivered automatically to your own "
               f"{profile.get('email') or ''}{' / ' if profile.get('email') and profile.get('phone') else ''}"
               f"{profile.get('phone') or ''} whenever an alert below triggers.")
else:
    st.info("Email/SMS notifications are currently off. Turn them on from the **Notifications** tab on the "
            "Account page — once enabled, they'll always go to your own registered email/phone, automatically.")

st.markdown("### Add a price alert")
with st.form("add_alert"):
    c1, c2, c3, c4 = st.columns(4)
    a_market = c1.selectbox("Market", ["NSE", "BSE", "US", "INDEX"])
    a_symbol = c2.text_input("Symbol", value=symbol_input)
    a_target = c3.number_input("Target price", min_value=0.0, value=100.0)
    a_direction = c4.selectbox("Trigger when price is", ["above", "below"])
    submitted = st.form_submit_button("Add alert")
    if submitted:
        alerts.append({
            "market": a_market, "symbol": a_symbol.upper(),
            "yf_symbol": detect_market(a_symbol, a_market),
            "target_price": a_target, "direction": a_direction, "triggered": False
        })
        save_alerts(user, alerts)
        st.success("Alert added.")
        st.rerun()

if alerts:
    st.markdown("### Your alerts")
    current_prices = {}
    for a in alerts:
        snap = get_quote_snapshot(a["yf_symbol"])
        if snap:
            current_prices[a["yf_symbol"]] = snap["price"]

    for i, a in enumerate(alerts):
        price = current_prices.get(a["yf_symbol"], "N/A")
        status = "Triggered" if a.get("triggered") else "Watching"
        st.write(f"**{a['symbol']}** — trigger when price is **{a['direction']} {a['target_price']}** "
                 f"(current: {price}) — {status}")

    price_by_symbol = {a["symbol"]: current_prices.get(a["yf_symbol"]) for a in alerts}
    triggered = check_price_alerts(alerts, price_by_symbol)
    save_alerts(user, alerts)

    if triggered:
        st.success(f"{len(triggered)} alert(s) just triggered!")
        for t in triggered:
            st.write(f"- {t['symbol']} crossed {t['direction']} {t['target_price']}")

        if email_on or sms_on:
            lines = "\n".join(f"- {t['symbol']} crossed {t['direction']} {t['target_price']}" for t in triggered)
            message = f"Hi {user}, {len(triggered)} price alert(s) just triggered on your Stock Dashboard:\n{lines}"
            results = notify_user(user, notif_settings, "Stock Dashboard: price alert triggered", message)
            for channel, ok, info in results:
                (st.caption if ok else st.error)(f"{channel.upper()} notification: {info}")

    remove_i = st.number_input("Remove alert # (see list order above, 1-indexed)", min_value=0,
                                max_value=len(alerts), value=0)
    if remove_i > 0 and st.button("Remove alert"):
        alerts.pop(remove_i - 1)
        save_alerts(user, alerts)
        st.rerun()
else:
    st.info("No alerts yet.")

st.markdown("---")
st.markdown("### Smart Alerts (scans your watchlist)")
st.caption("Checked on demand (click below), not continuously — same limitation as the price alerts above.")
watchlist = get_watchlist(user)
if not watchlist:
    st.info("Add symbols to your watchlist on the Portfolio page to use smart alerts.")
else:
    if st.button("Scan watchlist for breakout / volume spike / RSI / MACD signals"):
        symbols = [w["yf_symbol"] for w in watchlist]
        with loading(f"Fetching {len(symbols)} symbols..."):
            history = fetch_universe_history(symbols, period="6mo")

        def _show(title, df):
            st.markdown(f"**{title}**")
            if df.empty:
                st.write("No matches.")
            else:
                out = df.copy()
                out["symbol"] = out["symbol"].apply(strip_suffix)
                st.dataframe(out, use_container_width=True)

        _show("Breakout Alerts (20-day high)", scan_breakouts(history))
        _show("Volume Spike Alerts (2x+ average)", scan_volume_spike(history))
        _show("RSI Alerts (overbought/oversold)", scan_rsi_extreme(history))
        _show("MACD Crossover Alerts", scan_macd_crossover(history))

st.markdown("### Earnings Alerts")
if not watchlist:
    st.caption("Add symbols to your watchlist to check upcoming earnings dates.")
else:
    if st.button("Check upcoming earnings dates for your watchlist"):
        found_any = False
        for w in watchlist:
            info = get_info(w["yf_symbol"])
            earnings_date = info.get("earningsTimestampStart") or info.get("earningsTimestamp")
            if earnings_date:
                found_any = True
                import datetime as _dt
                dt = _dt.datetime.fromtimestamp(earnings_date)
                st.write(f"- **{w['symbol']}**: next earnings around {dt.strftime('%d %b %Y')}")
        if not found_any:
            st.write("No upcoming earnings dates found for your watchlist symbols.")

st.markdown("---")
st.markdown("### Notification Settings")
st.caption("Email and SMS delivery are configured once on the Account page, and always deliver to your own "
           "registered contact info — never a manually typed recipient. This keeps alerts private to you.")
if st.button("Go to Account → Notifications"):
    st.switch_page("pages/7_Account.py")
