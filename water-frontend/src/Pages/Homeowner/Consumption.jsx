import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000"
).replace(/\/+$/, "");

const CONSUMPTION_ENDPOINT = "/api/sensor/readings";

function getRecords(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.history)) return data.history;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function getAmount(record) {
  const amount = Number(
    record?.consumption ??
      record?.amount ??
      record?.usage ??
      record?.water_consumption ??
      0
  );

  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

function getTimestamp(record) {
  const value =
    record?.timestamp ??
    record?.lastUpdated ??
    record?.recorded_at ??
    record?.createdAt ??
    record?.date ??
    record?.monthKey;

  if (!value) return 0;

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getDate(record) {
  const timestamp = getTimestamp(record);

  if (!timestamp) return record?.month || "—";

  return new Date(timestamp).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function getTime(record) {
  const timestamp = getTimestamp(record);

  if (!timestamp) return "—";

  return new Date(timestamp).toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const styles = {
  page: {
    padding: "24px",
    color: "#1f2937",
    fontFamily: "Arial, sans-serif",
    width: "100%",
    boxSizing: "border-box",
  },
  heading: {
    fontSize: "28px",
    fontWeight: 700,
    margin: "0 0 8px",
  },
  subtitle: {
    color: "#6b7280",
    margin: "0 0 24px",
    fontSize: "14px",
  },
  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px",
    marginBottom: "24px",
  },
  card: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
  },
  cardLabel: {
    fontSize: "14px",
    color: "#6b7280",
    marginBottom: "12px",
  },
  cardValue: {
    fontSize: "26px",
    fontWeight: 700,
    overflowWrap: "anywhere",
  },
  panel: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "20px",
    overflow: "hidden",
  },
  panelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "16px",
  },
  panelTitle: {
    fontSize: "18px",
    fontWeight: 700,
    margin: 0,
  },
  button: {
    background: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    padding: "10px 16px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 600,
  },
  tableWrapper: {
    width: "100%",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    minWidth: "600px",
    borderCollapse: "collapse",
    textAlign: "left",
  },
  th: {
    padding: "13px 12px",
    background: "#f9fafb",
    borderBottom: "1px solid #e5e7eb",
    color: "#4b5563",
    fontSize: "13px",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "14px 12px",
    borderBottom: "1px solid #e5e7eb",
    fontSize: "14px",
  },
  message: {
    padding: "16px",
    borderRadius: "8px",
    background: "#f9fafb",
    color: "#6b7280",
    marginBottom: "16px",
  },
  error: {
    padding: "12px 16px",
    borderRadius: "8px",
    background: "#fef2f2",
    color: "#b91c1c",
    marginBottom: "16px",
    fontSize: "14px",
  },
};

