
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

const API = "http://localhost:4000";

const getDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const Forecast = () => {
  const [monthlyRecords, setMonthlyRecords] = useState([]);
  const [dailyRecords, setDailyRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        const [monthlyResponse, dailyResponse] = await Promise.all([
          fetch(`${API}/api/sensor/records`),
          fetch(`${API}/api/sensor/daily-records`),
        ]);

        if (!monthlyResponse.ok || !dailyResponse.ok) {
          throw new Error("Unable to retrieve consumption records.");
        }

        const monthlyResult = await monthlyResponse.json();
        const dailyResult = await dailyResponse.json();

        const monthly = Array.isArray(monthlyResult.records)
          ? monthlyResult.records
          : [];

        const daily = Array.isArray(dailyResult.records)
          ? dailyResult.records
          : [];

        const formattedMonthly = monthly
          .filter((record) =>
            Number.isFinite(Number(record.consumption))
          )
          .map((record, index) => ({
            id: record.monthKey || `month-${index}`,
            month: record.month || record.monthKey || "Recorded usage",
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

        if (active) {
          setMonthlyRecords(formattedMonthly);
          setDailyRecords(formattedDaily);
          setError("");
        }
      } catch (err) {
        console.error("Forecast data error:", err);
        if (active) {
          setError(err.message || "Unable to load data.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();
    const interval = window.setInterval(loadData, 3000);

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

  const todayRecord = dailyRecords
    .filter((record) => record.date === todayKey)
    .slice(-1)[0];

  // Baseline estimate only: tomorrow equals yesterday's usage.
  const predictedConsumption = yesterdayRecord
    ? yesterdayRecord.consumption
    : null;

  const latestRecord = monthlyRecords.length
    ? monthlyRecords[monthlyRecords.length - 1]
    : null;

  const averageConsumption = useMemo(() => {
    if (!monthlyRecords.length) return null;

    return (
      monthlyRecords.reduce(
        (total, record) => total + record.consumption,
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
          <p>Loading your water consumption data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="forecast-page">
      {/* Header */}
      <header className="forecast-hero">
        <div className="hero-icon">💧</div>

        <div className="hero-copy">
          <h1>Water Consumption Forecast</h1>
          <p>
            Review your household's recorded water usage and
            estimated future consumption.
          </p>
        </div>

        <div className="hero-status">
          <span className="status-indicator" />
          Forecast Overview
        </div>
      </header>

      <main className="forecast-content">
        {error && (
          <div className="forecast-error">
            <strong>Unable to load records</strong>
            <p>{error}</p>
          </div>
        )}

        {/* Daily consumption and prediction */}
        <section className="prediction-panel">
          <div className="section-heading">
            <div className="section-icon purple-icon">▦</div>
            <div>
              <h2>Daily Consumption &amp; Prediction</h2>
              <p>
                Yesterday's actual usage is used as the baseline
                for tomorrow's estimate.
              </p>
            </div>
          </div>

          <div className="prediction-grid">
            <article className="prediction-card yesterday-card">
              <div className="card-heading">
                <span className="round-icon blue-icon">▣</span>
                <h3>Yesterday's Consumption</h3>
              </div>

              <div className="prediction-value">
                {yesterdayRecord
                  ? formatValue(yesterdayRecord.consumption)
                  : "No data"}
              </div>

              <div className="prediction-unit">
                {yesterdayRecord ? "Recorded units" : "—"}
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
                <span className="round-icon sky-icon">↗</span>
                <h3>
                  Predicted Consumption
                  <br />
                  for Tomorrow
                </h3>
              </div>

              <div className="prediction-value">
                {predictedConsumption !== null
                  ? formatValue(predictedConsumption)
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
                  ? "Based on yesterday's usage"
                  : "A complete daily record for yesterday is needed"}
              </p>
            </article>

            <article className="prediction-card today-card">
              <div className="card-heading">
                <span className="round-icon green-icon">✓</span>
                <h3>Today's Recorded Consumption</h3>
              </div>

              <div className="prediction-value today-value">
                {todayRecord
                  ? formatValue(todayRecord.consumption)
                  : "No data"}
              </div>

              <div className="prediction-unit">
                {todayRecord ? "Recorded units" : "—"}
              </div>

              <p className="card-footnote">
                <span>◷</span>
                {todayRecord
                  ? `Updated ${todayRecord.lastUpdated
                      ? new Date(
                          todayRecord.lastUpdated
                        ).toLocaleTimeString()
                      : "today"}`
                  : "Waiting for today's daily record"}
              </p>
            </article>
          </div>

          <div className="forecast-disclaimer">
            <span className="info-icon">i</span>
            <p>
              This is a simple baseline estimate, not a guarantee.
              Actual consumption tomorrow may differ. Values use
              the backend's recorded unit, which should be verified.
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
                  ? formatValue(latestRecord.consumption)
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
              <span>Average of available monthly records</span>
            </div>
          </article>

          <article className="metric-card metric-green">
            <div className="metric-icon">▤</div>
            <div>
              <p>Monthly Records</p>
              <h2>{monthlyRecords.length}</h2>
              <span>Records received from the backend</span>
            </div>
          </article>
        </section>

        {/* Chart and insights */}
        <section className="forecast-lower-grid">
          <article className="chart-panel">
            <div className="chart-header">
              <div className="chart-title-icon">↗</div>
              <div className="chart-title">
                <h2>Monthly Water Consumption Trends</h2>
                <p>Recorded household consumption over time</p>
              </div>
              <span className="unit-badge">Backend unit</span>
            </div>

            {monthlyRecords.length ? (
              <div className="chart-area">
                <ResponsiveContainer width="100%" height={340}>
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
                      tick={{ fill: "#647da5", fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: "#d5e1f0" }}
                      tickMargin={12}
                    />
                    <YAxis
                      domain={[0, "auto"]}
                      tick={{ fill: "#647da5", fontSize: 12 }}
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
                        boxShadow: "0 8px 24px #173b6710",
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
                <p>Sensor records will appear here when received.</p>
              </div>
            )}
          </article>

          <aside className="insights-panel">
            <div className="insights-heading">
              <span>☼</span>
              <h2>Key Insights</h2>
            </div>

            <div className="insight-card">
              <span className="insight-icon blue-icon">💧</span>
              <div>
                <h3>Latest Monthly Consumption</h3>
                <strong>
                  {latestRecord
                    ? formatValue(latestRecord.consumption)
                    : "No data"}
                </strong>
                <p>Your household's most recent monthly usage.</p>
              </div>
            </div>

            <div className="insight-card">
              <span className="insight-icon purple-icon">▥</span>
              <div>
                <h3>Average Monthly Consumption</h3>
                <strong>
                  {averageConsumption !== null
                    ? formatValue(averageConsumption)
                    : "No data"}
                </strong>
                <p>Based on available monthly records.</p>
              </div>
            </div>

            <div className="insight-card">
              <span className="insight-icon green-icon">▣</span>
              <div>
                <h3>Daily Forecast</h3>
                <strong>
                  {predictedConsumption !== null
                    ? formatValue(predictedConsumption)
                    : "Pending"}
                </strong>
                <p>
                  {predictedConsumption !== null
                    ? "Baseline estimate using yesterday's consumption."
                    : "Waiting for yesterday's record to calculate tomorrow's estimate."}
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

export default Forecast;
