
import { useEffect, useMemo, useState } from "react";
import {
  Droplets,
  TrendingUp,
  Radio,
  Filter,
  CalendarDays,
  Search,
  Download,
  RefreshCw,
  List,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import "./Consumption.css";

const API = "http://localhost:4000";
const REFRESH_INTERVAL = 5000;

function getRecords(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.history)) return data.history;
  return [];
}

function getDateKey(record) {
  if (record.date) return String(record.date).slice(0, 10);

  const timestamp = record.timestamp || record.lastUpdated;

  if (timestamp) {
    const date = new Date(timestamp);

    if (!Number.isNaN(date.getTime())) {
      return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-");
    }
  }

  return "";
}

function getTime(record) {
  const timestamp = record.timestamp || record.lastUpdated;

  if (!timestamp) return "Time unavailable";

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) return "Time unavailable";

  return date.toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function normalizeReading(record, index) {
  return {
    id: record.id ?? `${getDateKey(record)}-${index}`,
    date: getDateKey(record),
    time: record.time || getTime(record),
    deviceId: record.deviceId || "Unknown device",
    consumption: Number(record.consumption) || 0,
    status: "Recorded",
    timestamp: record.timestamp || record.lastUpdated || "",
  };
}

function formatDate(value) {
  if (!value) return "Unknown date";

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) return "Unknown date";

  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function Consumption() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [period, setPeriod] = useState("all");
  const [device, setDevice] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  async function refreshRecords() {
    try {
      const response = await fetch(`${API}/api/sensor/readings`);

      if (!response.ok) {
        throw new Error("Unable to load sensor readings.");
      }

      const data = await response.json();
      const normalized = getRecords(data).map(normalizeReading);

      setRecords(normalized);
      setError("");
    } catch (err) {
      console.error("Failed to fetch consumption records:", err);

      setError(
        "Unable to load sensor readings. Check that your backend server is running."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshRecords();

    const interval = setInterval(refreshRecords, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  const devices = useMemo(() => {
    return [...new Set(records.map((record) => record.deviceId))].sort();
  }, [records]);

  const filteredRecords = useMemo(() => {
    let rows = [...records];

    const now = new Date();
    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");

    if (period === "today") {
      rows = rows.filter((record) => record.date === today);
    }

    if (period === "week") {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);

      const startKey = [
        start.getFullYear(),
        String(start.getMonth() + 1).padStart(2, "0"),
        String(start.getDate()).padStart(2, "0"),
      ].join("-");

      rows = rows.filter(
        (record) =>
          record.date &&
          record.date >= startKey &&
          record.date <= today
      );
    }

    if (period === "month") {
      const currentMonth = today.slice(0, 7);

      rows = rows.filter(
        (record) =>
          record.date &&
          record.date.slice(0, 7) === currentMonth
      );
    }

    if (period === "custom") {
      if (startDate) {
        rows = rows.filter(
          (record) => record.date && record.date >= startDate
        );
      }

      if (endDate) {
        rows = rows.filter(
          (record) => record.date && record.date <= endDate
        );
      }
    }

    if (device !== "all") {
      rows = rows.filter((record) => record.deviceId === device);
    }

    if (search.trim()) {
      const query = search.trim().toLowerCase();

      rows = rows.filter(
        (record) =>
          record.deviceId.toLowerCase().includes(query) ||
          record.date.toLowerCase().includes(query) ||
          formatDate(record.date).toLowerCase().includes(query) ||
          record.time.toLowerCase().includes(query)
      );
    }

    if (sortBy === "oldest") {
      rows.sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.time.localeCompare(b.time)
      );
    } else if (sortBy === "highest") {
      rows.sort((a, b) => b.consumption - a.consumption);
    } else if (sortBy === "lowest") {
      rows.sort((a, b) => a.consumption - b.consumption);
    } else {
      rows.sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);

        if (dateCompare !== 0) return dateCompare;

        return b.time.localeCompare(a.time);
      });
    }

    return rows;
  }, [
    records,
    period,
    device,
    sortBy,
    search,
    startDate,
    endDate,
  ]);

  const pageCount = Math.max(
    1,
    Math.ceil(filteredRecords.length / pageSize)
  );

  const safePage = Math.min(page, pageCount);

  const visibleRecords = filteredRecords.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  const latestByDevice = useMemo(() => {
    const latest = new Map();

    for (const record of records) {
      const previous = latest.get(record.deviceId);

      if (
        !previous ||
        `${record.date} ${record.time}` >
          `${previous.date} ${previous.time}`
      ) {
        latest.set(record.deviceId, record);
      }
    }

    return [...latest.values()];
  }, [records]);

  const totalConsumption = useMemo(() => {
    // Sensor readings are cumulative totals.
    // Do not add every cumulative reading together.
    return latestByDevice.reduce(
      (sum, record) => sum + record.consumption,
      0
    );
  }, [latestByDevice]);

  const averageIncrease = useMemo(() => {
    // Average value per recorded reading.
    if (!records.length) return 0;

    return (
      records.reduce((sum, record) => sum + record.consumption, 0) /
      records.length
    );
  }, [records]);

  const clearFilters = () => {
    setPeriod("all");
    setDevice("all");
    setSortBy("newest");
    setSearch("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const exportCSV = () => {
    const headers = [
      "Date",
      "Time",
      "Device ID",
      "Cumulative Consumption (L)",
      "Status",
    ];

    const rows = filteredRecords.map((record) => [
      record.date,
      record.time,
      record.deviceId,
      record.consumption,
      record.status,
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "water-consumption-records.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="consumption-page">
      {/* Duplicate My Consumption hero removed.
          The shared page heading is already displayed by App.jsx. */}

      {error && (
        <div className="consumption-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="button button-outline"
            onClick={refreshRecords}
          >
            <RefreshCw size={15} />
            Retry
          </button>
        </div>
      )}

      <section className="consumption-stats">
        <article className="consumption-stat">
          <span className="stat-icon blue">
            <Droplets />
          </span>

          <div className="stat-label">Latest Cumulative Total</div>
          <strong>
            {loading ? "Loading..." : `${formatNumber(totalConsumption)} L`}
          </strong>
          <small>Latest reading per device</small>
        </article>

        <article className="consumption-stat">
          <span className="stat-icon purple">
            <TrendingUp />
          </span>

          <div className="stat-label">Average Reading</div>
          <strong>
            {loading ? "Loading..." : `${formatNumber(averageIncrease)} L`}
          </strong>
          <small>Average value per recorded reading</small>
        </article>

        <article className="consumption-stat">
          <span className="stat-icon green">
            <Radio />
          </span>

          <div className="stat-label">Total Readings</div>
          <strong>
            {loading ? "Loading..." : records.length.toLocaleString()}
          </strong>
          <small>Individual records from the backend</small>
        </article>
      </section>

      <section className="consumption-panel">
        <div className="panel-heading">
          <span className="panel-icon">
            <Filter />
          </span>

          <div>
            <h2>Filter Records</h2>
            <p>
              Find and view your consumption data using your preferred
              criteria.
            </p>
          </div>
        </div>

        <div className="filter-grid">
          <div className="filter-field">
            <label htmlFor="period">
              <CalendarDays size={15} />
              Time Period
            </label>

            <select
              id="period"
              value={period}
              onChange={(event) => {
                setPeriod(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">All records</option>
              <option value="today">Today</option>
              <option value="week">Last 7 days</option>
              <option value="month">This month</option>
              <option value="custom">Custom date range</option>
            </select>

            {period === "custom" && (
              <div className="date-range">
                <input
                  aria-label="Start date"
                  type="date"
                  value={startDate}
                  max={endDate || undefined}
                  onChange={(event) => {
                    setStartDate(event.target.value);
                    setPage(1);
                  }}
                />

                <span>to</span>

                <input
                  aria-label="End date"
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(event) => {
                    setEndDate(event.target.value);
                    setPage(1);
                  }}
                />
              </div>
            )}
          </div>

          <div className="filter-field">
            <label htmlFor="device">
              <Radio size={15} />
              Device
            </label>

            <select
              id="device"
              value={device}
              onChange={(event) => {
                setDevice(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">All devices</option>
              {devices.map((deviceId) => (
                <option key={deviceId} value={deviceId}>
                  {deviceId}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label htmlFor="sort">
              <TrendingUp size={15} />
              Sort By
            </label>

            <select
              id="sort"
              value={sortBy}
              onChange={(event) => {
                setSortBy(event.target.value);
                setPage(1);
              }}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="highest">Highest consumption</option>
              <option value="lowest">Lowest consumption</option>
            </select>

            <label htmlFor="search" className="search-label">
              <Search size={15} />
              Search
            </label>

            <input
              id="search"
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search device ID or date..."
            />
          </div>
        </div>

        <div className="filter-actions">
          <button
            type="button"
            className="button button-outline"
            onClick={clearFilters}
          >
            Clear Filters
          </button>

          <button
            type="button"
            className="button button-primary"
            onClick={() => setPage(1)}
          >
            Apply Filters
          </button>
        </div>
      </section>

      <section className="consumption-panel readings-panel">
        <div className="readings-heading">
          <span className="panel-icon">
            <List />
          </span>

          <div className="readings-title">
            <h2>Individual Sensor Readings</h2>
            <p>Latest records received from your ESP32 device.</p>
          </div>

          <span className="record-count">
            {filteredRecords.length} filtered
          </span>

          <button
            type="button"
            className="button button-outline export-button"
            onClick={exportCSV}
            disabled={!filteredRecords.length}
          >
            <Download size={15} />
            Export CSV
          </button>

          <button
            type="button"
            className="button button-primary refresh-button"
            onClick={refreshRecords}
            disabled={loading}
          >
            <RefreshCw size={15} />
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div className="updated-line">
          {loading
            ? "Loading backend records..."
            : `Auto-refreshes every ${REFRESH_INTERVAL / 1000} seconds`}
        </div>

        <div className="table-wrap">
          <table className="consumption-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Date Recorded</th>
                <th>Time</th>
                <th>Device ID</th>
                <th>Cumulative Consumption (L)</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {loading && !records.length ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    Loading sensor readings...
                  </td>
                </tr>
              ) : visibleRecords.length > 0 ? (
                visibleRecords.map((record, index) => (
                  <tr key={record.id}>
                    <td>{(safePage - 1) * pageSize + index + 1}</td>
                    <td>{formatDate(record.date)}</td>
                    <td>{record.time}</td>
                    <td>{record.deviceId}</td>
                    <td>{formatNumber(record.consumption)} L</td>
                    <td>
                      <span className="online-status">
                        <i />
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="empty-state">
                    No records match your filters. Try changing your
                    search or date range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <span>
            Showing{" "}
            {filteredRecords.length ? (safePage - 1) * pageSize + 1 : 0}
            {"–"}
            {Math.min(safePage * pageSize, filteredRecords.length)} of{" "}
            {filteredRecords.length} filtered records
          </span>

          <div className="pagination">
            <label htmlFor="page-size">Rows per page</label>

            <select
              id="page-size"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>

            <button
              type="button"
              aria-label="Previous page"
              disabled={safePage <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft size={16} />
            </button>

            <span className="current-page">{safePage}</span>

            <button
              type="button"
              aria-label="Next page"
              disabled={safePage >= pageCount}
              onClick={() =>
                setPage((current) => Math.min(pageCount, current + 1))
              }
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Consumption;
