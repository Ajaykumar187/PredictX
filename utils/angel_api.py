import os
import time
import pyotp
from dotenv import load_dotenv
from SmartApi import SmartConnect

load_dotenv()


class AngelAPI:
    def __init__(self):
        self.api_key = os.getenv("ANGEL_API_KEY")
        self.client_id = os.getenv("ANGEL_CLIENT_CODE")
        self.pin = os.getenv("ANGEL_PIN")
        self.totp_secret = os.getenv("ANGEL_TOTP_SECRET")

        missing = [
            name for name, value in [
                ("ANGEL_API_KEY", self.api_key),
                ("ANGEL_CLIENT_CODE", self.client_id),
                ("ANGEL_PIN", self.pin),
                ("ANGEL_TOTP_SECRET", self.totp_secret),
            ] if not value
        ]
        if missing:
            raise Exception(
                "Missing Angel One credentials in your .env file: "
                + ", ".join(missing)
                + ". Copy .env.example to .env and fill these in from your "
                  "Angel One SmartAPI account (https://smartapi.angelbroking.com/)."
            )

        self.smart_api = SmartConnect(api_key=self.api_key, timeout=20)
        self.refresh_token = None

    def login(self):
        last_error = None

        for attempt in range(3):
            try:
                totp = pyotp.TOTP(self.totp_secret).now()

                session = self.smart_api.generateSession(
                    self.client_id,
                    self.pin,
                    totp
                )

                if not session["status"]:
                    raise Exception(session["message"])

                self.refresh_token = session["data"]["refreshToken"]

                self.smart_api.getProfile(self.refresh_token)

                return self.smart_api

            except Exception as e:
                last_error = e
                if attempt < 2:
                    time.sleep(2 * (attempt + 1))

        raise Exception(
            f"Angel One Login Failed after 3 attempts: {last_error}. "
            "This is often Angel One's own servers being slow, not a problem "
            "with your credentials -- wait a bit and try again."
        )