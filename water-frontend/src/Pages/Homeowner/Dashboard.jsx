
import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  Droplet,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  Wifi,
  Clock,
  TrendingUp,
  Lightbulb,
  Leaf,
  Activity,
  Home,
  CircleCheck,
  RefreshCw,
} from "lucide-react";
import "./Dashboard.css";

const API = "http://localhost:4000";

function getLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateKey(record) {
  if (record.date) return String(record.date).slice(0, 10);

  if (record.lastUpdated) {
    return getLocalDate(new Date(record.lastUpdated));
  }

  return "";
}

function getRecords(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.history)) return data.history;
  if (Array.isArray(data?.household?.history)) {
    return data.household.history;
  }
  if (Array.isArray(data?.households)) {
    return data.households.flatMap((item) => item.history || []);
  }
  return [];
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatTime(value) {
  if (!value) return "Time unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Time unavailable";

  return date.toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDate(dateKey) {
  if (!dateKey) return "Unknown date";

  const date = new Date(`${dateKey}T12:00:00`);

  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getMonthKey(dateKey) {
  return dateKey.slice(0, 7);
}

function Dashboard() {
  const [dailyRecords, setDailyRecords] = useState([]);
  const [monthlyRecords, setMonthlyRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const [dailyResponse, monthlyResponse] = await Promise.all([
          fetch(`${API}/api/sensor/daily-records`),
          fetch(`${API}/api/sensor/records`),
        ]);

        if (!dailyResponse.ok || !monthlyResponse.ok) {
          throw new Error("Unable to load consumption records.");
        }

        const [dailyData, monthlyData] = await Promise.all([
          dailyResponse.json(),
          monthlyResponse.json(),
        ]);

        if (!active) return;

        setDailyRecords(getRecords(dailyData));
        setMonthlyRecords(getRecords(monthlyData));
        setError("");
      } catch (err) {
        if (active) {
          setError(
            "Unable to connect to the backend. Check that your server is running."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    const interval = setInterval(loadData, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const stats = useMemo(() => {
    const today = getLocalDate();
    const currentMonth = today.slice(0, 7);

    const daily = [...dailyRecords]
      .filter((record) => getDateKey(record))
      .sort((a, b) => getDateKey(a).localeCompare(getDateKey(b)));

    const todayRecord = daily.find(
      (record) => getDateKey(record) === today
    );

    const latest = [...dailyRecords]
      .filter((record) => record.lastUpdated)
      .sort(
        (a, b) =>
          new Date(b.lastUpdated) - new Date(a.lastUpdated)
      )[0];

    const monthly = monthlyRecords.filter((record) => {
      const dateKey = getDateKey(record);
      const monthKey = record.monthKey || getMonthKey(dateKey);
      return monthKey === currentMonth;
    });

    const monthlyTotal = monthly.reduce(
      (sum, record) => sum + Number(record.consumption || 0),
      0
    );

    const dailyValues = daily.map((record) => ({
      ...record,
      dateKey: getDateKey(record),
      value: Number(record.consumption || 0),
    }));

    const recent = [...dailyValues]
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
      .slice(0, 5);

    const chartRecords = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));

      const key = getLocalDate(date);
      const record = dailyValues.find((item) => item.dateKey === key);

      return {
        date: key,
        label: date.toLocaleDateString("en-PH", {
          month: "short",
          day: "numeric",
        }),
        consumption: record ? record.value : null,
      };
    });

    const availableValues = dailyValues
      .filter((record) => record.dateKey.slice(0, 7) === currentMonth)
      .map((record) => record.value);

    const average = availableValues.length
      ? availableValues.reduce((sum, value) => sum + value, 0) /
        availableValues.length
      : 0;

    const highest = [...dailyValues]
      .filter((record) => record.dateKey >= chartRecords[0].date)
      .sort((a, b) => b.value - a.value)[0];

    return {
      todayRecord,
      todayValue: todayRecord
        ? Number(todayRecord.consumption || 0)
        : null,
      latest,
      monthlyTotal,
      average,
      recent,
      chartRecords,
      highest,
      dailyValues,
    };
  }, [dailyRecords, monthlyRecords]);

  const todayText = stats.todayRecord
    ? formatNumber(stats.todayValue)
    : "No data";

  const latestText = stats.latest
    ? formatNumber(stats.latest.consumption)
    : "No data";

  const latestDate = stats.latest
    ? getDateKey(stats.latest)
    : "";

  const lastUpdated = stats.latest?.lastUpdated
    ? `${formatDate(latestDate)} · ${formatTime(stats.latest.lastUpdated)}`
    : "No sensor update available";

  const hasData = stats.dailyValues.length > 0;

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-title-group">
          <div className="dashboard-title-icon">
            <Droplet size={27} fill="currentColor" />
          </div>

          <div>
            <h1>Dashboard</h1>
            <p>
              Monitor your household&apos;s water consumption and system
              status.
            </p>
          </div>
        </div>

        <div className="dashboard-profile">
          <Home size={17} />
          <span>Homeowner</span>
        </div>
      </header>

      {error && (
        <div className="dashboard-error">
          <Activity size={18} />
          <span>{error}</span>
          <button onClick={() => window.location.reload()}>
            <RefreshCw size={15} /> Retry
          </button>
        </div>
      )}

      <section className="dashboard-stats">
        <article className="dashboard-stat stat-blue">
          <div className="stat-heading">
            <span className="stat-icon">
              <Droplet size={22} fill="currentColor" />
            </span>
            <span>Total Consumption</span>
          </div>

          <div className="stat-number">
            {loading ? "Loading..." : formatNumber(stats.monthlyTotal)}
          </div>
          <span className="stat-unit">Recorded units this month</span>

          <div className="stat-footer">
            <CalendarDays size={15} />
            Current month
          </div>
        </article>

        <article className="dashboard-stat stat-green">
          <div className="stat-heading">
            <span className="stat-icon">
              <CalendarDays size={22} />
            </span>
            <span>Today&apos;s Consumption</span>
          </div>

          <div className="stat-number">
            {loading ? "Loading..." : todayText}
          </div>
          <span className="stat-unit">Recorded units today</span>

          <div className="stat-footer">
            <Clock size={15} />
            {stats.todayRecord?.lastUpdated
              ? `Updated ${formatTime(stats.todayRecord.lastUpdated)}`
              : "Waiting for today's record"}
          </div>
        </article>

        <article className="dashboard-stat stat-purple">
          <div className="stat-heading">
            <span className="stat-icon">
              <ChartNoAxesColumnIncreasing size={22} />
            </span>
            <span>Monthly Average</span>
          </div>

          <div className="stat-number">
            {loading ? "Loading..." : formatNumber(stats.average)}
          </div>
          <span className="stat-unit">Recorded units per day</span>

          <div className="stat-footer">
            <TrendingUp size={15} />
            Based on available daily records
          </div>
        </article>

        <article className="dashboard-stat stat-sky">
          <div className="stat-heading">
            <span className="stat-icon">
              <Wifi size={22} />
            </span>
            <span>Latest Sensor Reading</span>
          </div>

          <div className="stat-number">
            {loading ? "Loading..." : latestText}
          </div>
          <span className="stat-unit">Recorded units</span>

          <div className="stat-footer">
            <CircleCheck size={15} />
            {stats.latest ? "Data received" : "No readings available"}
          </div>
        </article>
      </section>

      <section className="dashboard-middle">
        <article className="dashboard-panel dashboard-chart-panel">
          <div className="dashboard-panel-heading">
            <div className="panel-heading-icon">
              <TrendingUp size={22} />
            </div>

            <div>
              <h2>Water Consumption Trend</h2>
              <p>Daily household consumption (last 7 days)</p>
            </div>

            <span className="unit-badge">Recorded units</span>
          </div>

          <div className="dashboard-chart">
            {hasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={stats.chartRecords}
                  margin={{ top: 14, right: 8, left: -15, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="waterChartGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#3182f6"
                        stopOpacity={0.2}
                      />
                      <stop
                        offset="95%"
                        stopColor="#3182f6"
                        stopOpacity={0.01}
                      />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    stroke="#e5edf8"
                    strokeDasharray="4 4"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#617ba5", fontSize: 11 }}
                    axisLine={{ stroke: "#dce7f5" }}
                    tickLine={false}
                  />

                  <YAxis
                    tick={{ fill: "#617ba5", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={42}
                  />

                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #dce7f5",
                      boxShadow: "0 5px 20px rgba(40,80,140,.08)",
                      fontSize: 12,
                    }}
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.date
                        ? formatDate(payload[0].payload.date)
                        : ""
                    }
                    formatter={(value) =>
                      value == null
                        ? ["No recorded data", "Consumption"]
                        : [formatNumber(value), "Consumption"]
                    }
                  />

                  <Area
                    type="monotone"
                    dataKey="consumption"
                    stroke="#2678f5"
                    strokeWidth={2.5}
                    fill="url(#waterChartGradient)"
                    connectNulls={false}
                    activeDot={{
                      r: 5,
                      stroke: "#ffffff",
                      strokeWidth: 2,
                    }}
                    dot={{
                      r: 3,
                      fill: "#2678f5",
                      stroke: "#ffffff",
                      strokeWidth: 1.5,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="dashboard-empty-chart">
                <Activity size={30} />
                <strong>No consumption trend yet</strong>
                <span>
                  Your graph will appear when daily sensor records are
                  available.
                </span>
              </div>
            )}
          </div>
        </article>

        <article className="dashboard-panel dashboard-recent-panel">
          <div className="dashboard-panel-heading">
            <div className="panel-heading-icon">
              <Clock size={21} />
            </div>

            <div>
              <h2>Recent Readings</h2>
              <p>Latest recorded household data</p>
            </div>
          </div>

          <div className="recent-reading-list">
            {stats.recent.length ? (
              stats.recent.map((record) => (
                <div className="recent-reading" key={record.dateKey}>
                  <span className="reading-status-dot" />

                  <div className="reading-date">
                    <strong>{formatDate(record.dateKey)}</strong>
                    <span>
                      {record.lastUpdated
                        ? formatTime(record.lastUpdated)
                        : "Time unavailable"}
                    </span>
                  </div>

                  <div className="reading-value">
                    <strong>{formatNumber(record.value)}</strong>
                    <span>units</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="dashboard-empty-list">
                No readings are available yet.
              </div>
            )}
          </div>

          <p className="recent-footnote">
            <span className="reading-status-dot" />
            Each entry represents a recorded date, not a live connection test.
          </p>
        </article>
      </section>

      <section className="dashboard-bottom">
        <article className="dashboard-panel dashboard-insights-panel">
          <div className="dashboard-panel-heading">
            <div className="panel-heading-icon">
              <Lightbulb size={22} />
            </div>

            <div>
              <h2>Quick Insights</h2>
              <p>Summary of your water usage</p>
            </div>
          </div>

          <div className="insight-grid">
            <div className="insight-card">
              <span className="insight-icon insight-blue">
                <TrendingUp size={22} />
              </span>
              <span className="insight-label">Usage Trend</span>
              <strong>
                {stats.chartRecords.filter((r) => r.consumption !== null)
                  .length >= 2
                  ? stats.chartRecords
                      .filter((r) => r.consumption !== null)
                      .at(-1).consumption >=
                    stats.chartRecords
                      .filter((r) => r.consumption !== null)[0].consumption
                    ? "Increased"
                    : "Decreased"
                  : "Not enough data"}
              </strong>
              <p>
                {stats.chartRecords.filter((r) => r.consumption !== null)
                  .length >= 2
                  ? "Based on the first and latest available readings in the chart."
                  : "More daily records are needed to identify a trend."}
              </p>
            </div>

            <div className="insight-card">
              <span className="insight-icon insight-green">
                <Leaf size={22} />
              </span>
              <span className="insight-label">Daily Records</span>
              <strong>{stats.dailyValues.length} available</strong>
              <p>
                Number of daily records returned by your backend.
              </p>
            </div>

            <div className="insight-card">
              <span className="insight-icon insight-purple">
                <ChartNoAxesColumnIncreasing size={22} />
              </span>
              <span className="insight-label">Highest Day</span>
              <strong>
                {stats.highest ? formatNumber(stats.highest.value) : "N/A"}
              </strong>
              <p>
                {stats.highest
                  ? formatDate(stats.highest.dateKey)
                  : "No readings available for this week."}
              </p>
            </div>
          </div>
        </article>

        <article className="dashboard-panel dashboard-system-panel">
          <div className="dashboard-panel-heading">
            <div className="panel-heading-icon">
              <Wifi size={22} />
            </div>

            <div>
              <h2>System Status</h2>
              <p>Latest available sensor information</p>
            </div>
          </div>

          <div className="system-status-card">
            <span className="system-status-icon">
              <Droplet size={21} />
            </span>

            <div>
              <strong>Sensor Records</strong>
              <span>
                {stats.latest
                  ? "Data is available"
                  : "Waiting for records"}
              </span>
            </div>

            <span
              className={`system-status-badge ${
                stats.latest ? "status-available" : "status-waiting"
              }`}
            >
              {stats.latest ? "Available" : "Waiting"}
            </span>
          </div>

          <div className="system-detail-grid">
            <div className="system-detail">
              <span className="system-detail-icon">
                <Activity size={19} />
              </span>
              <div>
                <span>Daily Data</span>
                <strong>
                  {stats.dailyValues.length
                    ? `${stats.dailyValues.length} records`
                    : "No records"}
                </strong>
              </div>
            </div>

            <div className="system-detail">
              <span className="system-detail-icon">
                <Clock size={19} />
              </span>
              <div>
                <span>Last Update</span>
                <strong>{lastUpdated}</strong>
              </div>
            </div>
          </div>

          <p className="system-note">
            This panel reports backend data availability. It does not verify
            the ESP32's live network connection.
          </p>
        </article>
      </section>
    </main>
  );
}

export default Dashboard;
