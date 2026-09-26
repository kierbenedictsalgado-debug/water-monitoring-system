import StatCard from "../../component/StatCard";

function Dashboard() {
  let bills = [];

  try {
    bills = JSON.parse(
      localStorage.getItem("waterBills") || "[]"
    );
  } catch {
    bills = [];
  }

  const totalConsumption = bills.reduce(
    (sum, bill) =>
      sum + Number(bill.consumption || 0),
    0
  );

  const totalBills = bills.length;

  return (
    <div className="admin-page">

      <div className="page-heading">

        <h1>Admin Dashboard</h1>

        <p>
          Monitor household water consumption.
        </p>

      </div>

      <div className="stats-grid">

        <StatCard
          title="Total Records"
          value={totalBills}
          description="Saved water bill records"
        />

        <StatCard
          title="Total Consumption"
          value={totalConsumption.toFixed(1)}
          unit="m³"
          description="Total recorded consumption"
        />

        <StatCard
          title="System Status"
          value="Normal"
          description="Water monitoring system"
        />

      </div>

      <section className="content-card">

        <h2>System Overview</h2>

        <p className="card-text">
          The administrator can monitor household
          consumption records, review forecasts,
          and generate reports.
        </p>

      </section>

    </div>
  );
}

export default Dashboard;