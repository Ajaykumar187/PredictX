import json
import os
import threading

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
os.makedirs(DATA_DIR, exist_ok=True)

_lock = threading.Lock()


def _path(name: str) -> str:
    return os.path.join(DATA_DIR, f"{name}.json")


def load(name: str, default=None):
    path = _path(name)
    if not os.path.exists(path):
        return default if default is not None else {}
    with _lock:
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return default if default is not None else {}


def save(name: str, data) -> None:
    path = _path(name)
    with _lock:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str)


# convenience helpers for specific collections

def get_users():
    return load("users", {})


def save_users(users):
    save("users", users)


def get_portfolio(username):
    all_p = load("portfolios", {})
    return all_p.get(username, [])


def save_portfolio(username, holdings):
    all_p = load("portfolios", {})
    all_p[username] = holdings
    save("portfolios", all_p)


def get_watchlist(username):
    all_w = load("watchlists", {})
    return all_w.get(username, [])


def save_watchlist(username, symbols):
    all_w = load("watchlists", {})
    all_w[username] = symbols
    save("watchlists", all_w)


def get_alerts(username):
    all_a = load("alerts", {})
    return all_a.get(username, [])


def save_alerts(username, alerts):
    all_a = load("alerts", {})
    all_a[username] = alerts
    save("alerts", all_a)


def append_prediction_history(username, record):
    all_h = load("prediction_history", {})
    history = all_h.get(username, [])
    history.insert(0, record)
    all_h[username] = history[:200]
    save("prediction_history", all_h)


def get_prediction_history(username):
    all_h = load("prediction_history", {})
    return all_h.get(username, [])


def get_notification_settings(username):
    all_s = load("notification_settings", {})
    settings = all_s.get(username, {})
    defaults = {
        "email_alerts_enabled": False,
        "sms_alerts_enabled": False,
        "smtp_host": "smtp.gmail.com",
        "smtp_port": 587,
        "smtp_sender_email": "",
        "smtp_sender_password": "",
        "twilio_sid": "",
        "twilio_auth_token": "",
        "twilio_from_number": "",
    }
    defaults.update(settings)
    return defaults


def save_notification_settings(username, settings: dict):
    all_s = load("notification_settings", {})
    all_s[username] = settings
    save("notification_settings", all_s)


def append_login_history(username, record):
    all_h = load("login_history", {})
    history = all_h.get(username, [])
    history.insert(0, record)
    all_h[username] = history[:50]
    save("login_history", all_h)


def get_login_history(username):
    all_h = load("login_history", {})
    return all_h.get(username, [])
