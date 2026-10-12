
import requests
from fastapi import HTTPException

BACKEND_URL = "http://127.0.0.1:4000/api/sensor/daily-records"


def get_daily_records():
    try:
        response = requests.get(BACKEND_URL, timeout=10)
        response.raise_for_status()
        payload = response.json()

        records = payload.get("records", [])
        cleaned = []

        for record in records:
            date = record.get("date")
            consumption = record.get("consumption")

            if date is None or consumption is None:
                continue

            try:
                value = float(consumption)
            except (TypeError, ValueError):
                continue

            if value >= 0:
                cleaned.append({
                    "date": str(date),
                    "consumption": value
                })

        cleaned.sort(key=lambda item: item["date"])
        return cleaned

    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not retrieve daily records: {exc}"
        )
