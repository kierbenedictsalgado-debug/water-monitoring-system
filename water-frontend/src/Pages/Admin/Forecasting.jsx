import { useEffect, useState } from "react";

function Forecasting() {
  const [bills, setBills] = useState([]);

  useEffect(() => {
    loadBills();

    const interval = setInterval(
      loadBills,
      1000
    );

    return () => clearInterval(interval);
  }, []);

  const loadBills = () => {
    try {
      setBills(
        JSON.parse(
          localStorage.getItem("waterBills") || "[]"
        )
      );
    } catch {
      setBills([]);
    }
  };

  const recent = bills.slice(-4);

  const average =
    recent.length > 0
      ? recent.reduce(
          (sum, bill) =>
            sum + Number(bill.consumption),
          0
        ) / recent.length
      : 0;

  return (
    <div className="admin-page">

      <div className="page-heading">

        <h1>Forecasting</h1>

        <p>
          Estimated future household consumption.
        </p>

      </div>

      <section className="forecast-hero">

        <div className="forecast-icon">
          📈
        </div>

        <div>

          <span>
            Estimated Next Month
          </span>

          <strong>
            {average
              ? average.toFixed(1)
              : "—"}{" "}
            m³
          </strong>

          <small>
            Based on recent consumption records.
          </small>

        </div>

      </section>

      <section className="content-card">

        <h2>Forecast Summary</h2>

        <p className="card-text">
          {recent.length < 2
            ? "At least two consumption records are needed to produce a meaningful forecast."
            : `The current estimated average is ${average.toFixed(
                1
              )} m³ based on the latest records.`}
        </p>

      </section>

    </div>
  );
}

export default Forecasting;