
import { useEffect, useMemo, useState } from "react";
import {
  Droplets,
  CalendarDays,
  Target,
  Lightbulb,
  ShieldAlert,
  ChartNoAxesCombined,
  TrendingUp,
  Info,
} from "lucide-react";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

import "./Forecasting.css";

const API = "http://localhost:4000";
const FORECAST_API = "http://127.0.0.1:8000";
const TARGET_KEY = "waterMonthlyTarget";

const HORIZON_OPTIONS = [
  { label: "Next Day", value: "1" },
  { label: "Next 7 Days", value: "7" },
  { label: "Next 14 Days", value: "14" },
  { label: "Next 30 Days", value: "30" },
];

function getNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getDateKey(value) {
  if (!value) return "";

  const text = String(value);

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getMonthKey(record) {
  const value =
    record.billingMonth ||
    record.monthKey ||
    record.month ||
    record.billingDate ||
    record.date;

  if (!value) return "";

  const text = String(value);

  if (/^\d{4}-\d{2}$/.test(text)) return text;

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text.slice(0, 7);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
}

function getArray(payload) {
  if (Array.isArray(payload)) return payload;

  for (const key of [
    "records",
    "data",
    "readings",
    "history",
    "dailyRecords",
    "daily_records",
  ]) {
    if (Array.isArray(payload?.[key])) {
      return payload[key];
    }
  }

  return [];
}

function formatNumber(value, digits = 2) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return "—";
  }

  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatMonth(monthKey) {
  if (!monthKey) return "";

  const date = new Date(`${monthKey}-02T12:00:00`);

  return Number.isNaN(date.getTime())
    ? monthKey
    : date.toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      });
}

function formatDay(dateKey) {
  if (!dateKey) return "";

  const date = new Date(`${dateKey}T12:00:00`);

  return Number.isNaN(date.getTime())
    ? dateKey
    : date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
}

function getForecastDate(record, index, lastHistoryDate) {
  const rawDate =
    record?.date ||
    record?.forecast_date ||
    record?.timestamp ||
    record?.ds;

  if (rawDate) {
    const key = getDateKey(rawDate);
    if (key) return key;
  }

  if (lastHistoryDate) {
    const date = new Date(`${lastHistoryDate}T12:00:00`);

    if (!Number.isNaN(date.getTime())) {
      date.setDate(date.getDate() + index + 1);
      return getDateKey(date);
    }
  }

  return "";
}

// Only display predictions from a model explicitly reported as available.
// Never substitute moving-average baseline predictions for an inactive model.
function normalizeForecasts(result, horizon, lastHistoryDate) {
  const groups = result?.forecasts;

  if (!groups || typeof groups !== "object") {
    return { forecasts: [], method: "" };
  }

  const candidates = [
    {
      key: "random_forest",
      method: "random_forest",
      model: groups.random_forest,
    },
    {
      key: "lstm",
      method: "lstm",
      model: groups.lstm,
    },
  ];

  const selected = candidates.find(({ model }) => {
    if (!model || model.available !== true) return false;

    const items = Array.isArray(model)
      ? model
      : model.forecasts;

    return Array.isArray(items) && items.length > 0;
  });

  if (!selected) {
    return { forecasts: [], method: "" };
  }

  const rawForecasts = Array.isArray(selected.model)
    ? selected.model
    : selected.model.forecasts;

  const normalized = rawForecasts
    .map((record, index) => {
      const item =
        typeof record === "number"
          ? { consumption: record }
          : record;

      const predicted = getNumber(
        item?.predictedConsumption ??
          item?.predicted_consumption ??
          item?.prediction ??
          item?.consumption ??
          item?.predicted ??
          item?.value
      );

      const dateKey = getForecastDate(
        item,
        index,
        lastHistoryDate
      );

      return {
        dateKey,
        date: formatDay(dateKey),
        predicted,
      };
    })
    .filter(
      (record) =>
        record.dateKey &&
        record.predicted !== null &&
        record.predicted >= 0
    )
    .slice(0, Number(horizon));

  return {
    forecasts: normalized,
    method: normalized.length ? selected.method : "",
  };
}

