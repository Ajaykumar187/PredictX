import time
import requests


class NSESession:

    BASE_URL = "https://www.nseindia.com"

    HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/138.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json,text/plain,*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.nseindia.com/",
        "Connection": "keep-alive",
    }

    def __init__(self):

        self.session = requests.Session()
        self.session.headers.update(self.HEADERS)

        self.last_refresh = 0

        self.refresh()

    def refresh(self):

        print("Refreshing NSE Session...")

        self.session.get(
            self.BASE_URL,
            timeout=20
        )

        self.last_refresh = time.time()

    def get(self, url, retries=3):

        for attempt in range(retries):

            try:

                if time.time() - self.last_refresh > 300:
                    self.refresh()

                r = self.session.get(
                    url,
                    timeout=20
                )

                if r.status_code == 200:
                    return r

                if r.status_code in (401, 403, 404):

                    print("Refreshing cookies...")

                    self.refresh()

                    continue

            except requests.RequestException:

                self.refresh()

        raise Exception(
            f"Unable to fetch {url}"
        )