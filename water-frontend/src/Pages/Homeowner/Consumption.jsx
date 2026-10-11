
import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000"
).replace(/\/+$/, "");

const CONSUMPTION_ENDPOINT = "/api/sensor/records";

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

  return Number.isFinite(amount) ? amount : 0;
}

function getDate(record) {
  const value =
    record?.lastUpdated ??
    record?.date ??
    record?.recorded_at ??
    record?.createdAt ??
    record?.timestamp ??
    record?.monthKey;

  if (!value) return record?.month || "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return record?.month || String(value);
  }

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function getTime(record) {
  const value =
    record?.lastUpdated ??
    record?.date ??
    record?.recorded_at ??
    record?.createdAt ??
    record?.timestamp;

  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleTimeString("en-PH", {
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
        { method: "GET", headers }
      );

      if (!response.ok) {
        throw new Error(
          `Unable to load consumption records (HTTP ${response.status}).`
        );
      }

      const data = await response.json();
      const fetchedRecords = getRecords(data);

      setRecords(fetchedRecords);
      setLastFetched(new Date());
    } catch (err) {
      console.error("Failed to load consumption records:", err);

      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while loading consumption records."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Load records when the page opens and refresh automatically.
  useEffect(() => {
    loadConsumption(true);

    const intervalId = setInterval(() => {
      loadConsumption(false);
    }, 5000);

    return () => clearInterval(intervalId);
  }, [loadConsumption]);

  // This function is used by the Refresh button.
  const handleRefresh = () => {
    loadConsumption(false);
  };

  const summary = useMemo(() => {
    const total = records.reduce(
      (sum, record) => sum + getAmount(record),
      0
    );

    const average = records.length > 0 ? total / records.length : 0;

    return {
      total,
      average,
      count: records.length,
    };
  }, [records]);

  const formatLiters = (value) =>
    `${value.toLocaleString("en-PH", {
      maximumFractionDigits: 2,
    })} L`;

  return (
    <main style={styles.page}>
      <h1 style={styles.heading}>Water Consumption</h1>

      <p style={styles.subtitle}>
        Monitor your household water consumption and sensor records.
      </p>

      <section style={styles.cards}>
        <div style={styles.card}>
          <div style={styles.cardLabel}>Total Recorded Consumption</div>
          <div style={styles.cardValue}>
            {formatLiters(summary.total)}
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardLabel}>Average Per Record</div>
          <div style={styles.cardValue}>
            {formatLiters(summary.average)}
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardLabel}>Total Records</div>
          <div style={styles.cardValue}>{summary.count}</div>
        </div>
      </section>

      <section style={styles.panel}>
        <div style={styles.panelHeader}>
          <h2 style={styles.panelTitle}>Consumption Records</h2>

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
              Check that your backend is running on port 4000 and that
              the sensor records endpoint is available.
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
            Loading consumption records...
          </div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date Recorded</th>
                  <th style={styles.th}>Time</th>
                  <th style={styles.th}>Record ID</th>
                  <th style={styles.th}>Water Consumption</th>
                  <th style={styles.th}>Unit</th>
                </tr>
              </thead>

              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        ...styles.td,
                        textAlign: "center",
                        color: "#6b7280",
                        padding: "28px 12px",
                      }}
                    >
                      No consumption records found yet.
                    </td>
                  </tr>
                ) : (
                  [...records]
                    .sort((a, b) => {
                      const dateA = new Date(
                        a.lastUpdated ?? a.timestamp ?? a.monthKey ?? 0
                      ).getTime();

                      const dateB = new Date(
                        b.lastUpdated ?? b.timestamp ?? b.monthKey ?? 0
                      ).getTime();

                      return dateB - dateA;
                    })
                    .map((record, index) => (
                      <tr
                        key={
                          record.id ??
                          record.monthKey ??
                          record.lastUpdated ??
                          index
                        }
                      >
                        <td style={styles.td}>{getDate(record)}</td>
                        <td style={styles.td}>{getTime(record)}</td>
                        <td style={styles.td}>
                          {record.id ??
                            record.monthKey ??
                            `REC-${index + 1}`}
                        </td>
                        <td style={styles.td}>
                          {getAmount(record).toLocaleString("en-PH", {
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td style={styles.td}>L</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
