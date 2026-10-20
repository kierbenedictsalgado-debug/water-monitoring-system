
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BrainCircuit,
  CheckCircle2,
  Circle,
  Droplets,
  Gauge,
  Lightbulb,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wrench,
  ShowerHead,
  WashingMachine,
  Sprout,
  Utensils,
  House,
  Clock,
  Target,
} from "lucide-react";

import "./Recommendation.css";

const API = "http://localhost:4000";
const COMPLETED_KEY = "completedWaterTips";
const REFRESH_MS = 30000;

const KNOWLEDGE_BASE = [
  {
    id: "leaks",
    title: "Inspect for leaks",
    category: "Maintenance",
    icon: Wrench,
    description:
      "Inspect visible pipes, faucets, toilet connections, and storage tanks for leaks.",
    action:
      "Check for dripping taps, damp spots, or unexpected water flow when water fixtures are closed.",
    triggers: ["high", "spike", "unstable"],
    priority: 10,
  },
  {
    id: "usage-review",
    title: "Review your household water routine",
    category: "Planning",
    icon: Activity,
    description:
      "Your recent readings are higher than earlier readings. Review activities that may explain the change.",
    action:
      "Compare similar days and check whether extra laundry, cleaning, visitors, or other activities affected usage.",
    triggers: ["high", "spike"],
    priority: 9,
  },
  {
    id: "shower",
    title: "Reduce shower time",
    category: "Bathroom",
    icon: ShowerHead,
    description:
      "Shorter showers can help reduce household water consumption.",
    action:
      "Set a reasonable bathing time and avoid running water while soaping.",
    triggers: ["high", "spike", "general"],
    priority: 7,
  },
  {
    id: "faucets",
    title: "Turn off taps when not needed",
    category: "Kitchen",
    icon: Droplets,
    description:
      "Avoid leaving water running during toothbrushing, dishwashing, and food preparation.",
    action:
      "Use a basin for suitable tasks and turn on the tap only when necessary.",
    triggers: ["high", "general"],
    priority: 6,
  },
  {
    id: "laundry",
    title: "Plan laundry loads",
    category: "Laundry",
    icon: WashingMachine,
    description:
      "Planning laundry loads can reduce unnecessary washing cycles.",
    action:
      "Wash appropriate full loads and use a suitable water-saving setting if your machine supports it.",
    triggers: ["high", "general"],
    priority: 6,
  },
  {
    id: "outdoor",
    title: "Control outdoor water use",
    category: "Outdoor",
    icon: Sprout,
    description:
      "Outdoor cleaning and watering can add to household water use.",
    action:
      "Sweep surfaces before washing and use a bucket instead of a continuously running hose when practical.",
    triggers: ["high", "general"],
    priority: 5,
  },
  {
    id: "kitchen",
    title: "Use water efficiently in the kitchen",
    category: "Kitchen",
    icon: Utensils,
    description:
      "Small changes in food preparation and dishwashing can prevent avoidable water waste.",
    action:
      "Wash produce in a clean basin and avoid keeping the tap running throughout dishwashing.",
    triggers: ["general"],
    priority: 5,
  },
  {
    id: "reuse",
    title: "Reuse suitable household water",
    category: "Reuse",
    icon: Sprout,
    description:
      "Some relatively clean water can be reused for appropriate non-drinking purposes.",
    action:
      "Use suitable water for cleaning or watering ornamental plants when safe. Never reuse contaminated water for drinking or food preparation.",
    triggers: ["general"],
    priority: 4,
  },
  {
    id: "check-records",
    title: "Continue monitoring your readings",
    category: "Monitoring",
    icon: Gauge,
    description:
      "Consistent records help you distinguish normal changes from unusual consumption patterns.",
    action:
      "Review readings regularly and compare equivalent time periods before drawing conclusions.",
    triggers: ["insufficient", "general", "stable", "low"],
    priority: 8,
  },
  {
    id: "maintain",
    title: "Maintain your water-saving habits",
    category: "Planning",
    icon: ShieldCheck,
    description:
      "Consistent water-saving routines can help prevent avoidable waste.",
    action:
      "Continue checking for leaks, turning off unused taps, and planning household cleaning tasks.",
    triggers: ["stable", "low"],
    priority: 6,
  },
];