function getMethodLabel(method) {
  const normalized = String(method || "").toLowerCase();

  if (normalized === "lstm") return "LSTM";

  if (normalized === "random_forest") {
    return "Random Forest";
  }

  return method || "Not available";
}

async function readJsonResponse(response, label) {
  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error(`${label} returned an invalid JSON response.`);
  }

  if (!response.ok) {
    throw new Error(
      result?.detail ||
        result?.message ||
        `${label} returned HTTP ${response.status}.`
    );
  }

  if (result?.ok === false) {
    throw new Error(
      result?.detail ||
        result?.message ||
        `${label} reported that the request failed.`
    );
  }

  return result;
}

function normalizeEvaluation(result) {
  const candidates = [
    {
      data: result?.randomForestEvaluation,
      method: "random_forest",
    },
    {
      data: result?.baselineEvaluation,
      method: "moving_average_baseline",
    },
    {
      data: result?.lstmEvaluation,
      method: "lstm",
    },
    {
      data: result?.random_forest_evaluation,
      method: "random_forest",
    },
    {
      data: result?.baseline_evaluation,
      method: "moving_average_baseline",
    },
    {
      data: result?.lstm_evaluation,
      method: "lstm",
    },
    {
      data: result,
      method: result?.method || "",
    },
  ];

  const selected = candidates.find(({ data }) => {
    return (
      data &&
      data.available !== false &&
      getNumber(data.mae) !== null &&
      getNumber(data.rmse) !== null
    );
  });

  if (!selected) {
    const reasons = candidates
      .map(({ data }) => data?.reason || data?.message)
      .filter(Boolean);

    return {
      count: 0,
      mae: null,
      rmse: null,
      method: "",
      error:
        reasons[0] ||
        result?.message ||
        "Evaluation is unavailable until sufficient historical data exists.",
      loading: false,
    };
  }

  return {
    count:
      getNumber(
        selected.data.evaluationRecords ??
          selected.data.records_evaluated ??
          selected.data.count ??
          selected.data.n
      ) ?? 0,
    mae: getNumber(selected.data.mae),
    rmse: getNumber(selected.data.rmse),
    method: selected.data.method || selected.method,
    error: "",
    loading: false,
  };
}

