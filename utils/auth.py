import datetime
import hashlib
import os

import pyotp
import streamlit as st

from utils.storage import get_users, save_users, append_login_history, get_login_history


def _hash_password(password: str, salt: str) -> str:
    return hashlib.sha256((salt + password).encode("utf-8")).hexdigest()


def _new_salt() -> str:
    return os.urandom(16).hex()


def signup(username, email, phone, password, security_question, security_answer):
    users = get_users()
    if username in users:
        return False, "Username already exists."
    salt = _new_salt()
    users[username] = {
        "email": email,
        "phone": phone,
        "salt": salt,
        "password_hash": _hash_password(password, salt),
        "security_question": security_question,
        "security_answer_hash": _hash_password(security_answer.strip().lower(), salt),
        "totp_secret": None,
        "totp_enabled": False,
    }
    save_users(users)
    return True, "Account created — you can log in now."


def login(username, password):
    users = get_users()
    user = users.get(username)
    if not user:
        return False, "No such user."
    if _hash_password(password, user["salt"]) != user["password_hash"]:
        return False, "Incorrect password."
    return True, "Logged in."


def update_profile(username, email, phone):
    users = get_users()
    user = users.get(username)
    if not user:
        return False, "No such user."
    user["email"] = email.strip()
    user["phone"] = phone.strip()
    save_users(users)
    return True, "Profile updated."


def change_password(username, current_password, new_password):
    users = get_users()
    user = users.get(username)
    if not user:
        return False, "No such user."
    if _hash_password(current_password, user["salt"]) != user["password_hash"]:
        return False, "Current password is incorrect."
    if not new_password or len(new_password) < 6:
        return False, "New password must be at least 6 characters."
    user["password_hash"] = _hash_password(new_password, user["salt"])
    save_users(users)
    return True, "Password changed successfully."


def reset_password(username, security_answer, new_password):
    users = get_users()
    user = users.get(username)
    if not user:
        return False, "No such user."
    if _hash_password(security_answer.strip().lower(), user["salt"]) != user["security_answer_hash"]:
        return False, "Security answer did not match."
    user["password_hash"] = _hash_password(new_password, user["salt"])
    save_users(users)
    return True, "Password updated — you can log in now."


# Two-factor authentication (TOTP)

def is_2fa_enabled(username) -> bool:
    users = get_users()
    return bool(users.get(username, {}).get("totp_enabled"))


def start_2fa_setup(username) -> str:
    users = get_users()
    secret = pyotp.random_base32()
    users[username]["totp_secret"] = secret
    users[username]["totp_enabled"] = False
    save_users(users)
    uri = pyotp.totp.TOTP(secret).provisioning_uri(name=username, issuer_name="StockDashboard")
    return uri


def confirm_2fa_setup(username, code) -> tuple:
    users = get_users()
    secret = users.get(username, {}).get("totp_secret")
    if not secret:
        return False, "No 2FA setup in progress — start setup again."
    if pyotp.totp.TOTP(secret).verify(code, valid_window=1):
        users[username]["totp_enabled"] = True
        save_users(users)
        return True, "Two-factor authentication enabled."
    return False, "Incorrect code — check your authenticator app and try again."


def disable_2fa(username):
    users = get_users()
    users[username]["totp_enabled"] = False
    users[username]["totp_secret"] = None
    save_users(users)


def verify_2fa_code(username, code) -> bool:
    users = get_users()
    secret = users.get(username, {}).get("totp_secret")
    if not secret:
        return False
    return pyotp.totp.TOTP(secret).verify(code, valid_window=1)


# Session helpers

def current_user():
    return st.session_state.get("username")


def is_logged_in():
    return current_user() is not None


def logout():
    st.session_state.pop("username", None)
    st.session_state.pop("pending_2fa_user", None)


def _complete_login(username):
    st.session_state.username = username
    st.session_state.pop("pending_2fa_user", None)
    append_login_history(username, {
        "timestamp": datetime.datetime.now().isoformat(),
        "note": "Local session login"
    })


def require_login_ui():
    if is_logged_in():
        return True

    if st.session_state.get("pending_2fa_user"):
        pending_user = st.session_state["pending_2fa_user"]
        st.info(f"Two-factor authentication is enabled for **{pending_user}** — enter the 6-digit code from your authenticator app.")
        code = st.text_input("Authenticator code", key="twofa_code")
        c1, c2 = st.columns(2)
        if c1.button("Verify code"):
            if verify_2fa_code(pending_user, code):
                _complete_login(pending_user)
                st.success("Logged in.")
                st.rerun()
            else:
                st.error("Incorrect or expired code.")
        if c2.button("Cancel"):
            st.session_state.pop("pending_2fa_user", None)
            st.rerun()
        return False

    st.info("Log in or create a free local account to use this feature (portfolio, watchlist, alerts, and prediction history are saved per-user).")
    tab1, tab2, tab3 = st.tabs(["Log in", "Sign up", "Forgot password"])

    with tab1:
        with st.form("login_form"):
            u = st.text_input("Username", key="login_u")
            p = st.text_input("Password", type="password", key="login_p")
            submitted = st.form_submit_button("Log in")
        if submitted:
            ok, msg = login(u, p)
            if ok:
                if is_2fa_enabled(u):
                    st.session_state.pending_2fa_user = u
                    st.rerun()
                else:
                    _complete_login(u)
                    st.success(msg)
                    st.rerun()
            else:
                st.error(msg)

    with tab2:
        with st.form("signup_form"):
            su = st.text_input("Choose a username", key="signup_u")
            se = st.text_input("Email", key="signup_e")
            sph = st.text_input("Phone number (with country code, e.g. +91XXXXXXXXXX)", key="signup_ph")
            sp = st.text_input("Choose a password", type="password", key="signup_p")
            sq = st.text_input("Security question (e.g. 'First pet's name?')", key="signup_q")
            sa = st.text_input("Answer", key="signup_a")
            st.caption("Your email and phone are used only to deliver alerts to *your own* account — "
                       "you can add or change them anytime from the Account page.")
            submitted = st.form_submit_button("Create account")
        if submitted:
            if not (su.strip() and se.strip() and sp.strip() and sq.strip() and sa.strip()):
                st.error("Please fill in every field (phone is optional, needed only for SMS alerts).")
            else:
                ok, msg = signup(su.strip(), se.strip(), sph.strip(), sp, sq.strip(), sa.strip())
                if ok:
                    st.success(msg)
                else:
                    st.error(msg)

    with tab3:
        with st.form("forgot_form"):
            fu = st.text_input("Username", key="forgot_u")
            users = get_users()
            question = users.get(fu, {}).get("security_question", "")
            if fu and question:
                st.caption(f"Security question: {question}")
            fa = st.text_input("Answer", key="forgot_a")
            fp = st.text_input("New password", type="password", key="forgot_p")
            submitted = st.form_submit_button("Reset password")
        if submitted:
            ok, msg = reset_password(fu, fa, fp)
            if ok:
                st.success(msg)
            else:
                st.error(msg)

    return False
