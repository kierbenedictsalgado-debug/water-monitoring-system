import StatCard from "../../../component/StatCard";

function Dashboard() {

  return (
    <>

      <div className="page-title">

        <h1>
          Admin Dashboard
        </h1>

        <p>
          Barangay-wide water consumption overview.
        </p>

      </div>


      <div className="cards">

        <StatCard
          title="Total Households"
          value="125"
        />

        <StatCard
          title="Total Records"
          value="1,248"
        />

        <StatCard
          title="Monthly Average"
          value="19.2"
          unit="m³"
        />

        <StatCard
          title="Active Alerts"
          value="8"
        />

      </div>


      <div className="panel">

        <h3>
          Consumption Overview
        </h3>

        <div className="simple-chart">

          <div style={{ height: "60%" }} />
          <div style={{ height: "72%" }} />
          <div style={{ height: "65%" }} />
          <div style={{ height: "80%" }} />
          <div style={{ height: "92%" }} />
          <div style={{ height: "78%" }} />

        </div>

      </div>

    </>
  );
}

export default Dashboard;