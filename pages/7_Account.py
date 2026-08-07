import io

import pandas as pd
import qrcode
import streamlit as st

from utils.styling import inject_css, navbar, theme_toggle_sidebar, badge
from utils.auth import (require_login_ui, current_user, logout, is_2fa_enabled,
                         start_2fa_setup, confirm_2fa_setup, disable_2fa,
                         update_profile, change_password)
from utils.storage import (get_users, get_prediction_history, get_watchlist, get_portfolio,
                            get_login_history, get_notification_settings, save_notification_settings)
from utils.alerts_engine import notify_user

st.set_page_config(page_title="Account", layout="wide", initial_sidebar_state="expanded")

theme_toggle_sidebar()

inject_css()
navbar("My Account", "Profile, security, notifications, and activity")

if not require_login_ui():
    st.stop()

user = current_user()
users = get_users()
profile = users.get(user, {})

# Header / identity strip
h1, h2 = st.columns([4, 1])
with h1:
    st.markdown(f"## {user}")
    st.write(f"📧 {profile.get('email') or '—'}   |   📱 {profile.get('phone') or 'no phone on file'}")
    st.markdown(badge("2FA ON", "green") if is_2fa_enabled(user) else badge("2FA OFF", "amber"),
                unsafe_allow_html=True)
with h2:
    if st.button("Log out"):
        logout()
        st.rerun()

st.markdown("---")

tab_profile, tab_security, tab_notify, tab_activity = st.tabs(
    ["👤 Profile", "🔒 Security", "🔔 Notifications", "📊 Activity & Data"]
)

# PROFILE
with tab_profile:
    st.markdown("### Profile details")
    st.caption("This email and phone number are where *your* alerts get delivered — nobody else's.")
    with st.form("edit_profile"):
        new_email = st.text_input("Email address", value=profile.get("email", ""))
        new_phone = st.text_input("Phone number (with country code, e.g. +91XXXXXXXXXX)",
                                   value=profile.get("phone", ""))
        save_profile = st.form_submit_button("Save changes")
        if save_profile:
            if not new_email:
                st.error("Email cannot be empty.")
            else:
                ok, msg = update_profile(user, new_email, new_phone)
                (st.success if ok else st.error)(msg)
                if ok:
                    st.rerun()

# SECURITY
with tab_security:
    st.markdown("### Change password")
    with st.form("change_password_form"):
        cur_pw = st.text_input("Current password", type="password")
        new_pw = st.text_input("New password", type="password")
        confirm_pw = st.text_input("Confirm new password", type="password")
        change_pw_btn = st.form_submit_button("Update password")
        if change_pw_btn:
            if new_pw != confirm_pw:
                st.error("New password and confirmation don't match.")
            else:
                ok, msg = change_password(user, cur_pw, new_pw)
                (st.success if ok else st.error)(msg)

    st.markdown("---")
    st.markdown("### Two-Factor Authentication (2FA)")
    st.caption("Standard TOTP (the same protocol as Google Authenticator/Authy) — a genuine second factor, "
               "not a cosmetic one. That said, this is still a locally-stored demo auth system with no device/session "
               "revocation infrastructure, so treat it as a real 2FA *mechanism* rather than production-grade account security.")

    if is_2fa_enabled(user):
        st.success("2FA is currently **enabled** on your account.")
        if st.button("Disable 2FA"):
            disable_2fa(user)
            st.rerun()
    else:
        st.warning("2FA is currently **disabled**.")
        if "totp_setup_uri" not in st.session_state:
            if st.button("Set up 2FA"):
                st.session_state.totp_setup_uri = start_2fa_setup(user)
                st.rerun()
        else:
            uri = st.session_state.totp_setup_uri
            qr_img = qrcode.make(uri)
            buf = io.BytesIO()
            qr_img.save(buf, format="PNG")
            st.image(buf.getvalue(), width=200, caption="Scan with Google Authenticator, Authy, etc.")
            st.caption(f"Or enter this manually: `{uri.split('secret=')[1].split('&')[0]}`")
            code = st.text_input("Enter the 6-digit code to confirm setup")
            if st.button("Confirm & enable 2FA"):
                ok, msg = confirm_2fa_setup(user, code)
                (st.success if ok else st.error)(msg)
                if ok:
                    st.session_state.pop("totp_setup_uri", None)
                    st.rerun()