const CATEGORIES = [
  "All",
  "Maintenance",
  "Bathroom",
  "Kitchen",
  "Laundry",
  "Outdoor",
  "Reuse",
  "Planning",
  "Monitoring",
];

function readCompleted() {
  try {
    const value = JSON.parse(localStorage.getItem(COMPLETED_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function getArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.readings)) return payload.readings;
  if (Array.isArray(payload?.records)) return payload.records;
  if (Array.isArray(payload?.history)) return payload.history;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function getValue(record) {
  const candidates = [
    record?.consumption,
    record?.totalLiters,
    record?.liters,
    record?.waterConsumption,
  ];

  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null || candidate === "") {
      continue;
    }

    const number = Number(candidate);
    if (Number.isFinite(number) && number >= 0) return number;
  }

  return null;
}

function getDate(record) {
  const raw =
    record?.timestamp ||
    record?.lastUpdated ||
    record?.date ||
    record?.createdAt;

  if (!raw) return null;

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
  if (!values.length) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function analyzeReadings(readings) {
  const values = readings
    .map((record) => record.value)
    .filter((value) => Number.isFinite(value) && value >= 0);

  if (values.length < 3) {
    return {
      status: "insufficient",
      values,
      count: values.length,
      average: values.length ? mean(values) : null,
      changePercent: null,
      unusual: false,
      insight:
        "Keep collecting household readings. At least three valid records are needed for an initial pattern comparison.",
    };
  }

  // Compare the latest group with the preceding group.
  const windowSize = Math.max(1, Math.floor(values.length / 2));
  const previous = values.slice(-2 * windowSize, -windowSize);
  const recent = values.slice(-windowSize);

  const previousAverage = mean(previous);
  const recentAverage = mean(recent);
  const baseline = median(previous);
  const changePercent =
    previousAverage > 0
      ? ((recentAverage - previousAverage) / previousAverage) * 100
      : null;

  // Robust spread estimate for identifying a possible unusual value.
  const deviations = previous.map((value) => Math.abs(value - baseline));
  const mad = median(deviations);
  const latest = values[values.length - 1];

  const unusual =
    baseline > 0 &&
    latest > baseline + Math.max(3 * mad, baseline * 0.5);

  let status = "stable";
  let insight =
    "Recent consumption is broadly similar to the earlier comparison period. Keep monitoring and maintain good water-saving habits.";

  if (changePercent !== null && changePercent >= 20) {
    status = "high";
    insight =
      "The recent average is at least 20% higher than the preceding comparison period. Review household activities and check for possible leaks.";
  } else if (changePercent !== null && changePercent <= -20) {
    status = "low";
    insight =
      "The recent average is at least 20% lower than the preceding comparison period. Continue the habits that may have helped reduce usage.";
  }

  if (unusual) {
    status = "spike";
    insight =
      "The latest reading is unusually high relative to earlier readings. Verify the reading and check for leaks or unusual household activity.";
  }

  return {
    status,
    count: values.length,
    values,
    average: recentAverage,
    previousAverage,
    changePercent,
    unusual,
    insight,
  };
}

function makeRecommendations(analysis) {
  let triggers = ["general"];

  if (analysis.status === "insufficient") {
    triggers = ["insufficient", "general"];
  } else if (analysis.status === "spike") {
    triggers = ["spike", "high", "general"];
  } else if (analysis.status === "high") {
    triggers = ["high", "general"];
  } else if (analysis.status === "low") {
    triggers = ["low", "stable", "general"];
  } else {
    triggers = ["stable", "general"];
  }

  const selected = KNOWLEDGE_BASE
    .filter((tip) => tip.triggers.some((trigger) => triggers.includes(trigger)))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 6);

  // The fallback guarantees advice even if the data is insufficient.
  return selected.length ? selected : KNOWLEDGE_BASE.slice(0, 6);
}

