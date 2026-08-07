import smtplib
from email.mime.text import MIMEText

import requests


def send_email_alert(smtp_host, smtp_port, sender_email, sender_password, to_email, subject, body):
    try:
        msg = MIMEText(body)
        msg["Subject"] = subject
        msg["From"] = sender_email
        msg["To"] = to_email
        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, [to_email], msg.as_string())
        return True, "Email sent."
    except Exception as e:
        return False, f"Email failed: {e}"


def send_telegram_alert(bot_token, chat_id, message):
    try:
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        resp = requests.post(url, data={"chat_id": chat_id, "text": message}, timeout=15)
        if resp.status_code == 200:
            return True, "Telegram message sent."
        return False, f"Telegram API returned {resp.status_code}: {resp.text}"
    except Exception as e:
        return False, f"Telegram failed: {e}"


def send_sms_alert(account_sid, auth_token, from_number, to_number, message):
    if not (account_sid and auth_token and from_number and to_number):
        return False, "SMS not sent: missing account SID, auth token, from-number, or to-number."
    try:
        url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
        resp = requests.post(
            url,
            data={"From": from_number, "To": to_number, "Body": message},
            auth=(account_sid, auth_token),
            timeout=15,
        )
        if resp.status_code in (200, 201):
            return True, "SMS sent."
        return False, f"SMS API returned {resp.status_code}: {resp.text}"
    except Exception as e:
        return False, f"SMS failed: {e}"


def notify_user(username, notification_settings: dict, subject: str, message: str):
    results = []
    if not notification_settings:
        return results

    if notification_settings.get("email_alerts_enabled"):
        to_email = notification_settings.get("profile_email")
        smtp_host = notification_settings.get("smtp_host")
        smtp_port = notification_settings.get("smtp_port")
        sender_email = notification_settings.get("smtp_sender_email")
        sender_password = notification_settings.get("smtp_sender_password")
        if to_email and smtp_host and sender_email and sender_password:
            ok, msg = send_email_alert(smtp_host, int(smtp_port), sender_email, sender_password,
                                        to_email, subject, message)
            results.append(("email", ok, msg))
        else:
            results.append(("email", False, "Email alerts are on but email settings are incomplete — finish setup on the Account page."))

    if notification_settings.get("sms_alerts_enabled"):
        to_number = notification_settings.get("profile_phone")
        sid = notification_settings.get("twilio_sid")
        token = notification_settings.get("twilio_auth_token")
        from_number = notification_settings.get("twilio_from_number")
        if to_number and sid and token and from_number:
            ok, msg = send_sms_alert(sid, token, from_number, to_number, message)
            results.append(("sms", ok, msg))
        else:
            results.append(("sms", False, "SMS alerts are on but SMS settings are incomplete — finish setup on the Account page."))

    return results


def check_price_alerts(alerts, current_prices: dict):
    triggered = []
    for alert in alerts:
        if alert.get("triggered"):
            continue
        price = current_prices.get(alert["symbol"])
        if price is None:
            continue
        if alert["direction"] == "above" and price >= alert["target_price"]:
            alert["triggered"] = True
            triggered.append(alert)
        elif alert["direction"] == "below" and price <= alert["target_price"]:
            alert["triggered"] = True
            triggered.append(alert)
    return triggered
