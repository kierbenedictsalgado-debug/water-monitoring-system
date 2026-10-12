
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from forecast import get_daily_records

app = FastAPI(title="Water Consumption Forecasting API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ForecastRequest(BaseModel):
    days: int = Field(default=7, ge=1, le=30)


@app.get("/")
def home():
    return {
        "status": "running",
        "service": "Water Consumption Forecasting API"
    }


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/daily-records")
def daily_records():
    records = get_daily_records()

    return {
        "count": len(records),
        "records": records
    }


@app.post("/forecast")
def create_forecast(request: ForecastRequest):
    records = get_daily_records()

    if not records:
        raise HTTPException(
            status_code=400,
            detail="No consumption records are available for forecasting."
        )

    try:
        values = [
            float(record["consumption"])
            for record in records
            if record.get("consumption") is not None
        ]
    except (TypeError, ValueError, KeyError):
        raise HTTPException(
            status_code=500,
            detail="Consumption records contain invalid values."
        )

    if not values:
        raise HTTPException(
            status_code=400,
            detail="No valid consumption values are available."
        )

    # Baseline forecast: average of the latest seven available values.
    recent_values = values[-7:]
    average = sum(recent_values) / len(recent_values)

    forecasts = []

    for day in range(1, request.days + 1):
        forecasts.append({
            "day": day,
            "consumption": round(average, 3)
        })

    return {
        "method": "moving_average_baseline",
        "forecast_days": request.days,
        "historical_records_used": len(recent_values),
        "average_consumption": round(average, 3),
        "forecasts": forecasts,
        "message": (
            "Baseline estimates only. A trained LSTM model "
            "is not being used by this endpoint."
        )
    }
