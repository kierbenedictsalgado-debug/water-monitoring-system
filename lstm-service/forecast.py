
from statistics import mean


def get_daily_records():
    """
    Retrieve daily consumption records from the Node.js backend.
    Returns an empty list if the backend is unavailable.
    """
    import requests

    url = "http://127.0.0.1:4000/api/sensor/daily-records"

    try:
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        data = response.json()

        if isinstance(data, list):
            records = data
        elif isinstance(data, dict):
            records = (
                data.get("records")
                or data.get("data")
                or data.get("dailyRecords")
                or []
            )
        else:
            records = []

        normalized = []

        for record in records:
            if not isinstance(record, dict):
                continue

            date = (
                record.get("date")
                or record.get("billingDate")
                or record.get("billingMonth")
                or record.get("day")
            )

            consumption = record.get(
                "consumption",
                record.get("waterConsumption", record.get("value")),
            )

            try:
                consumption = float(consumption)
            except (TypeError, ValueError):
                continue

            if date is None:
                continue

            normalized.append({
                "date": str(date),
                "consumption": consumption,
            })

        normalized.sort(key=lambda item: item["date"])
        return normalized

    except requests.RequestException as error:
        print(f"Could not retrieve daily records: {error}")
        return []


def moving_average_forecast(history, days=7, window=7):
    """
    Generate a simple moving-average baseline forecast.
    Each future day uses the mean of the most recent observations.
    """
    values = [float(record["consumption"]) for record in history]

    if not values:
        return []

    predictions = []
    working_values = values.copy()

    for _ in range(days):
        recent_values = working_values[-window:]
        prediction = mean(recent_values)

        predictions.append(round(max(0.0, prediction), 3))
        working_values.append(prediction)

    return predictions


def evaluate_forecast(history, window=7):
    """
    Walk-forward evaluation: predict each observation using only
    the preceding observations. The first observation is not scored.
    """
    if len(history) < 3:
        raise ValueError("At least 3 historical records are required.")

    actual_values = []
    predicted_values = []
    evaluation_records = []

    for index in range(1, len(history)):
        previous_values = [
            float(record["consumption"])
            for record in history[max(0, index - window):index]
        ]

        prediction = max(0.0, mean(previous_values))
        actual = float(history[index]["consumption"])

        actual_values.append(actual)
        predicted_values.append(prediction)

        evaluation_records.append({
            "date": str(history[index]["date"]),
            "actual": round(actual, 3),
            "predicted": round(prediction, 3),
            "error": round(actual - prediction, 3),
        })

    errors = [
        actual - predicted
        for actual, predicted in zip(actual_values, predicted_values)
    ]

    mae = sum(abs(error) for error in errors) / len(errors)
    rmse = (sum(error ** 2 for error in errors) / len(errors)) ** 0.5

    return {
        "method": "moving_average_backtesting",
        "evaluation_records": len(evaluation_records),
        "mae": round(mae, 3),
        "rmse": round(rmse, 3),
        "records": evaluation_records,
    }
