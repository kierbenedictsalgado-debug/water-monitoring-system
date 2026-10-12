
# pyright: reportMissingModuleSource=false

import json
import logging
from pathlib import Path

import numpy as np
import pandas as pd
import requests
import tensorflow as tf

from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping
from tensorflow.keras.models import load_model


# ============================================================
# CONFIGURATION
# ============================================================

API_URL = "http://localhost:4000/api/sensor/daily-records"

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "water_lstm_model.keras"
SCALER_PATH = BASE_DIR / "water_scaler.json"

SEQUENCE_LENGTH = 7
MINIMUM_RECORDS = 14
EPOCHS = 100
BATCH_SIZE = 8

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ============================================================
# 1. FETCH HISTORICAL CONSUMPTION DATA
# ============================================================

def fetch_daily_records():
    """Fetch historical daily records from the existing backend."""

    try:
        response = requests.get(API_URL, timeout=15)
        response.raise_for_status()
        payload = response.json()

    except requests.RequestException as error:
        raise RuntimeError(
            f"Could not retrieve daily records from {API_URL}. "
            "Check that your Node.js backend is running on port 4000."
        ) from error

    # Support common API response formats.
    if isinstance(payload, list):
        records = payload

    elif isinstance(payload, dict):
        records = None

        for key in ("records", "data", "dailyRecords", "readings"):
            if isinstance(payload.get(key), list):
                records = payload[key]
                break

        if records is None:
            raise ValueError(
                "The API response does not contain a recognized records "
                "array. Inspect the response from /api/sensor/daily-records."
            )

    else:
        raise ValueError("Unexpected response format from the daily-records API.")

    if not records:
        raise ValueError("No historical consumption records were returned.")

    return records


# ============================================================
# 2. CLEAN AND PREPARE DATA
# ============================================================

def prepare_daily_data(records):
    """
    Convert API records into daily date and consumption values.

    Update the field names below if your API uses different names.
    """

    date_fields = (
        "date",
        "day",
        "readingDate",
        "recordDate",
        "createdAt",
        "timestamp",
    )

    consumption_fields = (
        "consumption",
        "dailyConsumption",
        "waterConsumption",
        "totalConsumption",
        "consumptionLiters",
        "liters",
        "value",
    )

    rows = []

    for record in records:
        if not isinstance(record, dict):
            continue

        date_value = next(
            (record[key] for key in date_fields if record.get(key) is not None),
            None,
        )

        consumption_value = next(
            (
                record[key]
                for key in consumption_fields
                if record.get(key) is not None
            ),
            None,
        )

        if date_value is None or consumption_value is None:
            continue

        try:
            date = pd.to_datetime(date_value, errors="raise").normalize()
            consumption = float(consumption_value)

        except (ValueError, TypeError, OverflowError):
            continue

        if not np.isfinite(consumption) or consumption < 0:
            continue

        rows.append({
            "date": date,
            "consumption": consumption,
        })

    if not rows:
        raise ValueError(
            "No usable date/consumption pairs were found. "
            "Check the actual JSON fields returned by your API and "
            "update date_fields and consumption_fields."
        )

    dataframe = pd.DataFrame(rows)

    # If the API contains multiple records for a date, sum them.
    dataframe = (
        dataframe.groupby("date", as_index=False)["consumption"]
        .sum()
        .sort_values("date")
        .reset_index(drop=True)
    )

    # Do not invent missing daily measurements by filling gaps with zero.
    return dataframe


# ============================================================
# 3. NORMALIZE CONSUMPTION VALUES
# ============================================================

def normalize_values(values):
    """Scale values to the 0–1 range using training data."""

    minimum = float(np.min(values))
    maximum = float(np.max(values))
    scale = maximum - minimum

    if scale == 0:
        scale = 1.0

    normalized = (values - minimum) / scale

    return normalized, minimum, scale


# ============================================================
# 4. CREATE SEQUENCES FOR LSTM
# ============================================================

def create_sequences(values, sequence_length):
    """
    Use the previous seven observations to predict the next observation.
    """

    features = []
    targets = []

    for index in range(sequence_length, len(values)):
        features.append(values[index - sequence_length:index])
        targets.append(values[index])

    X = np.asarray(features, dtype=np.float32).reshape(-1, sequence_length, 1)
    y = np.asarray(targets, dtype=np.float32)

    return X, y


# ============================================================
# 5. BUILD THE LSTM MODEL
# ============================================================

def build_model():
    model = Sequential([
        tf.keras.Input(shape=(SEQUENCE_LENGTH, 1)),
        LSTM(32, return_sequences=True),
        Dropout(0.2),
        LSTM(16),
        Dense(8, activation="relu"),
        Dense(1),
    ])

    model.compile(
        optimizer="adam",
        loss="mean_squared_error",
        metrics=["mae"],
    )

    return model


# ============================================================
# 6. TRAIN AND SAVE THE MODEL
# ============================================================

