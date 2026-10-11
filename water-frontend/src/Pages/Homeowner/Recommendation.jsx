
import React, { useEffect, useState } from "react";
import "./Recommendation.css";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || ""
).replace(/\/$/, "");

const RECOMMENDATION_ENDPOINT = "/api/recommendations";

const defaultTips = [
  {
    id: "leaks",
    title: "Check for water leaks",
    category: "Maintenance",
    description:
      "Inspect faucets, pipes, and visible connections for leaks. Repairing leaks can help prevent unnecessary water waste.",
  },
  {
    id: "brushing",
    title: "Turn off the tap while brushing",
    category: "Daily Habit",
    description:
      "Turn off running water while brushing your teeth and turn it back on only when needed.",
  },
  {
    id: "laundry",
    title: "Use the washing machine efficiently",
    category: "Household",
    description:
      "When appropriate for your clothes and machine, wash full loads instead of several small loads.",
  },
  {
    id: "reuse",
    title: "Reuse suitable household water",
    category: "Water Saving",
    description:
      "Where safe and appropriate, reuse clean leftover water for watering plants instead of pouring it away.",
  },
];

function getRecommendations(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.recommendations)) {
    return data.recommendations;
  }
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

export default function Recommendation() {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [usingFallback, setUsingFallback] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadRecommendations() {
      setLoading(true);
      setError("");
      setUsingFallback(false);

      try {
        const response = await fetch(
          `${API_BASE_URL}${RECOMMENDATION_ENDPOINT}`,
          {
            signal: controller.signal,
            headers: { Accept: "application/json" },
          }
        );

        if (!response.ok) {
          throw new Error(
            `Recommendation service returned ${response.status}.`
          );
        }

        const data = await response.json();
        const items = getRecommendations(data);

        if (items.length > 0) {
          setRecommendations(items);
        } else {
          setRecommendations(defaultTips);
          setUsingFallback(true);
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          setRecommendations(defaultTips);
          setUsingFallback(true);
          setError(
            err.message || "Unable to load server recommendations."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadRecommendations();

    return () => controller.abort();
  }, [refreshKey]);

  return (
    <main className="recommendation-page">
      <header className="recommendation-header">
        <div>
          <p className="recommendation-eyebrow">
            HOMEOWNER PORTAL
          </p>
          <h1>Water-Saving Tips</h1>
          <p>
            Simple ways to reduce water waste in your household.
          </p>
        </div>

        <button
          className="recommendation-refresh"
          type="button"
          disabled={loading}
          onClick={() => setRefreshKey((key) => key + 1)}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </header>

      {usingFallback && (
        <div className="recommendation-notice" role="status">
          <strong>General recommendations</strong>
          <p>
            {error
              ? "The recommendation service could not be reached. General tips are shown instead."
              : "No server recommendations were returned. General tips are shown instead."}
          </p>
        </div>
      )}

      {!usingFallback && !loading && (
        <div className="recommendation-notice">
          <strong>System recommendations</strong>
          <p>
            These recommendations were returned by your application.
          </p>
        </div>
      )}

      <section className="recommendation-intro">
        <div className="recommendation-drop">💧</div>
        <div>
          <h2>Every drop counts</h2>
          <p>
            Small changes in daily habits can help your
            household use water more responsibly.
          </p>
        </div>
      </section>

      <section className="recommendation-grid">
        {loading ? (
          <p className="recommendation-state">
            Loading recommendations...
          </p>
        ) : recommendations.length === 0 ? (
          <p className="recommendation-state">
            No recommendations are available at the moment.
          </p>
        ) : (
          recommendations.map((item, index) => (
            <article
              className="recommendation-card"
              key={item.id ?? item._id ?? index}
            >
              <div className="recommendation-card-top">
                <span className="recommendation-card-icon">
                  {["💧", "🏠", "🌱", "🔧"][index % 4]}
                </span>

                <span className="recommendation-category">
                  {item.category ?? item.type ?? "Water Saving"}
                </span>
              </div>

              <h2>
                {item.title ??
                  item.name ??
                  `Recommendation ${index + 1}`}
              </h2>

              <p>
                {item.description ??
                  item.recommendation ??
                  item.message ??
                  "Follow this recommendation to help reduce water waste."}
              </p>
            </article>
          ))
        )}
      </section>

      <section className="recommendation-footer">
        <h2>Build water-saving habits</h2>
        <p>
          Review your consumption history regularly to understand
          your usage and identify where changes may help.
        </p>
      </section>
    </main>
  );
}
