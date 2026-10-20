
from datetime import date
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from forecast import (
    evaluate_forecast,
    get_daily_records,
    moving_average_forecast,
)

app = FastAPI(
    title="Water Consumption Forecasting API",
    description="Baseline water consumption forecasting and evaluation.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class HistoryRecord(BaseModel):
    date: str
    consumption: float = Field(ge=0)


class ForecastRequest(BaseModel):
    days: int = Field(default=7, ge=1, le=90)
    history: Optional[list[HistoryRecord]] = None


def get_history(request_history):
    if request_history is not None:
        records = [
            record.model_dump()
            for record in request_history
        ]
    else:
        records = get_daily_records()

    records.sort(key=lambda item: item["date"])
    return records


@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "Water Consumption Forecasting API is running.",
        "endpoints": ["/forecast", "/evaluate", "/health"],
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/daily-records")
def daily_records():
    return {"records": get_daily_records()}


@app.post("/forecast")
def forecast(request: ForecastRequest):
    try:
        history = get_history(request.history)

        if not history:
            raise HTTPException(
                status_code=400,
                detail=(
                    "No historical consumption records were provided "
                    "or retrieved from the Node.js backend."
                ),
            )

        predictions = moving_average_forecast(
            history,
            days=request.days,
        )

        return {
            "method": "moving_average_baseline",
            "days": request.days,
            "history_records": len(history),
            "forecast": [
                {
                    "day": index + 1,
                    "consumption": value,
                }
                for index, value in enumerate(predictions)
            ],
            "predictions": predictions,
        }

    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Forecast calculation failed: {error}",
        ) from error


@app.post("/evaluate")
def evaluate(request: ForecastRequest):
    try:
        history = get_history(request.history)

        if len(history) < 3:
            raise HTTPException(
                status_code=400,
                detail=(
                    "At least 3 daily historical records are required "
                    "to evaluate the forecast."
                ),
            )

        return evaluate_forecast(history)

    except HTTPException:
        raise
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Evaluation failed: {error}",
        ) from error