def train_model():
    logger.info("Retrieving historical daily consumption records...")

    records = fetch_daily_records()
    dataframe = prepare_daily_data(records)

    print("\nHistorical data preview:")
    print(dataframe.tail(10).to_string(index=False))

    print(f"\nUsable daily records: {len(dataframe)}")

    if len(dataframe) < MINIMUM_RECORDS:
        raise ValueError(
            f"At least {MINIMUM_RECORDS} daily records are required by this "
            f"training script; only {len(dataframe)} were found. "
            "Collect more historical data before training."
        )

    # Use a chronological split to avoid training on future observations.
    values = dataframe["consumption"].to_numpy(dtype=np.float32)

    split_index = int(len(values) * 0.8)
    split_index = max(split_index, SEQUENCE_LENGTH + 1)

    if split_index >= len(values):
        raise ValueError("Not enough observations for a training/validation split.")

    # Fit the scaling parameters using training data only.
    training_values = values[:split_index]
    _, minimum, scale = normalize_values(training_values)

    normalized_values = (values - minimum) / scale

    # Training targets must occur before the chronological split.
    X_train, y_train = create_sequences(
        normalized_values[:split_index],
        SEQUENCE_LENGTH,
    )

    # Validation sequences can use preceding historical observations,
    # but their target dates must be after the split.
    X_all, y_all = create_sequences(
        normalized_values,
        SEQUENCE_LENGTH,
    )

    target_indices = np.arange(SEQUENCE_LENGTH, len(values))
    validation_mask = target_indices >= split_index

    X_validation = X_all[validation_mask]
    y_validation = y_all[validation_mask]

    if len(X_train) == 0 or len(X_validation) == 0:
        raise ValueError(
            "Not enough sequences for training and validation. "
            "Collect more daily records."
        )

    print(f"Training sequences: {len(X_train)}")
    print(f"Validation sequences: {len(X_validation)}")

    model = build_model()

    early_stopping = EarlyStopping(
        monitor="val_loss",
        patience=10,
        restore_best_weights=True,
    )

    model.fit(
        X_train,
        y_train,
        validation_data=(X_validation, y_validation),
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        callbacks=[early_stopping],
        shuffle=False,
        verbose=1,
    )

    # Evaluate the model on observations held out from training.
    predictions_scaled = model.predict(X_validation, verbose=0).reshape(-1)

    predictions = predictions_scaled * scale + minimum
    actual = y_validation * scale + minimum

    mae = float(np.mean(np.abs(actual - predictions)))
    rmse = float(np.sqrt(np.mean((actual - predictions) ** 2)))

    model.save(MODEL_PATH)

    with SCALER_PATH.open("w", encoding="utf-8") as file:
        json.dump(
            {
                "minimum": minimum,
                "scale": scale,
                "sequence_length": SEQUENCE_LENGTH,
                "target": "consumption",
            },
            file,
            indent=2,
        )

    print("\nTraining completed.")
    print(f"Model saved to: {MODEL_PATH}")
    print(f"Scaler saved to: {SCALER_PATH}")
    print(f"Validation MAE: {mae:.4f}")
    print(f"Validation RMSE: {rmse:.4f}")

    print(
        "\nImportant: These metrics are only meaningful when the historical "
        "records and their units are correct. Compare against a baseline "
        "before relying on the LSTM forecasts."
    )


# ============================================================
# 7. PREDICT FROM THE SAVED MODEL
# ============================================================

def forecast_next_days(days=7):
    """
    Forecast multiple days recursively from the saved LSTM model.

    The existing backend must provide the historical daily records.
    """

    if not isinstance(days, int) or not 1 <= days <= 30:
        raise ValueError("days must be an integer between 1 and 30.")

    if not MODEL_PATH.exists() or not SCALER_PATH.exists():
        raise FileNotFoundError(
            "The trained model or scaler is missing. Run train_model.py "
            "successfully before requesting forecasts."
        )

    records = fetch_daily_records()
    dataframe = prepare_daily_data(records)

    with SCALER_PATH.open("r", encoding="utf-8") as file:
        scaler = json.load(file)

    sequence_length = int(scaler["sequence_length"])
    minimum = float(scaler["minimum"])
    scale = float(scaler["scale"])

    if len(dataframe) < sequence_length:
        raise ValueError(
            f"At least {sequence_length} daily records are required to forecast."
        )

    values = dataframe["consumption"].to_numpy(dtype=np.float32)
    normalized = (values - minimum) / scale

    history = list(normalized[-sequence_length:])

    model = load_model(MODEL_PATH)
    forecasts = []

    for day in range(1, days + 1):
        input_sequence = np.asarray(
            history[-sequence_length:],
            dtype=np.float32,
        ).reshape(1, sequence_length, 1)

        predicted_scaled = float(model.predict(input_sequence, verbose=0)[0, 0])
        predicted_consumption = max(0.0, predicted_scaled * scale + minimum)

        forecasts.append({
            "day": day,
            "consumption": round(predicted_consumption, 3),
        })

        # Append the predicted normalized value for the next forecast step.
        history.append(predicted_scaled)

    return {
        "method": "lstm",
        "forecast_days": days,
        "historical_records_used": len(dataframe),
        "forecasts": forecasts,
    }


# ============================================================
# 8. RUN TRAINING WHEN EXECUTED DIRECTLY
# ============================================================

if __name__ == "__main__":
    try:
        train_model()
    except (RuntimeError, ValueError, FileNotFoundError) as error:
        logger.error("%s", error)
        raise SystemExit(1)
