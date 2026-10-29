
from datetime import date, datetime, timedelta

import numpy as np
from sklearn.ensemble import RandomForestRegressor

LAG_DAYS = 7
MINIMUM_RECORDS = 15


def _get_date(record):
    for key in (
        "date",
        "day",
        "recordDate",
        "readingDate",
        "createdAt",
        "created_at",
    ):
        value = record.get(key)

        if not value:
            continue

        try:
            return date.fromisoformat(str(value)[:10])
        except (ValueError, TypeError):
            try:
                return datetime.fromisoformat(
                    str(value).replace("Z", "+00:00")
                ).date()
            except (ValueError, TypeError):
                continue

    return None


def _get_consumption(record):
    for key in (
        "consumption",
        "dailyConsumption",
        "daily_consumption",
        "totalConsumption",
    ):
        value = record.get(key)

        if value is None:
            continue

        try:
            number = float(value)
        except (TypeError, ValueError):
            continue

        if np.isfinite(number) and number >= 0:
            return number

    return None


def _prepare_records(records):
    """Validate records and combine duplicate dates consistently."""
    grouped = {}

    for record in records or []:
        if not isinstance(record, dict):
            continue

        record_date = _get_date(record)
        consumption = _get_consumption(record)

        if record_date is None or consumption is None:
            continue

        grouped.setdefault(record_date, []).append(consumption)

    return [
        (record_date, float(np.mean(values)))
        for record_date, values in sorted(grouped.items())
    ]


def _features(history, target_date):
    if len(history) < LAG_DAYS:
        raise ValueError("Seven previous daily observations are required.")

    return [
        *history[-LAG_DAYS:],
        target_date.weekday(),
        target_date.month,
    ]


def forecast_random_forest(records, days=7):
    """Train a Random Forest model and forecast future daily consumption."""
    if not isinstance(days, int) or not 1 <= days <= 30:
        raise ValueError("days must be an integer between 1 and 30.")

    daily = _prepare_records(records)

    if len(daily) < MINIMUM_RECORDS:
        raise ValueError(
            f"At least {MINIMUM_RECORDS} valid daily records are required "
            "for Random Forest forecasting."
        )

    dates = [item[0] for item in daily]
    values = [item[1] for item in daily]

    X, y = [], []

    for index in range(LAG_DAYS, len(values)):
        X.append(_features(values[:index], dates[index]))
        y.append(values[index])

    if not X:
        raise ValueError("Insufficient data to train Random Forest.")

    model = RandomForestRegressor(
        n_estimators=200,
        random_state=42,
        min_samples_leaf=2,
        n_jobs=-1,
    )

    model.fit(np.asarray(X, dtype=float), np.asarray(y, dtype=float))

    history = values.copy()
    last_date = dates[-1]
    forecasts = []

    for step in range(1, days + 1):
        target_date = last_date + timedelta(days=step)
        row = _features(history, target_date)

        prediction = float(model.predict([row])[0])

        if not np.isfinite(prediction):
            raise ValueError("Random Forest returned an invalid prediction.")

        prediction = max(0.0, prediction)

        forecasts.append({
            "date": target_date.isoformat(),
            "predictedConsumption": round(prediction, 6),
        })

        history.append(prediction)

    return {
        "method": "random_forest",
        "model": "RandomForestRegressor",
        "trainingRecords": len(values),
        "trainingSamples": len(X),
        "days": days,
        "forecasts": forecasts,
    }