export default function Consumption() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastFetched, setLastFetched] = useState(null);

  const loadConsumption = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      setError("");

      const token = localStorage.getItem("waterToken");

      const headers = {
        Accept: "application/json",
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(
        `${API_BASE_URL}${CONSUMPTION_ENDPOINT}`,
        {
          method: "GET",
          headers,
        }
      );

      if (!response.ok) {
        throw new Error(
          `Unable to load sensor readings (HTTP ${response.status}).`
        );
      }

      const data = await response.json();
      const fetchedRecords = getRecords(data);

      // Newest readings appear first.
      fetchedRecords.sort(
        (a, b) => getTimestamp(b) - getTimestamp(a)
      );

      setRecords(fetchedRecords);
      setLastFetched(new Date());
    } catch (err) {
      console.error("Failed to load sensor readings:", err);

      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while loading sensor readings."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Load readings when the page opens and refresh every 5 seconds.
  useEffect(() => {
    loadConsumption(true);

    const intervalId = window.setInterval(() => {
      loadConsumption(false);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [loadConsumption]);

  const handleRefresh = () => {
    loadConsumption(false);
  };

  const summary = useMemo(() => {
    if (!records.length) {
      return {
        total: 0,
        averageIncrease: 0,
        count: 0,
      };
    }

    // The latest reading is the cumulative total.
    const latestReading = records.reduce((latest, record) =>
      getTimestamp(record) > getTimestamp(latest)
        ? record
        : latest
    );

    const total = getAmount(latestReading);

    // Sort oldest to newest to calculate changes between readings.
    const chronologicalRecords = [...records].sort(
      (a, b) => getTimestamp(a) - getTimestamp(b)
    );

    let totalIncrease = 0;
    let intervals = 0;

    for (let i = 1; i < chronologicalRecords.length; i++) {
      const previous = getAmount(chronologicalRecords[i - 1]);
      const current = getAmount(chronologicalRecords[i]);

      if (current >= previous) {
        totalIncrease += current - previous;
        intervals += 1;
      } else {
        // A lower cumulative total may mean the device was reset.
        totalIncrease += current;
        intervals += 1;
      }
    }

    return {
      total,
      averageIncrease:
        intervals > 0 ? totalIncrease / intervals : 0,
      count: records.length,
    };
  }, [records]);

  const formatLiters = (value) =>
    `${Number(value).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} L`;

  return (
    <main style={styles.page}>
      <h1 style={styles.heading}>Water Consumption</h1>

      <p style={styles.subtitle}>
        Monitor your household water consumption and sensor readings.
      </p>

      {/* Summary cards */}
      <section style={styles.cards}>
        <div style={styles.card}>
          <div style={styles.cardLabel}>
            Total Recorded Consumption
          </div>
          <div style={styles.cardValue}>
            {formatLiters(summary.total)}
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardLabel}>
            Average Increase Per Reading
          </div>
          <div style={styles.cardValue}>
            {formatLiters(summary.averageIncrease)}
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardLabel}>Total Sensor Readings</div>
          <div style={styles.cardValue}>{summary.count}</div>
        </div>
      </section>

      {/* Individual sensor readings */}
      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <h2 style={styles.panelTitle}>
            Individual Sensor Readings
          </h2>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            style={{
              ...styles.button,
              opacity: refreshing || loading ? 0.65 : 1,
            }}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error && (
          <div role="alert" style={styles.error}>
            {error}
            <div style={{ marginTop: "6px" }}>
              Check that your backend is running on port 4000 and
              that the sensor readings endpoint is available.
            </div>
          </div>
        )}

        {lastFetched && (
          <p
            style={{
              color: "#6b7280",
              fontSize: "12px",
              margin: "0 0 16px",
            }}
          >
            Last updated: {lastFetched.toLocaleTimeString("en-PH")}
            {" · "}Automatic refresh every 5 seconds
          </p>
        )}

        {loading ? (
          <div style={styles.message}>
            Loading sensor readings...
          </div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date Recorded</th>
                  <th style={styles.th}>Time</th>
                  <th style={styles.th}>Device ID</th>
                  <th style={styles.th}>
                    Cumulative Consumption (L)
                  </th>
                </tr>
              </thead>

              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        ...styles.td,
                        textAlign: "center",
                        color: "#6b7280",
                        padding: "28px 12px",
                      }}
                    >
                      No sensor readings found yet.
                    </td>
                  </tr>
                ) : (
                  records.map((record, index) => (
                    <tr key={record.id ?? index}>
                      <td style={styles.td}>{getDate(record)}</td>

                      <td style={styles.td}>{getTime(record)}</td>

                      <td style={styles.td}>
                        {record.deviceId || "—"}
                      </td>

                      <td style={styles.td}>
                        {formatLiters(getAmount(record))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <p
          style={{
            color: "#6b7280",
            fontSize: "12px",
            lineHeight: 1.6,
            margin: "16px 0 0",
          }}
        >
          Note: The sensor records cumulative water consumption.
          Repeated values mean the total has not increased between
          those readings. The summary uses the latest cumulative
          reading rather than adding all snapshots together.
        </p>
      </section>
    </main>
  );
}