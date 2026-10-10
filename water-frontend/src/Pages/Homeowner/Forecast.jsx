import { useEffect, useMemo, useState } from "react";

function Forecast() {
  const [bills, setBills] = useState([]);

  useEffect(() => {
    loadBills();

    const handleStorage = () => {
      loadBills();
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  function loadBills() {
    try {
      const savedBills = localStorage.getItem(
        "waterConsumptionRecords"
      );

      if (!savedBills) {
        setBills([]);
        return;
      }

      const parsed = JSON.parse(savedBills);

      if (Array.isArray(parsed)) {
        setBills(parsed);
      } else {
        setBills([]);
      }

    } catch (error) {
      console.error(
        "Error loading water bills:",
        error
      );

      setBills([]);
    }
  }

  const graphBills = useMemo(() => {
    return [...bills]
      .filter(
        (bill) =>
          bill &&
          bill.consumption !== undefined &&
          bill.consumption !== null
      )
      .sort((a, b) => {
        const dateA = new Date(
          a.billingDate ||
          a.date ||
          a.createdAt ||
          0
        );

        const dateB = new Date(
          b.billingDate ||
          b.date ||
          b.createdAt ||
          0
        );

        return dateA - dateB;
      })
      .slice(-4);
  }, [bills]);

  const forecast = useMemo(() => {
    if (graphBills.length === 0) {
      return 0;
    }

    const total = graphBills.reduce(
      (sum, bill) =>
        sum + Number(bill.consumption || 0),
      0
    );

    return total / graphBills.length;
  }, [graphBills]);

  function getMonthName(bill) {

    if (bill.month) {
      return bill.month;
    }

    const dateValue =
      bill.billingDate ||
      bill.date ||
      bill.createdAt;

    if (!dateValue) {
      return "Month";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "Month";
    }

    return date.toLocaleDateString(
      "en-US",
      {
        month: "short",
        year: "numeric",
      }
    );
  }

  return (
    <div className="forecast-page">

      <section className="forecast-banner">

        <div className="forecast-banner-icon">
          <span className="real-chart-icon">
            ↗
          </span>
        </div>

        <div className="forecast-banner-content">

          <span>
            Next Month Forecast
          </span>

          <strong>
            {forecast.toFixed(1)} m³
          </strong>

          <small>
            Estimated from your recent water consumption.
          </small>

        </div>

      </section>

      <section className="forecast-chart-card">

        <div className="chart-header">

          <div>
            <h2>
              Water Consumption Forecast
            </h2>

            <p>
              Latest {graphBills.length} water bills
            </p>
          </div>

          <span className="record-badge">
            {graphBills.length} records
          </span>

        </div>

        {graphBills.length >= 2 ? (

          <div className="forecast-line-chart">

            <svg
              viewBox="0 0 800 360"
              preserveAspectRatio="none"
            >

              {/* Grid lines */}

              <line
                x1="70"
                y1="50"
                x2="760"
                y2="50"
                className="chart-grid"
              />

              <line
                x1="70"
                y1="115"
                x2="760"
                y2="115"
                className="chart-grid"
              />

              <line
                x1="70"
                y1="180"
                x2="760"
                y2="180"
                className="chart-grid"
              />

              <line
                x1="70"
                y1="245"
                x2="760"
                y2="245"
                className="chart-grid"
              />

              <line
                x1="70"
                y1="310"
                x2="760"
                y2="310"
                className="chart-grid"
              />

              {/* Y axis */}

              <line
                x1="70"
                y1="50"
                x2="70"
                y2="310"
                className="chart-axis"
              />

              {/* X axis */}

              <line
                x1="70"
                y1="310"
                x2="760"
                y2="310"
                className="chart-axis"
              />

              {(() => {

                const values =
                  graphBills.map((bill) =>
                    Number(bill.consumption)
                  );

                const allValues = [
                  ...values,
                  forecast,
                ];

                const min =
                  Math.min(...allValues);

                const max =
                  Math.max(...allValues);

                const range =
                  max - min || 1;

                const points =
                  values.map(
                    (value, index) => {

                      const x =
                        70 +
                        index *
                          (690 /
                            (graphBills.length - 1));

                      const y =
                        290 -
                        ((value - min) /
                          range) *
                          220;

                      return {
                        x,
                        y,
                        value,
                      };
                    }
                  );

                const forecastX = 760;

                const forecastY =
                  290 -
                  ((forecast - min) /
                    range) *
                    220;

                const linePoints =
                  points
                    .map(
                      (point) =>
                        `${point.x},${point.y}`
                    )
                    .join(" ");

                return (
                  <>
                    {/* Y labels */}

                    <text
                      x="58"
                      y="315"
                      textAnchor="end"
                      className="chart-label"
                    >
                      0
                    </text>

                    <text
                      x="58"
                      y="250"
                      textAnchor="end"
                      className="chart-label"
                    >
                      {Math.round(
                        min +
                          range * 0.25
                      )}
                    </text>

                    <text
                      x="58"
                      y="185"
                      textAnchor="end"
                      className="chart-label"
                    >
                      {Math.round(
                        min +
                          range * 0.5
                      )}
                    </text>

                    <text
                      x="58"
                      y="120"
                      textAnchor="end"
                      className="chart-label"
                    >
                      {Math.round(
                        min +
                          range * 0.75
                      )}
                    </text>

                    <text
                      x="58"
                      y="55"
                      textAnchor="end"
                      className="chart-label"
                    >
                      {Math.round(max)}
                    </text>

                    {/* Actual consumption line */}

                    <polyline
                      points={linePoints}
                      className="consumption-line"
                    />

                    {/* Actual points */}

                    {points.map(
                      (point, index) => (
                        <g key={index}>

                          <circle
                            cx={point.x}
                            cy={point.y}
                            r="7"
                            className="chart-point"
                          />

                          <text
                            x={point.x}
                            y={point.y - 15}
                            textAnchor="middle"
                            className="chart-value"
                          >
                            {point.value.toFixed(1)}
                          </text>

                          <text
                            x={point.x}
                            y="340"
                            textAnchor="middle"
                            className="chart-month"
                          >
                            {getMonthName(
                              graphBills[index]
                            )}
                          </text>

                        </g>
                      )
                    )}

                    {/* Forecast line */}

                    <line
                      x1={
                        points[
                          points.length - 1
                        ].x
                      }
                      y1={
                        points[
                          points.length - 1
                        ].y
                      }
                      x2={forecastX}
                      y2={forecastY}
                      className="forecast-line"
                    />

                    {/* Forecast point */}

                    <circle
                      cx={forecastX}
                      cy={forecastY}
                      r="8"
                      className="forecast-point"
                    />

                    <text
                      x={forecastX - 10}
                      y={forecastY - 18}
                      textAnchor="end"
                      className="forecast-value"
                    >
                      Forecast{" "}
                      {forecast.toFixed(1)} m³
                    </text>

                    <text
                      x={forecastX}
                      y="340"
                      textAnchor="middle"
                      className="chart-month"
                    >
                      Forecast
                    </text>

                  </>
                );

              })()}

            </svg>

          </div>

        ) : (

          <div className="no-graph">

            <h3>
              Not enough data yet
            </h3>

            <p>
              Add at least 2 water bills
              to display the line graph.
            </p>

          </div>

        )}

      </section>

      <section className="forecast-card">

        <div className="section-heading">

          <div>
            <h2>
              Records Used for Forecasting
            </h2>

            <p>
              The latest 4 water bills are
              used for the forecast.
            </p>
          </div>

        </div>

        {graphBills.length > 0 ? (

          <div className="forecast-records">

            {graphBills.map(
              (bill, index) => (

                <div
                  className="forecast-record"
                  key={index}
                >

                  <div>
                    <strong>
                      {getMonthName(bill)}
                    </strong>

                    <span>
                      {bill.billingDate || ""}
                    </span>
                  </div>

                  <strong>
                    {Number(
                      bill.consumption
                    ).toFixed(1)}{" "}
                    m³
                  </strong>

                </div>

              )
            )}

          </div>

        ) : (

          <div className="empty-records">
            No saved water bills found.
          </div>

        )}

      </section>

      <section className="forecast-info">

        <h2>
          How the Forecast Works
        </h2>

        <p>
          The system uses your latest
          water consumption records to
          calculate an estimated
          consumption for the next month.
        </p>

        <p>
          Only the latest 4 actual bills
          are displayed on the graph.
        </p>

      </section>

    </div>
  );
}

export default Forecast;