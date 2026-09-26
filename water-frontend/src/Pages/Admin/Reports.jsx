import { useState } from "react";

function Reports() {
  const [bills] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("waterBills") || "[]"
      );
    } catch {
      return [];
    }
  });

  const totalConsumption = bills.reduce(
    (sum, bill) =>
      sum + Number(bill.consumption || 0),
    0
  );

  const totalAmount = bills.reduce(
    (sum, bill) =>
      sum + Number(bill.amount || 0),
    0
  );

  return (
    <div className="admin-page">

      <div className="page-heading">

        <h1>Reports</h1>

        <p>
          Summary of recorded water consumption.
        </p>

      </div>

      <div className="stats-grid">

        <div className="stat-card">
          <p className="stat-title">
            Total Records
          </p>

          <div className="stat-value">
            {bills.length}
          </div>
        </div>

        <div className="stat-card">
          <p className="stat-title">
            Total Consumption
          </p>

          <div className="stat-value">
            {totalConsumption.toFixed(1)}
            <span className="stat-unit">
              m³
            </span>
          </div>
        </div>

        <div className="stat-card">
          <p className="stat-title">
            Total Bill Amount
          </p>

          <div className="stat-value">
            ₱{totalAmount.toLocaleString()}
          </div>
        </div>

      </div>

      <section className="content-card">

        <h2>Report Summary</h2>

        <p className="card-text">
          This report summarizes the water bill
          information submitted by the homeowner.
        </p>

      </section>

    </div>
  );
}

export default Reports;