export default function Recommendation() {
  const [readings, setReadings] = useState([]);
  const [completed, setCompleted] = useState(readCompleted);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [sourceMessage, setSourceMessage] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(COMPLETED_KEY, JSON.stringify(completed));
    } catch (error) {
      console.warn("Unable to save checklist progress:", error);
    }
  }, [completed]);

  const loadReadings = useCallback(async (manual = false) => {
    if (manual) setLoading(true);

    try {
      const response = await fetch(`${API}/api/sensor/readings`);

      if (!response.ok) {
        throw new Error(`Sensor API returned ${response.status}`);
      }

      const payload = await response.json();

      const parsed = getArray(payload)
        .map((record) => ({
          value: getValue(record),
          date: getDate(record),
        }))
        .filter((record) => record.value !== null)
        .sort((a, b) => {
          const aTime = a.date?.getTime() ?? 0;
          const bTime = b.date?.getTime() ?? 0;
          return aTime - bTime;
        });

      setReadings(parsed);
      setSourceMessage("");
    } catch (error) {
      console.warn("Could not retrieve sensor readings:", error);
      setReadings([]);
      setSourceMessage(
        "General recommendations are available. Household insights will update when sensor readings can be retrieved."
      );
    } finally {
      setLastUpdated(new Date());
      if (manual) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReadings();

    const interval = window.setInterval(() => {
      loadReadings();
    }, REFRESH_MS);

    return () => window.clearInterval(interval);
  }, [loadReadings]);

  const analysis = useMemo(() => analyzeReadings(readings), [readings]);

  const recommendations = useMemo(
    () => makeRecommendations(analysis),
    [analysis]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return recommendations.filter((tip) => {
      const matchesCategory =
        category === "All" || tip.category === category;

      const matchesSearch =
        !query ||
        tip.title.toLowerCase().includes(query) ||
        tip.description.toLowerCase().includes(query) ||
        tip.action.toLowerCase().includes(query) ||
        tip.category.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [recommendations, category, search]);

  const completedCount = completed.length;

  function toggleCompleted(id) {
    setCompleted((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  const latest = readings.length ? readings[readings.length - 1] : null;

  return (
    <div className="recommendation-page">
      <section className="rec-hero">
        <div>
          <span className="rec-eyebrow">
            <BrainCircuit size={16} />
            DATA-DRIVEN WATER COACH
          </span>

          <h2>Smarter Water-Saving Recommendations</h2>

          <p>
            Household-level consumption patterns help prioritize practical
            advice. General tips remain available when readings are missing.
          </p>
        </div>

        <div className="rec-hero-icon">
          <Droplets size={64} />
        </div>
      </section>

      <section className="rec-stats">
        <article className="rec-stat">
          <span className="rec-stat-icon"><Lightbulb size={21} /></span>
          <div>
            <span className="rec-label">Recommended Actions</span>
            <strong>{recommendations.length}</strong>
          </div>
        </article>

        <article className="rec-stat">
          <span className="rec-stat-icon"><Activity size={21} /></span>
          <div>
            <span className="rec-label">Valid Records</span>
            <strong>{analysis.count}</strong>
          </div>
        </article>

        <article className="rec-stat">
          <span className="rec-stat-icon"><CheckCircle2 size={21} /></span>
          <div>
            <span className="rec-label">Checklist Completed</span>
            <strong>{completedCount}</strong>
          </div>
        </article>
      </section>

      <section className="rec-insight">
        <div className="rec-insight-symbol">
          {analysis.status === "low" ? (
            <TrendingDown size={23} />
          ) : analysis.status === "stable" ? (
            <ShieldCheck size={23} />
          ) : (
            <TrendingUp size={23} />
          )}
        </div>

        <div className="rec-insight-body">
          <span className="rec-section-label">
            HOUSEHOLD PATTERN ANALYSIS
          </span>

          <h3>
            {analysis.status === "insufficient"
              ? "Building your consumption profile"
              : analysis.status === "spike"
              ? "Unusual reading detected"
              : analysis.status === "high"
              ? "Consumption has increased"
              : analysis.status === "low"
              ? "Consumption has decreased"
              : "Consumption appears relatively stable"}
          </h3>

          <p>{analysis.insight}</p>

          {analysis.changePercent !== null && (
            <p className="rec-change">
              Recent average change:{" "}
              <strong>
                {analysis.changePercent > 0 ? "+" : ""}
                {analysis.changePercent.toFixed(1)}%
              </strong>
            </p>
          )}

          {latest && (
            <p className="rec-small">
              Latest recorded value:{" "}
              <strong>
                {latest.value.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
              </strong>
              {latest.date
                ? ` · ${latest.date.toLocaleString()}`
                : ""}
              . Confirm the configured unit before interpreting this value.
            </p>
          )}

          {sourceMessage && <p className="rec-small">{sourceMessage}</p>}
        </div>

        <button
          type="button"
          className="rec-refresh"
          onClick={() => loadReadings(true)}
          disabled={loading}
          title="Refresh sensor readings"
          aria-label="Refresh sensor readings"
        >
          <RefreshCw size={18} className={loading ? "rec-spin" : ""} />
        </button>
      </section>

      <section className="rec-recommendations">
        <div className="rec-heading">
          <div>
            <span className="rec-section-label">PERSONALIZED ACTION PLAN</span>
            <h3>Recommended for Your Household</h3>
            <p>
              Advice is prioritized using the available household-level
              reading patterns.
            </p>
          </div>
        </div>

        <div className="rec-toolbar">
          <div className="rec-search">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search recommendations..."
              aria-label="Search recommendations"
            />
          </div>

          <button
            type="button"
            className="rec-reset"
            onClick={() => {
              setSearch("");
              setCategory("All");
            }}
          >
            Reset filters
          </button>
        </div>

        <div className="rec-categories">
          {CATEGORIES.map((item) => (
            <button
              type="button"
              key={item}
              className={category === item ? "active" : ""}
              onClick={() => setCategory(item)}
              aria-pressed={category === item}
            >
              {item}
            </button>
          ))}
        </div>

        <p className="rec-result-count">
          {filtered.length} recommended action{filtered.length === 1 ? "" : "s"}
        </p>

        {filtered.length > 0 ? (
          <div className="rec-grid">
            {filtered.map((tip, index) => {
              const Icon = tip.icon;
              const isCompleted = completed.includes(tip.id);

              return (
                <article
                  className={`rec-card ${isCompleted ? "done" : ""}`}
                  key={tip.id}
                >
                  <div className="rec-card-top">
                    <span className="rec-card-icon"><Icon size={23} /></span>
                    <span className="rec-card-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>

                  <span className="rec-card-category">{tip.category}</span>
                  <h4>{tip.title}</h4>
                  <p className="rec-description">{tip.description}</p>

                  <div className="rec-action">
                    <span>WHAT TO DO</span>
                    <p>{tip.action}</p>
                  </div>

                  <button
                    type="button"
                    className={`rec-complete ${isCompleted ? "done" : ""}`}
                    onClick={() => toggleCompleted(tip.id)}
                    aria-pressed={isCompleted}
                  >
                    {isCompleted ? (
                      <CheckCircle2 size={17} />
                    ) : (
                      <Circle size={17} />
                    )}
                    {isCompleted ? "Marked completed" : "Mark as completed"}
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rec-empty">
            <Search size={26} />
            <h4>No matching recommendations</h4>
            <p>Try another search or select a different category.</p>
          </div>
        )}
      </section>

      <footer className="rec-footer">
        <span><Target size={22} /></span>
        <div>
          <strong>Use data carefully</strong>
          <p>
            A change in consumption does not identify its cause. Check the
            sensor and household activities before acting on an unusual reading.
          </p>
          {lastUpdated && (
            <p className="rec-small">
              Last checked: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
      </footer>
    </div>
  );
}
