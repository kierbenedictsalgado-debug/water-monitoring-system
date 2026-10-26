
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
  if (Array.isArray(payload?.records)) return payload.records;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.readings)) return payload.readings;
  if (Array.isArray(payload?.history)) return payload.history;

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

function getForecastDate(record, index) {
  const rawDate =
    record?.date ||
    record?.forecast_date ||
    record?.timestamp ||
    record?.ds;

  if (rawDate) {
    const key = getDateKey(rawDate);
    if (key) return key;
  }

  // The API currently returns forecast steps without explicit dates.
  // Derive dates from the latest available local calendar date.
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + index + 1);

  return getDateKey(date);
}

function normalizeForecasts(result, horizon, lastHistoryDate) {
  const rawForecasts = Array.isArray(result)
    ? result
    : Array.isArray(result?.forecasts)
      ? result.forecasts
      : Array.isArray(result?.forecast)
        ? result.forecast
        : Array.isArray(result?.predictions)
          ? result.predictions
          : Array.isArray(result?.data)
            ? result.data
            : [];

  return rawForecasts
    .map((record, index) => {
      const item =
        typeof record === "number"
          ? { consumption: record }
          : record;

      const predicted = getNumber(
        item?.predicted_consumption ??
          item?.prediction ??
          item?.consumption ??
          item?.predicted ??
          item?.value
      );

      let dateKey = "";

      const rawDate =
        item?.date ||
        item?.forecast_date ||
        item?.timestamp ||
        item?.ds;

      if (rawDate) {
        dateKey = getDateKey(rawDate);
      }

      if (!dateKey && lastHistoryDate) {
        const date = new Date(`${lastHistoryDate}T12:00:00`);

        if (!Number.isNaN(date.getTime())) {
          date.setDate(date.getDate() + index + 1);
          dateKey = getDateKey(date);
        }
      }

      if (!dateKey) {
        dateKey = getForecastDate(item || {}, index);
      }

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
}

function getMethodLabel(method) {
  const normalized = String(method || "").toLowerCase();

  if (normalized === "lstm") return "LSTM";
  if (
    normalized === "moving_average_baseline" ||
    normalized === "moving_average_backtesting"
  ) {
    return "Moving Average Baseline";
  }

  return method || "Unknown";
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
  const [modelStatus, setModelStatus] = useState("Waiting");
  const [forecastMethod, setForecastMethod] = useState("");
  const [historicalRecordsUsed, setHistoricalRecordsUsed] =
    useState(null);

  // These evaluation values belong to the method returned by /evaluate.
  const [evaluation, setEvaluation] = useState({
    count: 0,
    mae: null,
    rmse: null,
    method: "",
    error: "",
    loading: false,
  });

  // Load monthly and daily consumption from the Node.js backend.
  useEffect(() => {
    let active = true;

    async function loadRecords() {
      try {
        const [monthlyResult, dailyResult] = await Promise.allSettled([
          fetch(`${API}/api/sensor/records`),
          fetch(`${API}/api/sensor/daily-records`),
        ]);

        const errors = [];

        async function readResult(result, label) {
          if (result.status !== "fulfilled") {
            errors.push(
              `Could not connect to the ${label} endpoint. Check that the Node.js backend is running.`
            );
            return [];
          }

          if (!result.value.ok) {
            errors.push(
              `${label} endpoint returned HTTP ${result.value.status}.`
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
          "Monthly consumption"
        );

        const daily = await readResult(
          dailyResult,
          "Daily consumption"
        );

        const monthlyMap = new Map();

        monthly.forEach((record, index) => {
          const month = getMonthKey(record);
          const consumption = getNumber(record.consumption);

          if (month && consumption !== null && consumption >= 0) {
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
              record.billingDate
          );

          const consumption = getNumber(record.consumption);

          if (date && consumption !== null && consumption >= 0) {
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

        setMonthlyRecords((previous) =>
          JSON.stringify(previous) === JSON.stringify(normalizedMonthly)
            ? previous
            : normalizedMonthly
        );

        setDailyRecords((previous) =>
          JSON.stringify(previous) === JSON.stringify(normalizedDaily)
            ? previous
            : normalizedDaily
        );

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

  // Request predictions for the selected forecast horizon.
  useEffect(() => {
    let active = true;

    async function loadForecast() {
      setForecastError("");
      setForecasts([]);
      setForecastMethod("");
      setHistoricalRecordsUsed(null);

      if (!dailyRecords.length) {
        setModelStatus("Waiting");
        setForecastError(
          "No daily consumption history is available yet. Save or collect daily records before requesting a forecast."
        );
        return;
      }

      setModelStatus("Loading");

      try {
        const history = dailyRecords.map((record) => ({
          date: record.date,
          consumption: record.consumption,
        }));

        const response = await fetch(`${FORECAST_API}/forecast`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            days: Number(horizon),
            history,
          }),
        });

        if (!response.ok) {
          let detail = "";

          try {
            const errorBody = await response.json();
            detail =
              errorBody.detail ||
              errorBody.message ||
              errorBody.error ||
              "";
          } catch {
            // The server may return a non-JSON error.
          }

          throw new Error(
            `Forecast service returned HTTP ${response.status}.${detail ? ` ${detail}` : ""}`
          );
        }

        const result = await response.json();
        const lastHistoryDate = history.at(-1)?.date || "";

        const normalized = normalizeForecasts(
          result,
          horizon,
          lastHistoryDate
        );

        if (!active) return;

        setForecasts(normalized);
        setForecastMethod(result.method || "");

        setHistoricalRecordsUsed(
          getNumber(
            result.historical_records_used ??
              result.history_records
          ) ?? history.length
        );

        if (!normalized.length) {
          setModelStatus("Waiting");
          setForecastError(
            "The Python service responded, but it returned no usable predictions. Check its response format and forecasting logic."
          );
          return;
        }

        setModelStatus(
          result.method === "lstm"
            ? "LSTM Connected"
            : result.method === "moving_average_baseline"
              ? "Baseline Connected"
              : "Connected — Method Unknown"
        );
      } catch (error) {
        if (!active) return;

        setForecasts([]);
        setForecastMethod("");
        setModelStatus("Unavailable");
        setForecastError(
          error.message ||
            "Cannot connect to the Python forecasting service. Check that it is running on port 8000."
        );
      }
    }

    loadForecast();

    return () => {
      active = false;
    };
  }, [horizon, dailyRecords]);

  // Evaluate historical records using the method implemented by /evaluate.
  // The current Python implementation evaluates a moving-average baseline.
  useEffect(() => {
    let active = true;

    async function evaluateHistory() {
      if (dailyRecords.length < 3) {
        setEvaluation({
          count: 0,
          mae: null,
          rmse: null,
          method: "",
          error:
            "At least 3 daily records are required for backtesting.",
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
        const history = dailyRecords.map((record) => ({
          date: record.date,
          consumption: record.consumption,
        }));

        const response = await fetch(`${FORECAST_API}/evaluate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            days: 7,
            history,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.detail ||
              result.message ||
              "Unable to evaluate the forecast."
          );
        }

        if (!active) return;

        setEvaluation({
          count: Number(
            result.evaluation_records ??
              result.records_evaluated ??
              result.count
          ) || 0,
          mae: getNumber(result.mae),
          rmse: getNumber(result.rmse),
          method: result.method || result.evaluation_model || "",
          error: "",
          loading: false,
        });
      } catch (error) {
        if (!active) return;

        setEvaluation({
          count: 0,
          mae: null,
          rmse: null,
          method: "",
          error:
            error.message ||
            "Could not calculate evaluation metrics.",
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
          Forecast Overview
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
              <strong>Forecast service:</strong> {forecastError}
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
                ? "—"
                : `${formatNumber(predictedTotal)} L`}
            </strong>
            <p>
              For the{" "}
              {horizon === "1" ? "next day" : `next ${horizon} days`}
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
              Actual recorded household consumption and predictions
              for the selected period.
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
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="forecast-empty">
              No consumption records or predictions yet. Save daily
              consumption records and check that both services are running.
            </div>
          )
        ) : (
          <div className="forecast-list">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Predicted Consumption</th>
                  <th>Status</th>
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
                      No predictions available. Check the Python
                      service and historical records.
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
                  ? "—"
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
                  ? "Compare the highest recorded days with your normal usage."
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
                Compare your forecast with the monthly target you set above.
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
              MAE and RMSE measure historical prediction errors for the
              evaluation method shown below. These are not automatically
              LSTM accuracy metrics.
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
            <small>Forecast method</small>
            <strong>
              {forecastMethod
                ? getMethodLabel(forecastMethod)
                : modelStatus}
            </strong>
            <p>
              {forecasts.length
                ? `${forecasts.length} prediction(s) received`
                : "Waiting for forecast results"}
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
                    ? `${evaluation.method ? `Evaluation method: ${getMethodLabel(evaluation.method)}. ` : ""}MAE and RMSE were calculated using ${evaluation.count} historical backtesting comparison(s). Lower values indicate smaller prediction errors.`
                    : "Backtesting results will appear when enough historical daily records are available."}
            </p>
          </aside>
        </div>
      </section>

      <p className="forecast-footer">
        Forecasts are estimates based on available historical records and
        may differ from actual water consumption. The forecast method is
        displayed above. Evaluation metrics are labeled separately and
        should not be interpreted as LSTM performance unless the evaluation
        endpoint specifically evaluates the trained LSTM model.
      </p>
    </main>
  );
}