export default function Forecasting() {
  const [horizon, setHorizon] = useState("7");

  const [target, setTarget] = useState(
    () => localStorage.getItem(TARGET_KEY) || "250"
  );

  const [targetDraft, setTargetDraft] = useState(
    () => localStorage.getItem(TARGET_KEY) || "250"
  );

  const [editingTarget, setEditingTarget] = useState(false);
  const [showChart, setShowChart] = useState(true);

  const [monthlyRecords, setMonthlyRecords] = useState([]);
  const [dailyRecords, setDailyRecords] = useState([]);
  const [forecasts, setForecasts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState("");
  const [forecastError, setForecastError] = useState("");
  const [modelStatus, setModelStatus] = useState("Checking models");
  const [forecastMethod, setForecastMethod] = useState("");
  const [historicalRecordsUsed, setHistoricalRecordsUsed] =
    useState(null);

  const [evaluation, setEvaluation] = useState({
    count: 0,
    mae: null,
    rmse: null,
    method: "",
    error: "",
    loading: false,
  });

  // Load actual monthly and daily records.
  useEffect(() => {
    let active = true;

    async function loadRecords() {
      try {
        const [monthlyResult, dailyResult] =
          await Promise.allSettled([
            fetch(`${API}/api/sensor/records`),
            fetch(`${API}/api/sensor/daily-records`),
          ]);

        const errors = [];

        async function readResult(result, label) {
          if (result.status !== "fulfilled") {
            errors.push(
              `Cannot connect to ${label}. Check the Node.js backend.`
            );
            return [];
          }

          if (!result.value.ok) {
            errors.push(
              `${label} returned HTTP ${result.value.status}.`
            );
            return [];
          }

          try {
            return getArray(await result.value.json());
          } catch {
            errors.push(`Could not read ${label} records.`);
            return [];
          }
        }

        const monthly = await readResult(
          monthlyResult,
          "monthly consumption endpoint"
        );

        const daily = await readResult(
          dailyResult,
          "daily consumption endpoint"
        );

        const monthlyMap = new Map();

        monthly.forEach((record, index) => {
          const month = getMonthKey(record);
          const consumption = getNumber(record.consumption);

          if (
            month &&
            consumption !== null &&
            consumption >= 0
          ) {
            monthlyMap.set(month, {
              id: record.id || `monthly-${index}`,
              date: month,
              month: formatMonth(month),
              consumption,
            });
          }
        });

        const normalizedMonthly = [...monthlyMap.values()].sort(
          (a, b) => a.date.localeCompare(b.date)
        );

        const dailyMap = new Map();

        daily.forEach((record, index) => {
          const date = getDateKey(
            record.date ||
              record.timestamp ||
              record.createdAt ||
              record.created_at ||
              record.billingDate
          );

          const consumption = getNumber(
            record.consumption ??
              record.dailyConsumption ??
              record.daily_consumption
          );

          if (
            date &&
            consumption !== null &&
            consumption >= 0
          ) {
            dailyMap.set(date, {
              id: record.id || `daily-${index}`,
              date,
              consumption,
            });
          }
        });

        const normalizedDaily = [...dailyMap.values()].sort(
          (a, b) => a.date.localeCompare(b.date)
        );

        if (!active) return;

        setMonthlyRecords(normalizedMonthly);
        setDailyRecords(normalizedDaily);
        setDataError(errors.join(" "));
      } catch (error) {
        if (active) {
          setDataError(
            error.message || "Unable to load consumption records."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadRecords();

    const interval = window.setInterval(loadRecords, 5000);
    const handleStorage = () => loadRecords();

    window.addEventListener("storage", handleStorage);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // Show forecasts only when Random Forest or LSTM is genuinely available.
  useEffect(() => {
    let active = true;

    async function loadForecast() {
      setForecasts([]);
      setForecastMethod("");
      setHistoricalRecordsUsed(null);
      setForecastError("");

      if (!dailyRecords.length) {
        setModelStatus("No forecast available");
        setForecastError(
          "No daily consumption history is available yet."
        );
        return;
      }

      setModelStatus("Checking models");

      try {
        const response = await fetch(
          `${FORECAST_API}/forecast?days=${Number(horizon)}`
        );

        const result = await readJsonResponse(
          response,
          "Forecast service"
        );

        if (!active) return;

        const lastHistoryDate =
          getDateKey(result?.lastObservedDate) ||
          dailyRecords[dailyRecords.length - 1]?.date ||
          "";

        const normalized = normalizeForecasts(
          result,
          horizon,
          lastHistoryDate
        );

        setHistoricalRecordsUsed(
          getNumber(
            result?.historicalRecords ??
              result?.historical_records_used ??
              result?.history_records
          ) ?? dailyRecords.length
        );

        if (!normalized.forecasts.length) {
          setForecasts([]);
          setForecastMethod("");
          setModelStatus("No forecast available");
          setForecastError(
            "No trained Random Forest or LSTM model is currently returning predictions. Forecasts will appear automatically when a model is available."
          );
          return;
        }

        setForecasts(normalized.forecasts);
        setForecastMethod(normalized.method);
        setForecastError("");

        setModelStatus(
          normalized.method === "lstm"
            ? "LSTM Connected"
            : "Random Forest Connected"
        );
      } catch (error) {
        if (!active) return;

        setForecasts([]);
        setForecastMethod("");
        setModelStatus("Forecast service unavailable");
        setForecastError(
          error.message ||
            "Cannot connect to the Python forecasting service."
        );
      }
    }

    loadForecast();

    return () => {
      active = false;
    };
  }, [horizon, dailyRecords]);

  // Request actual evaluation metrics; do not invent missing values.
  useEffect(() => {
    let active = true;

    async function evaluateHistory() {
      if (!dailyRecords.length) {
        setEvaluation({
          count: 0,
          mae: null,
          rmse: null,
          method: "",
          error: "No daily history is available to evaluate.",
          loading: false,
        });
        return;
      }

      setEvaluation((previous) => ({
        ...previous,
        loading: true,
        error: "",
      }));

      try {
        const response = await fetch(`${FORECAST_API}/evaluate`);
        const result = await readJsonResponse(
          response,
          "Evaluation service"
        );

        if (!active) return;

        setEvaluation(normalizeEvaluation(result));
      } catch (error) {
        if (!active) return;

        setEvaluation({
          count: 0,
          mae: null,
          rmse: null,
          method: "",
          error:
            error.message || "Could not calculate evaluation metrics.",
          loading: false,
        });
      }
    }

    evaluateHistory();

    return () => {
      active = false;
    };
  }, [dailyRecords]);

  const predictedTotal = useMemo(() => {
    if (!forecasts.length) return null;

    return forecasts.reduce(
      (total, record) => total + record.predicted,
      0
    );
  }, [forecasts]);

  const chartData = useMemo(() => {
    const history = dailyRecords.slice(-14).map((record) => ({
      date: formatDay(record.date),
      dateKey: record.date,
      historical: record.consumption,
      predicted: null,
    }));

    const forecastRows = forecasts.map((record) => ({
      date: record.date,
      dateKey: record.dateKey,
      historical: null,
      predicted: record.predicted,
    }));

    return [...history, ...forecastRows];
  }, [dailyRecords, forecasts]);

  const numericTarget = Math.max(0, Number(target) || 0);

  const budgetUsed =
    predictedTotal !== null && numericTarget > 0
      ? Math.round((predictedTotal / numericTarget) * 100)
      : 0;

  const remaining =
    predictedTotal === null
      ? null
      : numericTarget - predictedTotal;

  const latestRecord = monthlyRecords.at(-1);

  const averageConsumption = monthlyRecords.length
    ? monthlyRecords.reduce(
        (sum, record) => sum + record.consumption,
        0
      ) / monthlyRecords.length
    : null;

  function saveTarget(event) {
    event.preventDefault();

    const value = Number(targetDraft);

    if (!Number.isFinite(value) || value <= 0) return;

    localStorage.setItem(TARGET_KEY, String(value));
    setTarget(String(value));
    setEditingTarget(false);
  }

  if (loading) {
    return (
      <main className="forecast-page">
        <div className="forecast-loading">
          Loading water consumption records...
        </div>
      </main>
    );
  }

  return (
    <main className="forecast-page">
      <header className="forecast-hero">
        <div className="forecast-hero-icon">
          <ChartNoAxesCombined size={25} />
        </div>

        <div className="forecast-hero-copy">
          <h1>Water Consumption Forecast</h1>
          <p>
            Review your household&apos;s recorded water usage
            and estimated future consumption.
          </p>
        </div>

        <span className="forecast-pill">
          <span />
          {modelStatus}
        </span>
      </header>

      {(dataError || forecastError) && (
        <div className="forecast-message">
          {dataError && (
            <p>
              <strong>Consumption data:</strong> {dataError}
            </p>
          )}

          {forecastError && (
            <p>
              <strong>Forecast:</strong> {forecastError}
            </p>
          )}
        </div>
      )}

      <section className="forecast-top-grid">
        <article className="forecast-summary">
          <span className="forecast-icon blue">
            <Droplets />
          </span>

          <div>
            <small>Predicted Consumption</small>
            <strong>
              {predictedTotal === null
                ? "No data"
                : `${formatNumber(predictedTotal)} L`}
            </strong>
            <p>
              {predictedTotal === null
                ? "A trained model is required"
                : `For the next ${horizon} day(s)`}
            </p>
          </div>
        </article>

        <article className="forecast-summary">
          <span className="forecast-icon green">
            <CalendarDays />
          </span>

          <div className="summary-control">
            <small>Forecast Horizon</small>

            <select
              value={horizon}
              onChange={(event) => setHorizon(event.target.value)}
              aria-label="Forecast period"
            >
              {HORIZON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <p>Choose the prediction period</p>
          </div>
        </article>

        <article className="forecast-summary">
          <span className="forecast-icon purple">
            <Target />
          </span>

          <div>
            <small>Target Monthly Usage</small>

            {editingTarget ? (
              <form className="target-edit" onSubmit={saveTarget}>
                <input
                  type="number"
                  min="1"
                  value={targetDraft}
                  onChange={(event) =>
                    setTargetDraft(event.target.value)
                  }
                  aria-label="Monthly water usage target"
                  required
                />

                <button type="submit">Save</button>

                <button
                  type="button"
                  onClick={() => {
                    setTargetDraft(target);
                    setEditingTarget(false);
                  }}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <strong>{formatNumber(numericTarget, 0)} L</strong>
            )}

            {!editingTarget && (
              <button
                type="button"
                className="text-button"
                onClick={() => setEditingTarget(true)}
              >
                Edit target ✎
              </button>
            )}
          </div>
        </article>
      </section>

      <section className="forecast-panel">
        <div className="forecast-panel-heading">
          <span className="forecast-icon blue">
            <ChartNoAxesCombined />
          </span>

          <div>
            <h2>Daily Forecast</h2>
            <p>
              Actual recorded consumption and predictions from an
              available trained model.
            </p>
          </div>

          <div className="view-toggle">
            <button
              type="button"
              className={showChart ? "active" : ""}
              onClick={() => setShowChart(true)}
            >
              Chart View
            </button>

            <button
              type="button"
              className={!showChart ? "active" : ""}
              onClick={() => setShowChart(false)}
            >
              List View
            </button>
          </div>
        </div>

        {showChart ? (
          chartData.length ? (
            <div className="forecast-chart">
              <ResponsiveContainer width="100%" height={255}>
                <LineChart
                  data={chartData}
                  margin={{
                    top: 10,
                    right: 10,
                    left: 0,
                    bottom: 4,
                  }}
                >
                  <CartesianGrid
                    stroke="#e5eef9"
                    strokeDasharray="3 4"
                  />

                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#6684a9", fontSize: 10 }}
                  />

                  <YAxis
                    tick={{ fill: "#6684a9", fontSize: 10 }}
                    unit=" L"
                    width={48}
                  />

                  <Tooltip
                    formatter={(value, name) => [
                      `${formatNumber(value)} L`,
                      name === "historical"
                        ? "Historical consumption"
                        : "Predicted consumption",
                    ]}
                  />

                  <Legend verticalAlign="bottom" height={28} />

                  <Line
                    type="monotone"
                    dataKey="historical"
                    name="Historical Data"
                    stroke="#2677f6"
                    strokeWidth={2.3}
                    dot={{ r: 2.5 }}
                    connectNulls={false}
                  />

                  {forecasts.length > 0 && (
                    <Line
                      type="monotone"
                      dataKey="predicted"
                      name="Predicted Data"
                      stroke="#8c61ed"
                      strokeWidth={2.3}
                      strokeDasharray="5 4"
                      dot={{ r: 2.5 }}
                      connectNulls={false}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>

              {!forecasts.length && (
                <div className="forecast-empty">
                  No predictions available. The chart will display
                  predictions when a trained model is working.
                  {dailyRecords.length > 0 &&
                    " Actual historical records remain visible above."}
                </div>
              )}
            </div>
          ) : (
            <div className="forecast-empty">
              No historical consumption records are available yet.
              Predictions will appear when a trained model is ready.
            </div>
          )
        ) : (
          <div className="forecast-list">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Predicted Consumption</th>
                  <th>Method</th>
                </tr>
              </thead>

              <tbody>
                {forecasts.map((record, index) => (
                  <tr key={`${record.dateKey}-${index}`}>
                    <td>{record.date}</td>
                    <td>{formatNumber(record.predicted)} L</td>
                    <td>
                      <span className="confidence">
                        {getMethodLabel(forecastMethod)}
                      </span>
                    </td>
                  </tr>
                ))}

                {!forecasts.length && (
                  <tr>
                    <td colSpan="3">
                      No predictions available. A trained Random
                      Forest or LSTM model must return valid forecasts.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="forecast-feature-grid">
        <article className="forecast-panel feature-card">
          <div className="feature-title">
            <span className="forecast-icon purple">
              <Target />
            </span>

            <div>
              <h2>Monthly Water Budget</h2>
              <p>
                Set a monthly target and track your estimated allowance.
              </p>
            </div>
          </div>

          <div className="budget-content">
            <div
              className="budget-ring"
              style={{
                "--budget-progress": `${Math.min(budgetUsed, 100)}%`,
              }}
            >
              <span>
                {predictedTotal === null ? "—" : `${budgetUsed}%`}
              </span>
            </div>

            <div>
              <small>Forecasted usage</small>
              <strong>
                {predictedTotal === null
                  ? "No data"
                  : `${formatNumber(predictedTotal)} L`}
              </strong>

              <small>Monthly target</small>
              <strong>{formatNumber(numericTarget, 0)} L</strong>
            </div>
          </div>

          <div
            className={`budget-remaining ${
              remaining !== null && remaining < 0 ? "over" : ""
            }`}
          >
            <Droplets size={15} />

            {remaining === null
              ? "Forecast allowance unavailable"
              : remaining >= 0
                ? "Estimated remaining allowance"
                : "Above target by"}

            <strong>
              {remaining === null
                ? "—"
                : `${formatNumber(Math.abs(remaining))} L`}
            </strong>
          </div>
        </article>

        <article className="forecast-panel feature-card">
          <div className="feature-title">
            <span className="forecast-icon green">
              <Lightbulb />
            </span>

            <div>
              <h2>Water-Saving Insights</h2>
              <p>
                Suggestions based on available household water usage.
              </p>
            </div>
          </div>

          <div className="insight-row">
            <span className="insight-dot green-dot">
              <TrendingUp />
            </span>

            <div>
              <strong>Review high-use days</strong>
              <p>
                {dailyRecords.length
                  ? "Compare recorded daily consumption to identify higher-use days."
                  : "Daily records will help identify days with higher consumption."}
              </p>
            </div>
          </div>

          <div className="insight-row">
            <span className="insight-dot purple-dot">
              <Droplets />
            </span>

            <div>
              <strong>Set a practical target</strong>
              <p>
                Compare actual consumption with your monthly target.
                Forecast comparisons will be available when predictions work.
              </p>
            </div>
          </div>

          <div className="insight-row">
            <span className="insight-dot amber-dot">
              <ShieldAlert />
            </span>

            <div>
              <strong>Watch for unusual changes</strong>
              <p>
                {latestRecord &&
                averageConsumption !== null &&
                averageConsumption > 0 &&
                latestRecord.consumption > averageConsumption * 1.2
                  ? "Your latest monthly record is more than 20% above your recorded average. Review possible causes."
                  : "Review sudden increases in recorded use to check for leaks or changed routines."}
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="forecast-panel forecast-evaluation">
        <div className="feature-title">
          <span className="forecast-icon purple">%</span>

          <div>
            <h2>Forecast Evaluation</h2>
            <p>
              MAE and RMSE are displayed only when valid evaluation
              metrics are returned by the service.
            </p>
          </div>
        </div>

        <div className="evaluation-grid">
          <div>
            <small>MAE</small>
            <strong>
              {evaluation.loading
                ? "Calculating..."
                : evaluation.mae === null
                  ? "—"
                  : `${formatNumber(evaluation.mae)} L`}
            </strong>
            <p>Mean Absolute Error</p>
          </div>

          <div>
            <small>RMSE</small>
            <strong>
              {evaluation.loading
                ? "Calculating..."
                : evaluation.rmse === null
                  ? "—"
                  : `${formatNumber(evaluation.rmse)} L`}
            </strong>
            <p>Root Mean Squared Error</p>
          </div>

          <div>
            <small>Evaluation method</small>
            <strong>
              {evaluation.method
                ? getMethodLabel(evaluation.method)
                : "Not available"}
            </strong>
            <p>
              {evaluation.count
                ? `${evaluation.count} comparison(s)`
                : "Waiting for valid evaluation data"}
            </p>

            {historicalRecordsUsed !== null && (
              <p>
                Historical records used: {historicalRecordsUsed}
              </p>
            )}
          </div>

          <aside>
            <Info size={17} />
            <p>
              {evaluation.error
                ? evaluation.error
                : evaluation.loading
                  ? "Evaluating historical records..."
                  : evaluation.count
                    ? `Evaluation used ${evaluation.count} historical comparison(s). Lower MAE and RMSE indicate smaller errors.`
                    : "Evaluation results will appear when sufficient valid historical data is available."}
            </p>
          </aside>
        </div>
      </section>

      <p className="forecast-footer">
        Forecasts are estimates based on available historical records.
        Predictions are hidden when a trained forecasting model is
        unavailable. Evaluation metrics must come from actual model
        evaluation and must not be interpreted as LSTM performance unless
        the LSTM was specifically evaluated.
      </p>
    </main>
  );
}
