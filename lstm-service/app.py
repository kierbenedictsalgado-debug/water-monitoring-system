
from datetime import date, timedelta
from pathlib import Path

import numpy as np
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from forecast import (
    get_daily_records,
    moving_average_forecast,
    evaluate_forecasts,
)
from random_forest import forecast_random_forest
from train_model import forecast_next_days


app = FastAPI(title="Water Consumption Forecasting API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
LSTM_MODEL_PATH = BASE_DIR / "water_lstm_model.keras"
LSTM_SCALER_PATH = BASE_DIR / "water_scaler.json"

LSTM_MINIMUM_RECORDS = 14
RANDOM_FOREST_MINIMUM_RECORDS = 15


# ============================================================
# DATA CLEANING
# ============================================================

def clean_records(records):
    """
    Validate daily consumption records, combine duplicate dates,
    and return the records in chronological order.
    """
    grouped = {}

    for record in records or []:
        if not isinstance(record, dict):
            continue

        record_date = str(record.get("date", ""))[:10]

        try:
            date.fromisoformat(record_date)
            consumption = float(record.get("consumption"))
        except (TypeError, ValueError):
            continue

        if not np.isfinite(consumption) or consumption < 0:
            continue

        grouped.setdefault(record_date, []).append(consumption)

    return [
        {
            "date": record_date,
            "consumption": round(float(np.mean(values)), 6),
        }
        for record_date, values in sorted(grouped.items())
    ]


# ============================================================
# LSTM STATUS
# ============================================================

def get_lstm_status():
    """Check whether the required LSTM model files exist."""
    model_exists = LSTM_MODEL_PATH.is_file()
    scaler_exists = LSTM_SCALER_PATH.is_file()

    missing_files = []

    if not model_exists:
        missing_files.append(LSTM_MODEL_PATH.name)

    if not scaler_exists:
        missing_files.append(LSTM_SCALER_PATH.name)

    if missing_files:
        return {
            "available": False,
            "model": "LSTM",
            "missingFiles": missing_files,
            "message": (
                "LSTM cannot run because its trained model "
                "and matching scaler are required."
            ),
        }

    return {
        "available": False,
        "model": "LSTM",
        "modelFile": LSTM_MODEL_PATH.name,
        "scalerFile": LSTM_SCALER_PATH.name,
        "message": (
            "Model files exist, but LSTM availability requires "
            "a successful prediction."
        ),
    }


# ============================================================
# METRICS
# ============================================================

def calculate_metrics(actual, predicted):
    """Calculate MAE and RMSE for matching observations."""
    if not actual or len(actual) != len(predicted):
        raise ValueError(
            "Actual and predicted values must have matching lengths."
        )

    actual_values = np.asarray(actual, dtype=float)
    predicted_values = np.asarray(predicted, dtype=float)

    if (
        not np.all(np.isfinite(actual_values))
        or not np.all(np.isfinite(predicted_values))
    ):
        raise ValueError("Evaluation values must be finite numbers.")

    errors = actual_values - predicted_values

    return {
        "mae": round(float(np.mean(np.abs(errors))), 6),
        "rmse": round(float(np.sqrt(np.mean(errors ** 2))), 6),
        "evaluationRecords": int(len(errors)),
    }


# ============================================================
# RANDOM FOREST OUTPUT NORMALIZATION
# ============================================================

def normalize_forecast_output(output, start_date, days):
    """
    Convert supported Random Forest output formats into:

    [
        {
            "date": "YYYY-MM-DD",
            "predictedConsumption": 123.456
        }
    ]
    """
    if not isinstance(output, dict):
        raise ValueError(
            "Random Forest returned an invalid response."
        )

    raw_forecasts = output.get("forecasts", [])

    if not isinstance(raw_forecasts, list) or not raw_forecasts:
        raise ValueError(
            "Random Forest returned no forecast values."
        )

    results = []

    for index, item in enumerate(raw_forecasts[:days]):
        if isinstance(item, (int, float, np.number)):
            value = float(item)
            forecast_date = start_date + timedelta(days=index + 1)

        elif isinstance(item, dict):
            raw_value = item.get(
                "predictedConsumption",
                item.get(
                    "predicted_consumption",
                    item.get(
                        "prediction",
                        item.get("consumption"),
                    ),
                ),
            )

            try:
                value = float(raw_value)
            except (TypeError, ValueError):
                continue

            raw_date = item.get("date")

            try:
                forecast_date = (
                    date.fromisoformat(str(raw_date)[:10])
                    if raw_date
                    else start_date + timedelta(days=index + 1)
                )
            except ValueError:
                continue

        else:
            continue

        if not np.isfinite(value) or value < 0:
            continue

        results.append({
            "date": forecast_date.isoformat(),
            "predictedConsumption": round(value, 6),
        })

    if not results:
        raise ValueError(
            "Random Forest produced no valid predictions."
        )

    return results


# ============================================================
# LSTM OUTPUT NORMALIZATION
# ============================================================

def normalize_lstm_output(output, start_date, days):
    """
    Handle the dictionary returned by train_model.forecast_next_days().

    Expected format:

    {
        "method": "lstm",
        "forecast_days": 7,
        "historical_records_used": 14,
        "forecasts": [
            {"day": 1, "consumption": 123.45},
            {"day": 2, "consumption": 124.56}
        ]
    }
    """
    if not isinstance(output, dict):
        raise ValueError(
            "LSTM returned an invalid response. "
            "Expected a dictionary containing forecasts."
        )

    raw_forecasts = output.get("forecasts")

    if not isinstance(raw_forecasts, list) or not raw_forecasts:
        raise ValueError(
            "LSTM returned no forecast values."
        )

    results = []

    for index, item in enumerate(raw_forecasts[:days]):
        if isinstance(item, dict):
            raw_value = item.get(
                "consumption",
                item.get(
                    "predictedConsumption",
                    item.get("prediction"),
                ),
            )

            raw_day = item.get("day")

            try:
                day_number = int(raw_day) if raw_day is not None else index + 1
                value = float(raw_value)
            except (TypeError, ValueError, OverflowError):
                continue

            if day_number < 1:
                continue

            forecast_date = start_date + timedelta(days=day_number)

        elif isinstance(item, (int, float, np.number)):
            try:
                value = float(item)
            except (TypeError, ValueError, OverflowError):
                continue

            forecast_date = start_date + timedelta(days=index + 1)

        else:
            continue

        if not np.isfinite(value) or value < 0:
            continue

        results.append({
            "date": forecast_date.isoformat(),
            "predictedConsumption": round(value, 6),
        })

    if not results:
        raise ValueError(
            "LSTM did not produce any valid predictions."
        )

    return results


# ============================================================
# RANDOM FOREST WALK-FORWARD EVALUATION
# ============================================================

def evaluate_random_forest(records, minimum_training_days=15):
    """Evaluate Random Forest with expanding-window predictions."""
    actual = []
    predicted = []
    comparisons = []

    for index in range(minimum_training_days, len(records)):
        training = records[:index]
        test = records[index]

        try:
            rf_output = forecast_random_forest(
                training,
                days=1,
            )

            forecast_values = normalize_forecast_output(
                rf_output,
                date.fromisoformat(training[-1]["date"]),
                1,
            )

            prediction = forecast_values[0]["predictedConsumption"]
            observed = float(test["consumption"])

            actual.append(observed)
            predicted.append(prediction)

            comparisons.append({
                "date": test["date"],
                "actual": round(observed, 6),
                "predicted": round(prediction, 6),
                "error": round(observed - prediction, 6),
            })

        except (
            ValueError,
            TypeError,
            KeyError,
            OverflowError,
            OSError,
        ) as error:
            print(
                "Random Forest evaluation fold skipped:",
                test["date"],
                str(error),
            )

    if not comparisons:
        return {
            "available": False,
            "method": "random_forest_walk_forward",
            "reason": (
                "No valid Random Forest backtesting comparisons "
                "could be generated."
            ),
            "evaluationRecords": 0,
            "mae": None,
            "rmse": None,
            "records": [],
        }

    return {
        "available": True,
        "method": "random_forest_walk_forward",
        **calculate_metrics(actual, predicted),
        "records": comparisons,
    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "Water Consumption Forecasting API",
    }


# ============================================================
# DAILY RECORDS
# ============================================================

@app.get("/daily-records")
def daily_records():
    records = clean_records(get_daily_records())

    return {
        "records": records,
        "count": len(records),
    }


# ============================================================
# FORECAST
# ============================================================

@app.get("/forecast")
def forecast(days: int = Query(default=7, ge=1, le=30)):
    records = clean_records(get_daily_records())

    if not records:
        raise HTTPException(
            status_code=422,
            detail="No valid daily consumption records are available.",
        )

    last_date = date.fromisoformat(records[-1]["date"])

    output = {
        "ok": True,
        "days": days,
        "historicalRecords": len(records),
        "lastObservedDate": records[-1]["date"],
        "forecasts": {},
        "lstm": get_lstm_status(),
    }

    # --------------------------------------------------------
    # 1. MOVING-AVERAGE BASELINE
    # --------------------------------------------------------
    try:
        values = moving_average_forecast(
            records,
            days=days,
            window=7,
        )

        baseline_forecasts = []

        for index, value in enumerate(list(values)[:days]):
            try:
                prediction = float(value)
            except (TypeError, ValueError):
                continue

            if not np.isfinite(prediction) or prediction < 0:
                continue

            baseline_forecasts.append({
                "date": (
                    last_date + timedelta(days=index + 1)
                ).isoformat(),
                "predictedConsumption": round(prediction, 6),
            })

        output["forecasts"]["moving_average_baseline"] = (
            baseline_forecasts
        )

    except (ValueError, TypeError, KeyError, OverflowError) as error:
        output["forecasts"]["moving_average_baseline"] = []
        output["baselineError"] = str(error)

    # --------------------------------------------------------
    # 2. RANDOM FOREST
    # --------------------------------------------------------
    if len(records) >= RANDOM_FOREST_MINIMUM_RECORDS:
        try:
            rf_output = forecast_random_forest(
                records,
                days=days,
            )

            rf_forecasts = normalize_forecast_output(
                rf_output,
                last_date,
                days,
            )

            output["forecasts"]["random_forest"] = {
                "available": bool(rf_forecasts),
                "method": "random_forest",
                "forecasts": rf_forecasts,
            }

        except (
            ValueError,
            TypeError,
            KeyError,
            OverflowError,
            OSError,
        ) as error:
            output["forecasts"]["random_forest"] = {
                "available": False,
                "method": "random_forest",
                "reason": str(error),
                "forecasts": [],
            }

    else:
        output["forecasts"]["random_forest"] = {
            "available": False,
            "method": "random_forest",
            "reason": (
                f"At least {RANDOM_FOREST_MINIMUM_RECORDS} "
                "valid daily records are required."
            ),
            "forecasts": [],
        }

    # --------------------------------------------------------
    # 3. LSTM
    # --------------------------------------------------------
    if len(records) < LSTM_MINIMUM_RECORDS:
        output["forecasts"]["lstm"] = {
            "available": False,
            "method": "lstm",
            "reason": (
                f"Only {len(records)} valid daily records are available. "
                f"At least {LSTM_MINIMUM_RECORDS} are required "
                "before attempting LSTM inference."
            ),
            "forecasts": [],
        }

    elif not (
        LSTM_MODEL_PATH.is_file()
        and LSTM_SCALER_PATH.is_file()
    ):
        output["forecasts"]["lstm"] = {
            "available": False,
            "method": "lstm",
            "reason": (
                "The trained LSTM model or matching scaler is missing. "
                "Train the model before forecasting."
            ),
            "forecasts": [],
        }

    else:
        try:
            # IMPORTANT:
            # forecast_next_days() returns a dictionary, not a list.
            lstm_output = forecast_next_days(
                days=days,
                records=records,
            )

            lstm_forecasts = normalize_lstm_output(
                lstm_output,
                last_date,
                days,
            )

            output["forecasts"]["lstm"] = {
                "available": True,
                "method": "lstm",
                "forecasts": lstm_forecasts,
                "message": "LSTM predictions generated successfully.",
            }

            output["lstm"] = {
                "available": True,
                "model": "LSTM",
                "modelFile": LSTM_MODEL_PATH.name,
                "scalerFile": LSTM_SCALER_PATH.name,
                "message": "LSTM generated valid forecasts.",
            }

        except Exception as error:
            # Never report the model as available after failed inference.
            output["forecasts"]["lstm"] = {
                "available": False,
                "method": "lstm",
                "reason": str(error),
                "forecasts": [],
            }

            output["lstm"] = {
                "available": False,
                "model": "LSTM",
                "message": "LSTM prediction failed.",
                "reason": str(error),
            }

    # --------------------------------------------------------
    # 4. SELECT THE ACTIVE FORECASTING METHOD
    # Priority: LSTM, Random Forest, moving-average baseline.
    # --------------------------------------------------------
    lstm_result = output["forecasts"].get("lstm", {})
    rf_result = output["forecasts"].get("random_forest", {})
    baseline_result = output["forecasts"].get(
        "moving_average_baseline",
        [],
    )

    if (
        lstm_result.get("available")
        and lstm_result.get("forecasts")
    ):
        output["method"] = "lstm"

    elif (
        rf_result.get("available")
        and rf_result.get("forecasts")
    ):
        output["method"] = "random_forest"

    elif baseline_result:
        output["method"] = "moving_average_baseline"

    else:
        raise HTTPException(
            status_code=422,
            detail="No valid forecast could be generated.",
        )

    output["message"] = (
        f"Selected forecasting method: {output['method']}."
    )

    return output


# ============================================================
# MODEL EVALUATION
# ============================================================

@app.get("/evaluate")
def evaluate():
    records = clean_records(get_daily_records())
    lstm_status = get_lstm_status()

    # --------------------------------------------------------
    # INSUFFICIENT DATA
    # --------------------------------------------------------
    if len(records) < 8:
        return {
            "ok": False,
            "status": "insufficient_data",
            "message": (
                "At least 8 valid daily records are required "
                "for baseline backtesting."
            ),
            "historicalRecords": len(records),
            "baselineEvaluation": {
                "available": False,
                "method": "moving_average_baseline",
                "evaluationRecords": 0,
                "mae": None,
                "rmse": None,
            },
            "randomForestEvaluation": {
                "available": False,
                "reason": (
                    "More daily records are needed for "
                    "Random Forest walk-forward evaluation."
                ),
                "evaluationRecords": 0,
                "mae": None,
                "rmse": None,
            },
            "lstmEvaluation": {
                **lstm_status,
                "available": False,
                "reason": (
                    "Insufficient daily records for evaluation. "
                    "No LSTM metrics are reported."
                ),
                "evaluationRecords": 0,
                "mae": None,
                "rmse": None,
            },
        }

    # --------------------------------------------------------
    # BASELINE EVALUATION
    # --------------------------------------------------------
    try:
        baseline = evaluate_forecasts(
            records,
            window=7,
            season=7,
        )

        metrics = baseline.get("metrics", {})
        moving_metrics = metrics.get("moving_average", {})
        naive_metrics = metrics.get("naive", {})
        seasonal_metrics = metrics.get("seasonal_naive", {})

        baseline_result = {
            "available": moving_metrics.get("mae") is not None,
            "method": baseline.get(
                "method",
                "walk_forward_backtesting",
            ),
            "evaluationRecords": moving_metrics.get(
                "evaluationRecords",
                baseline.get("evaluationRecords", 0),
            ),
            "mae": moving_metrics.get("mae"),
            "rmse": moving_metrics.get("rmse"),
            "comparison": {
                "naive": naive_metrics,
                "seasonal_naive": seasonal_metrics,
                "moving_average": moving_metrics,
            },
            "records": baseline.get("records", []),
        }

    except (
        ValueError,
        TypeError,
        KeyError,
        OverflowError,
    ) as error:
        baseline_result = {
            "available": False,
            "method": "moving_average_baseline",
            "reason": str(error),
            "evaluationRecords": 0,
            "mae": None,
            "rmse": None,
        }

    # --------------------------------------------------------
    # RANDOM FOREST EVALUATION
    # --------------------------------------------------------
    if len(records) <= RANDOM_FOREST_MINIMUM_RECORDS:
        rf_result = {
            "available": False,
            "method": "random_forest_walk_forward",
            "reason": (
                "More daily records are required for "
                "Random Forest walk-forward evaluation."
            ),
            "evaluationRecords": 0,
            "mae": None,
            "rmse": None,
            "records": [],
        }

    else:
        rf_result = evaluate_random_forest(records)

    # --------------------------------------------------------
    # LSTM EVALUATION
    # --------------------------------------------------------
    # Model availability is not the same as validated accuracy.
    # Do not report LSTM MAE/RMSE without actual LSTM backtesting.
    lstm_result = {
        **lstm_status,
        "available": False,
        "reason": (
            "LSTM walk-forward evaluation has not been implemented. "
            "No LSTM evaluation metrics are reported."
        ),
        "evaluationRecords": 0,
        "mae": None,
        "rmse": None,
    }

    return {
        "ok": True,
        "status": "evaluation_completed_with_available_models",
        "historicalRecords": len(records),
        "baselineEvaluation": baseline_result,
        "randomForestEvaluation": rf_result,
        "lstmEvaluation": lstm_result,
    }
