
from datetime import date
from math import sqrt
from statistics import mean

import requests


BACKEND_URL = "http://localhost:4000/api/sensor/daily-records"
WINDOW = 7
SEASONAL_PERIOD = 7


def _normalize_daily_records(records):
    """Return valid chronological daily records, one per date."""
    grouped = {}

    for record in records or []:
        if not isinstance(record, dict):
            continue

        raw_date = (
            record.get("date")
            or record.get("billingDate")
            or record.get("day")
        )

        raw_value = (
            record.get("consumption")
            if record.get("consumption") is not None
            else record.get(
                "dailyConsumption",
                record.get(
                    "daily_consumption",
                    record.get("waterConsumption", record.get("value")),
                ),
            )
        )

        try:
            date_key = str(raw_date)[:10]
            date.fromisoformat(date_key)
            consumption = float(raw_value)
        except (ValueError, TypeError):
            continue

        if consumption < 0:
            continue

        import math

        if not math.isfinite(consumption):
            continue

        grouped.setdefault(date_key, []).append(consumption)

    return [
        {
            "date": date_key,
            "consumption": round(mean(values), 6),
        }
        for date_key, values in sorted(grouped.items())
    ]


def get_daily_records():
    """Fetch actual daily records from the Node.js backend."""
    try:
        response = requests.get(BACKEND_URL, timeout=5)
        response.raise_for_status()
        payload = response.json()

        if isinstance(payload, list):
            records = payload
        elif isinstance(payload, dict):
            records = (
                payload.get("records")
                or payload.get("data")
                or payload.get("dailyRecords")
                or payload.get("daily_records")
                or []
            )
        else:
            return []

        return _normalize_daily_records(records)

    except (requests.RequestException, ValueError) as error:
        print(f"Could not retrieve daily records: {error}")
        return []


def _validate_history(history):
    return _normalize_daily_records(history)


def moving_average_forecast(history, days=7, window=7):
    if not isinstance(days, int) or not 1 <= days <= 30:
        raise ValueError("days must be between 1 and 30.")

    if not isinstance(window, int) or window < 1:
        raise ValueError("window must be a positive integer.")

    records = _validate_history(history)
    values = [record["consumption"] for record in records]

    if not values:
        return []

    working_values = values.copy()
    predictions = []

    for _ in range(days):
        prediction = max(0.0, mean(working_values[-window:]))
        predictions.append(round(prediction, 6))
        working_values.append(prediction)

    return predictions


def naive_forecast(history, days=7):
    records = _validate_history(history)

    if not records:
        return []

    latest = records[-1]["consumption"]
    return [max(0.0, latest)] * days


def seasonal_naive_forecast(history, days=7, season=7):
    records = _validate_history(history)

    if not records:
        return []

    values = [record["consumption"] for record in records]

    if len(values) < season:
        raise ValueError(
            f"Seasonal-naive forecasting requires at least {season} records."
        )

    pattern = values[-season:]

    return [
        max(0.0, pattern[index % season])
        for index in range(days)
    ]


def _calculate_metrics(actual_values, predicted_values):
    if (
        not actual_values
        or len(actual_values) != len(predicted_values)
    ):
        raise ValueError(
            "Actual and predicted values must have equal nonzero lengths."
        )

    errors = [
        actual - predicted
        for actual, predicted in zip(actual_values, predicted_values)
    ]

    return {
        "mae": round(mean(abs(error) for error in errors), 6),
        "rmse": round(sqrt(mean(error ** 2 for error in errors)), 6),
    }


def evaluate_forecasts(history, window=7, season=7):
    """Compare baseline methods on the same walk-forward test dates."""
    records = _validate_history(history)

    if len(records) < max(window, season) + 1:
        raise ValueError(
            f"At least {max(window, season) + 1} valid daily records "
            "are required for baseline evaluation."
        )

    values = [record["consumption"] for record in records]
    dates = [record["date"] for record in records]
    start_index = max(window, season)

    actual_by_method = {
        "naive": [],
        "seasonal_naive": [],
        "moving_average": [],
    }

    predicted_by_method = {
        "naive": [],
        "seasonal_naive": [],
        "moving_average": [],
    }

    evaluation_records = []

    for index in range(start_index, len(records)):
        previous = values[:index]
        actual = values[index]

        predictions = {
            "naive": previous[-1],
            "seasonal_naive": previous[-season],
            "moving_average": mean(previous[-window:]),
        }

        for method, prediction in predictions.items():
            actual_by_method[method].append(actual)
            predicted_by_method[method].append(max(0.0, prediction))

        evaluation_records.append({
            "date": dates[index],
            "actual": round(actual, 6),
            "predictions": {
                method: round(max(0.0, prediction), 6)
                for method, prediction in predictions.items()
            },
        })

    metrics = {}

    for method in predicted_by_method:
        metrics[method] = {
            **_calculate_metrics(
                actual_by_method[method],
                predicted_by_method[method],
            ),
            "evaluationRecords": len(predicted_by_method[method]),
        }

    return {
        "method": "walk_forward_backtesting",
        "evaluationRecords": len(evaluation_records),
        "trainingWindow": start_index,
        "metrics": metrics,
        "records": evaluation_records,
    }


def evaluate_forecast(history, window=7):
    """Backward-compatible moving-average evaluation."""
    comparison = evaluate_forecasts(
        history,
        window=window,
        season=SEASONAL_PERIOD,
    )

    moving_metrics = comparison["metrics"]["moving_average"]
    records = []

    for record in comparison["records"]:
        predicted = record["predictions"]["moving_average"]
        actual = record["actual"]

        records.append({
            "date": record["date"],
            "actual": actual,
            "predicted": predicted,
            "error": round(actual - predicted, 6),
        })

    return {
        "method": "moving_average_backtesting",
        "evaluation_records": len(records),
        "mae": moving_metrics["mae"],
        "rmse": moving_metrics["rmse"],
        "records": records,
        "comparison": comparison["metrics"],
    }
