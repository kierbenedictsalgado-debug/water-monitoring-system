import StatCard from "../../component/StatCard";

function getBills() {
  try {
    return JSON.parse(
      localStorage.getItem("waterBills") || "[]"
    );
  } catch {
    return [];
  }
}

function Dashboard() {
  const bills = getBills();

  const latest = bills.length > 0
    ? bills[bills.length - 1]
    : null;

  const todayConsumption = latest
    ? Number(latest.consumption)
    : 120;

  const monthlyConsumption = bills.length > 0
    ? bills
        .slice(-3)
        .reduce(
          (sum, bill) =>
            sum + Number(bill.consumption || 0),
          0
        )
    : 3250;

  return (
    <div className="dashboard-page">

      <div className="page-heading">
        <h1>Homeowner Dashboard</h1>

        <p>
          Welcome to the Water Monitoring System.
        </p>
      </div>

      <div className="stats-grid">

        <StatCard
          title="Today's Consumption"
          value={todayConsumption}
          unit="m³"
          description="Today's recorded water usage"
        />

        <StatCard
          title="Monthly Consumption"
          value={monthlyConsumption.toFixed(1)}
          unit="m³"
          description="Total consumption from recent records"
        />

        <StatCard
          title="Water Status"
          value="Normal"
          description="Current household water status"
        />

      </div>

      <div className="dashboard-grid">

        <section className="content-card">

          <h2>
            Water Consumption Overview
          </h2>

          <p className="card-subtitle">
            Monitor your household's water consumption.
          </p>

          <div className="overview-grid">

            <div className="overview-box">
              <span>Latest Usage</span>
              <strong>
                {todayConsumption} m³
              </strong>
            </div>

            <div className="overview-box">
              <span>Recent Total</span>
              <strong>
                {monthlyConsumption.toFixed(1)} m³
              </strong>
            </div>

            <div className="overview-box">
              <span>Status</span>
              <strong>Normal</strong>
            </div>

          </div>

        </section>

        <section className="content-card">

          <h2>Quick Information</h2>

          <p className="card-text">
            Keep track of your household water
            consumption and review the recommendations
            provided by the system to help reduce
            unnecessary water usage.
          </p>

        </section>

      </div>

    </div>
  );
}

export default Dashboard;