# NOTIFICATIONS
with tab_notify:
    st.markdown("### Alert delivery")
    st.caption("Turn these on once here, and every alert you set up on the Alerts page will be delivered "
               "straight to **your own** email/phone above — automatically, with no risk of it going to the "
               "wrong inbox or number.")

    settings = get_notification_settings(user)

    if not profile.get("email"):
        st.info("Add an email address in the Profile tab to enable email alerts.")
    if not profile.get("phone"):
        st.info("Add a phone number in the Profile tab to enable SMS alerts.")

    with st.form("notification_settings_form"):
        st.markdown("#### 📧 Email alerts")
        email_enabled = st.checkbox("Send my alerts by email", value=settings.get("email_alerts_enabled", False))
        c1, c2 = st.columns(2)
        smtp_host = c1.text_input("SMTP host", value=settings.get("smtp_host", "smtp.gmail.com"))
        smtp_port = c2.number_input("SMTP port", value=int(settings.get("smtp_port", 587)))
        smtp_sender_email = st.text_input("Sender email (your own, used to send)",
                                           value=settings.get("smtp_sender_email", ""))
        smtp_sender_password = st.text_input("App password", type="password",
                                              value=settings.get("smtp_sender_password", ""))
        st.caption("For Gmail, use a 16-character 'App Password', not your normal login password. "
                   f"Alerts will be delivered to **{profile.get('email') or 'the email in your Profile tab'}**.")

        st.markdown("#### 📱 SMS alerts")
        sms_enabled = st.checkbox("Send my alerts by SMS", value=settings.get("sms_alerts_enabled", False))
        twilio_sid = st.text_input("Twilio Account SID", value=settings.get("twilio_sid", ""))
        twilio_token = st.text_input("Twilio Auth Token", type="password", value=settings.get("twilio_auth_token", ""))
        twilio_from = st.text_input("Twilio phone number (sender, e.g. +1XXXXXXXXXX)",
                                     value=settings.get("twilio_from_number", ""))
        st.caption("Uses your own free/paid Twilio account to send the text. "
                   f"Alerts will be delivered to **{profile.get('phone') or 'the phone number in your Profile tab'}**.")

        save_settings = st.form_submit_button("Save notification settings")
        if save_settings:
            if email_enabled and not profile.get("email"):
                st.error("Add an email address in the Profile tab first.")
            elif sms_enabled and not profile.get("phone"):
                st.error("Add a phone number in the Profile tab first.")
            else:
                new_settings = {
                    "email_alerts_enabled": email_enabled,
                    "sms_alerts_enabled": sms_enabled,
                    "smtp_host": smtp_host,
                    "smtp_port": int(smtp_port),
                    "smtp_sender_email": smtp_sender_email,
                    "smtp_sender_password": smtp_sender_password,
                    "twilio_sid": twilio_sid,
                    "twilio_auth_token": twilio_token,
                    "twilio_from_number": twilio_from,
                    "profile_email": profile.get("email", ""),
                    "profile_phone": profile.get("phone", ""),
                }
                save_notification_settings(user, new_settings)
                st.success("Notification settings saved.")
                st.rerun()

    st.markdown("---")
    st.markdown("#### Send yourself a test notification")
    st.caption("This always goes to your own saved email/phone above — there's no field to type a different recipient into.")
    if st.button("Send test notification"):
        settings = get_notification_settings(user)
        settings["profile_email"] = profile.get("email", "")
        settings["profile_phone"] = profile.get("phone", "")
        if not settings.get("email_alerts_enabled") and not settings.get("sms_alerts_enabled"):
            st.warning("Turn on email or SMS alerts above first.")
        else:
            results = notify_user(user, settings, "Stock Dashboard test alert",
                                   f"Hi {user}, this is a test notification from your Stock Dashboard account.")
            for channel, ok, msg in results:
                (st.success if ok else st.error)(f"{channel.upper()}: {msg}")

# ACTIVITY & DATA
with tab_activity:
    st.markdown("### Login History")
    logins = get_login_history(user)
    if logins:
        st.dataframe(pd.DataFrame(logins), use_container_width=True)
    else:
        st.caption("No login history recorded yet.")

    st.markdown("---")
    st.markdown("### Prediction History")
    history = get_prediction_history(user)
    if history:
        df = pd.DataFrame(history)
        show_cols = [c for c in ["timestamp", "symbol", "market", "latest_price", "signal", "score", "confidence"] if c in df.columns]
        st.dataframe(df[show_cols], use_container_width=True)
    else:
        st.info("No saved predictions yet — save one from the AI Features page.")

    st.markdown("---")
    st.markdown("### Saved Watchlist")
    watchlist = get_watchlist(user)
    if watchlist:
        st.dataframe(pd.DataFrame(watchlist), use_container_width=True)
    else:
        st.info("Your watchlist is empty — add symbols from the Portfolio page.")

    st.markdown("---")
    st.markdown("### Portfolio Snapshot")
    holdings = get_portfolio(user)
    if holdings:
        st.dataframe(pd.DataFrame(holdings), use_container_width=True)
    else:
        st.info("No holdings yet — add them on the Portfolio page.")
