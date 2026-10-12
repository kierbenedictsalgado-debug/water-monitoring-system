import React, { useEffect, useMemo, useState } from "react";

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

// Existing Node.js/backend API
const API = "http://localhost:4000";

// Python FastAPI forecasting service
const FORECAST_API = "http://127.0.0.1:8000";

const getDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatDateTime = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString();
};

const Forecast = () => {
  const [monthlyRecords, setMonthlyRecords] = useState([]);
  const [dailyRecords, setDailyRecords] = useState([]);
  const [sensorReadings, setSensorReadings] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Forecast returned by the Python API
  const [pythonForecast, setPythonForecast] = useState(null);
  const [forecastError, setForecastError] = useState("");

  // Load existing backend records and refresh every three seconds.
  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        const [
          monthlyResponse,
          dailyResponse,
          readingsResponse,
        ] = await Promise.all([
          fetch(`${API}/api/sensor/records`),
          fetch(`${API}/api/sensor/daily-records`),
          fetch(`${API}/api/sensor/readings`),
        ]);

        if (
          !monthlyResponse.ok ||
          !dailyResponse.ok ||
          !readingsResponse.ok
        ) {
          throw new Error(
            "Unable to retrieve consumption records."
          );
        }

        const monthlyResult = await monthlyResponse.json();
        const dailyResult = await dailyResponse.json();
        const readingsResult = await readingsResponse.json();

        const monthly = Array.isArray(monthlyResult.records)
          ? monthlyResult.records
          : [];

        const daily = Array.isArray(dailyResult.records)
          ? dailyResult.records
          : [];

        const readings = Array.isArray(readingsResult.records)
          ? readingsResult.records
          : [];

        const formattedMonthly = monthly
          .filter(
            (record) =>
              record.consumption !== null &&
              record.consumption !== "" &&
              Number.isFinite(Number(record.consumption))
          )
          .map((record, index) => ({
            id: record.monthKey || `month-${index}`,
            month:
              record.month ||
              record.monthKey ||
              "Recorded usage",
            date: record.monthKey || record.lastUpdated || "",
            consumption: Number(record.consumption),
          }))
          .sort((a, b) => a.date.localeCompare(b.date));

        const formattedDaily = daily
          .filter(
            (record) =>
              record.date &&
              record.consumption !== null &&
              record.consumption !== "" &&
              Number.isFinite(Number(record.consumption)) &&
              Number(record.consumption) >= 0
          )
          .map((record) => ({
            ...record,
            consumption: Number(record.consumption),
          }))
          .sort((a, b) => a.date.localeCompare(b.date));

        const formattedReadings = readings
          .filter(
            (reading) =>
              reading.id &&
              reading.consumption !== null &&
              reading.consumption !== "" &&
              Number.isFinite(Number(reading.consumption)) &&
              Number(reading.consumption) >= 0
          )
          .map((reading) => ({
            ...reading,
            consumption: Number(reading.consumption),
          }))
          .sort(
            (a, b) =>
              new Date(b.timestamp || b.date || 0).getTime() -
              new Date(a.timestamp || a.date || 0).getTime()
          );

        if (active) {
          setMonthlyRecords(formattedMonthly);
          setDailyRecords(formattedDaily);
          setSensorReadings(formattedReadings);
          setError("");
        }
      } catch (err) {
        console.error("Forecast data error:", err);

        if (active) {
          setError(
            err.message || "Unable to load data."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadData();

    const interval = window.setInterval(loadData, 3000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  // NEW: Request the forecast from the Python FastAPI service.
  useEffect(() => {
    let active = true;

    const loadForecast = async () => {
      try {
        const response = await fetch(
          `${FORECAST_API}/forecast`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              days: 7,
            }),
          }
        );

        if (!response.ok) {
          let message = "Unable to generate the forecast.";

          try {
            const result = await response.json();

            if (result.detail) {
              message =
                typeof result.detail === "string"
                  ? result.detail
                  : message;
            }
          } catch {
            // Use the default error message.
          }

          throw new Error(message);
        }

        const result = await response.json();

        if (active) {
          setPythonForecast(result);
          setForecastError("");
        }
      } catch (err) {
        console.error("Python forecast error:", err);

        if (active) {
          setPythonForecast(null);
          setForecastError(
            err.message ||
              "Cannot connect to the Python forecasting API. " +
                "Check that it is running on port 8000."
          );
        }
      }
    };

    loadForecast();

    // Refresh the Python forecast every three seconds.
    const interval = window.setInterval(loadForecast, 3000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const todayKey = getDateKey(new Date());

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const yesterdayKey = getDateKey(yesterday);

  const yesterdayRecord = dailyRecords.find(
    (record) => record.date === yesterdayKey
  );

  const todayRecord = dailyRecords.find(
    (record) => record.date === todayKey
  );

  // NEW: Use the forecast returned by Python instead of
  // calculating the prediction directly in React.
  const forecastData = useMemo(() => {
    const forecasts = Array.isArray(
      pythonForecast?.forecasts
    )
      ? pythonForecast.forecasts
      : [];

    const tomorrowForecast = forecasts.find(
      (item) => Number(item.day) === 1
    );

    if (
      !tomorrowForecast ||
      tomorrowForecast.consumption === null ||
      tomorrowForecast.consumption === "" ||
      !Number.isFinite(
        Number(tomorrowForecast.consumption)
      )
    ) {
      return {
        prediction: null,
        daysUsed: 0,
      };
    }

    return {
      prediction: Number(
        tomorrowForecast.consumption
      ),
      daysUsed:
        pythonForecast.historical_records_used ?? 0,
    };
  }, [pythonForecast]);

  const predictedConsumption = forecastData.prediction;

  // RAE and RMSE evaluation.
  // Each historical prediction uses only records available
  // before the day being predicted.
  const evaluationData = useMemo(() => {
    const records = [...dailyRecords]
      .filter(
        (record) =>
          Number.isFinite(record.consumption) &&
          record.consumption >= 0 &&
          /^\d{4}-\d{2}-\d{2}$/.test(record.date)
      )
      .sort((a, b) => a.date.localeCompare(b.date));

    const pairs = [];

    for (let i = 1; i < records.length; i++) {
      const history = records.slice(
        Math.max(0, i - 7),
        i
      );

      if (history.length === 0) continue;

      const prediction =
        history.reduce(
          (sum, record) =>
            sum + record.consumption,
          0
        ) / history.length;

      pairs.push({
        actual: records[i].consumption,
        predicted: prediction,
      });
    }

    if (pairs.length === 0) {
      return {
        count: 0,
        rae: null,
        rmse: null,
      };
    }

    const meanActual =
      pairs.reduce(
        (sum, pair) => sum + pair.actual,
        0
      ) / pairs.length;

    const absoluteError = pairs.reduce(
      (sum, pair) =>
        sum +
        Math.abs(pair.actual - pair.predicted),
      0
    );

    const baselineError = pairs.reduce(
      (sum, pair) =>
        sum + Math.abs(pair.actual - meanActual),
      0
    );

    const squaredError = pairs.reduce(
      (sum, pair) =>
        sum +
        (pair.actual - pair.predicted) ** 2,
      0
    );

    return {
      count: pairs.length,
      // RAE is displayed as a percentage.
      rae:
        baselineError > 0
          ? absoluteError / baselineError
          : null,
      rmse: Math.sqrt(
        squaredError / pairs.length
      ),
    };
  }, [dailyRecords]);

  const latestRecord = monthlyRecords.length
    ? monthlyRecords[monthlyRecords.length - 1]
    : null;

  const averageConsumption = useMemo(() => {
    if (!monthlyRecords.length) return null;

    return (
      monthlyRecords.reduce(
        (total, record) =>
          total + record.consumption,
        0
      ) / monthlyRecords.length
    );
  }, [monthlyRecords]);

  const formatValue = (value) =>
    Number(value).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  if (loading) {
    return (
      <div className="forecast-page">
        <div className="forecast-loading">
          <div className="loading-spinner" />
          <p>
            Loading your water consumption data...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="forecast-page">
      <header className="forecast-hero">
        <div className="hero-icon">💧</div>

        <div className="hero-copy">
          <h1>Water Consumption Forecast</h1>
          <p>
            Review your household's recorded water usage
            and estimated future consumption.
          </p>
        </div>

        <div className="hero-status">
          <span className="status-indicator" />
          Forecast Overview
        </div>
      </header>

      <main className="forecast-content">
        {(error || forecastError) && (
          <div className="forecast-error">
            <strong>Unable to load data</strong>

            {error && <p>{error}</p>}

            {forecastError && (
              <p>{forecastError}</p>
            )}
          </div>
        )}

        {/* Daily consumption and prediction */}
        <section className="prediction-panel">
          <div className="section-heading">
            <div className="section-icon purple-icon">
              ▦
            </div>

            <div>
              <h2>
                Daily Consumption &amp; Prediction
              </h2>
              <p>
                Tomorrow's estimate is provided by the
                Python forecasting service using the
                available daily consumption records.
              </p>
            </div>
          </div>

          <div className="prediction-grid">
            <article className="prediction-card yesterday-card">
              <div className="card-heading">
                <span className="round-icon blue-icon">
                  ▣
                </span>
                <h3>Yesterday's Consumption</h3>
              </div>

              <div className="prediction-value">
                {yesterdayRecord
                  ? formatValue(
                      yesterdayRecord.consumption
                    )
                  : "No data"}
              </div>

              <div className="prediction-unit">
                {yesterdayRecord
                  ? "Recorded units"
                  : "—"}
              </div>

              <p className="card-footnote">
                <span>◷</span>
                {yesterdayRecord
                  ? `Recorded ${yesterdayRecord.date}`
                  : `Waiting for record dated ${yesterdayKey}`}
              </p>
            </article>

            <article className="prediction-card tomorrow-card">
              <div className="card-heading">
                <span className="round-icon sky-icon">
                  ↗
                </span>
                <h3>
                  Predicted Consumption
                  <br />
                  for Tomorrow
                </h3>
              </div>

              <div className="prediction-value">
                {predictedConsumption !== null
                  ? formatValue(
                      predictedConsumption
                    )
                  : "Not available"}
              </div>

              <div className="prediction-unit">
                {predictedConsumption !== null
                  ? "Estimated units"
                  : "—"}
              </div>

              <p className="card-footnote">
                <span>●</span>
                {predictedConsumption !== null
                  ? `Based on ${forecastData.daysUsed} historical record(s)`
                  : "Daily consumption records are needed"}
              </p>
            </article>

            <article className="prediction-card today-card">
              <div className="card-heading">
                <span className="round-icon green-icon">
                  ✓
                </span>
                <h3>Today's Recorded Consumption</h3>
              </div>

              <div className="prediction-value today-value">
                {todayRecord
                  ? formatValue(
                      todayRecord.consumption
                    )
                  : "No data"}
              </div>

              <div className="prediction-unit">
                {todayRecord
                  ? "Recorded units"
                  : "—"}
              </div>

              <p className="card-footnote">
                <span>◷</span>
                {todayRecord
                  ? `Updated ${
                      todayRecord.lastUpdated
                        ? new Date(
                            todayRecord.lastUpdated
                          ).toLocaleTimeString()
                        : "today"
                    }`
                  : "Waiting for today's daily record"}
              </p>
            </article>
          </div>

          <div className="forecast-disclaimer">
            <span className="info-icon">i</span>
            <p>
              {pythonForecast?.message ||
                "The forecast is supplied by the Python API. " +
                  "Actual future consumption may differ from the estimate."}
            </p>
          </div>
        </section>

        {/* RAE and RMSE evaluation */}
        <section className="accuracy-panel">
          <div className="section-heading">
            <div className="section-icon purple-icon">
              %
            </div>

            <div>
              <h2>Forecast Accuracy Evaluation</h2>
              <p>
                Historical one-day-ahead evaluation using
                the average-based forecasting method.
              </p>
            </div>
          </div>

          <div className="accuracy-grid">
            <article className="metric-card metric-blue">
              <div className="metric-icon">%</div>

              <div>
                <p>RAE</p>
                <h2>
                  {evaluationData.rae !== null
                    ? `${(
                        evaluationData.rae * 100
                      ).toFixed(2)}%`
                    : "N/A"}
                </h2>
                <span>
                  Relative Absolute Error; lower is better
                </span>
              </div>
            </article>

            <article className="metric-card metric-purple">
              <div className="metric-icon">√</div>

              <div>
                <p>RMSE</p>
                <h2>
                  {evaluationData.rmse !== null
                    ? formatValue(
                        evaluationData.rmse
                      )
                    : "N/A"}
                </h2>
                <span>
                  Root Mean Squared Error; same units as
                  consumption
                </span>
              </div>
            </article>

            <article className="metric-card metric-green">
              <div className="metric-icon">#</div>

              <div>
                <p>Evaluated Predictions</p>
                <h2>{evaluationData.count}</h2>
                <span>
                  Historical actual-versus-predicted pairs
                </span>
              </div>
            </article>
          </div>

          <div className="forecast-disclaimer">
            <span className="info-icon">i</span>
            <p>
              These accuracy metrics evaluate historical
              predictions from the average-based baseline,
              not an LSTM model. More daily records are
              recommended for a meaningful assessment.
              RAE is unavailable when its baseline
              denominator is zero.
            </p>
          </div>
        </section>

        {/* Monthly summary */}
        <section className="metrics-grid">
          <article className="metric-card metric-blue">
            <div className="metric-icon">💧</div>

            <div>
              <p>Latest Monthly Consumption</p>
              <h2>
                {latestRecord
                  ? formatValue(
                      latestRecord.consumption
                    )
                  : "—"}
              </h2>
              <span>Most recent monthly record</span>
            </div>
          </article>

          <article className="metric-card metric-purple">
            <div className="metric-icon">▥</div>

            <div>
              <p>Average Monthly Consumption</p>
              <h2>
                {averageConsumption !== null
                  ? formatValue(averageConsumption)
                  : "—"}
              </h2>
              <span>
                Average of available monthly records
              </span>
            </div>
          </article>

          <article className="metric-card metric-green">
            <div className="metric-icon">▤</div>

            <div>
              <p>Monthly Records</p>
              <h2>{monthlyRecords.length}</h2>
              <span>
                Records received from the backend
              </span>
            </div>
          </article>
        </section>

        {/* Individual ESP32 sensor readings */}
        <section className="chart-panel sensor-readings-panel">
          <div className="chart-header">
            <div className="chart-title-icon">⌁</div>

            <div className="chart-title">
              <h2>Individual Sensor Readings</h2>
              <p>
                Individual readings received from your
                ESP32 device
              </p>
            </div>

            <span className="unit-badge">
              {sensorReadings.length} readings
            </span>
          </div>

          {sensorReadings.length > 0 ? (
            <div
              style={{
                width: "100%",
                overflowX: "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: "580px",
                }}
              >
                <thead>
                  <tr>
                    <th style={tableHeaderStyle}>
                      Date and Time
                    </th>

                    <th style={tableHeaderStyle}>
                      Device ID
                    </th>

                    <th
                      style={{
                        ...tableHeaderStyle,
                        textAlign: "right",
                      }}
                    >
                      Cumulative Consumption (L)
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {sensorReadings.map((reading) => (
                    <tr key={reading.id}>
                      <td style={tableCellStyle}>
                        {formatDateTime(
                          reading.timestamp || reading.date
                        )}
                      </td>

                      <td style={tableCellStyle}>
                        {reading.deviceId || "—"}
                      </td>

                      <td
                        style={{
                          ...tableCellStyle,
                          textAlign: "right",
                          fontWeight: 600,
                        }}
                      >
                        {formatValue(
                          reading.consumption
                        )}{" "}
                        L
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-chart">
              <span>📡</span>
              <h3>No individual sensor readings yet</h3>
              <p>
                Readings will appear here when the ESP32
                sends data to the backend.
              </p>
            </div>
          )}

          <p
            style={{
              margin: "14px 0 0",
              fontSize: "12px",
              color: "#647da5",
            }}
          >
            The table refreshes automatically every 3
            seconds. Readings are cumulative, so consecutive
            values may remain unchanged when water is not
            being used.
          </p>
        </section>

        {/* Monthly chart and insights */}
        <section className="forecast-lower-grid">
          <article className="chart-panel">
            <div className="chart-header">
              <div className="chart-title-icon">↗</div>

              <div className="chart-title">
                <h2>Monthly Water Consumption Trends</h2>
                <p>
                  Recorded household consumption over time
                </p>
              </div>

              <span className="unit-badge">
                Backend unit
              </span>
            </div>

            {monthlyRecords.length ? (
              <div className="chart-area">
                <ResponsiveContainer
                  width="100%"
                  height={340}
                >
                  <LineChart
                    data={monthlyRecords}
                    margin={{
                      top: 20,
                      right: 18,
                      left: 0,
                      bottom: 10,
                    }}
                  >
                    <CartesianGrid
                      stroke="#dce7f5"
                      strokeDasharray="5 5"
                      vertical={false}
                    />

                    <XAxis
                      dataKey="month"
                      tick={{
                        fill: "#647da5",
                        fontSize: 12,
                      }}
                      tickLine={false}
                      axisLine={{
                        stroke: "#d5e1f0",
                      }}
                      tickMargin={12}
                    />

                    <YAxis
                      domain={[0, "auto"]}
                      tick={{
                        fill: "#647da5",
                        fontSize: 12,
                      }}
                      tickLine={false}
                      axisLine={false}
                      width={45}
                      tickFormatter={(value) =>
                        Number(value).toFixed(0)
                      }
                    />

                    <Tooltip
                      formatter={(value) => [
                        formatValue(value),
                        "Consumption",
                      ]}
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid #dce7f5",
                        boxShadow:
                          "0 8px 24px #173b6710",
                      }}
                    />

                    <Legend
                      verticalAlign="bottom"
                      height={35}
                    />

                    <Line
                      type="monotone"
                      dataKey="consumption"
                      name="Monthly Consumption"
                      stroke="#2477f3"
                      strokeWidth={3}
                      dot={{
                        r: 5,
                        fill: "#2477f3",
                        stroke: "#ffffff",
                        strokeWidth: 2,
                      }}
                      activeDot={{ r: 7 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-chart">
                <span>📊</span>
                <h3>No monthly records yet</h3>
                <p>
                  Sensor records will appear here when
                  received.
                </p>
              </div>
            )}
          </article>

          <aside className="insights-panel">
            <div className="insights-heading">
              <span>☼</span>
              <h2>Key Insights</h2>
            </div>

            <div className="insight-card">
              <span className="insight-icon blue-icon">
                💧
              </span>

              <div>
                <h3>Latest Monthly Consumption</h3>
                <strong>
                  {latestRecord
                    ? formatValue(
                        latestRecord.consumption
                      )
                    : "No data"}
                </strong>
                <p>
                  Your household's most recent monthly
                  usage.
                </p>
              </div>
            </div>

            <div className="insight-card">
              <span className="insight-icon purple-icon">
                ▥
              </span>

              <div>
                <h3>Average Monthly Consumption</h3>
                <strong>
                  {averageConsumption !== null
                    ? formatValue(averageConsumption)
                    : "No data"}
                </strong>
                <p>
                  Based on available monthly records.
                </p>
              </div>
            </div>

            <div className="insight-card">
              <span className="insight-icon green-icon">
                ▣
              </span>

              <div>
                <h3>Daily Forecast</h3>
                <strong>
                  {predictedConsumption !== null
                    ? formatValue(
                        predictedConsumption
                      )
                    : "Pending"}
                </strong>
                <p>
                  {predictedConsumption !== null
                    ? `Python API estimate based on ${forecastData.daysUsed} historical record(s).`
                    : "Waiting for the Python forecasting service."}
                </p>
              </div>
            </div>
          </aside>
        </section>

        <footer className="forecast-footer">
          <span>💧</span>
          <p>
            Water Consumption Monitoring System
            <span> · </span>
            Data refreshes automatically
          </p>
        </footer>
      </main>
    </div>
  );
};

const tableHeaderStyle = {
  textAlign: "left",
  padding: "14px 12px",
  borderBottom: "2px solid #dce7f5",
  color: "#456184",
  fontSize: "13px",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const tableCellStyle = {
  padding: "14px 12px",
  borderBottom: "1px solid #e8eef6",
  color: "#334b68",
  fontSize: "13px",
  whiteSpace: "nowrap",
};

export default Forecast;