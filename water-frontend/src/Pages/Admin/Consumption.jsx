import { useEffect, useState } from "react";

function Consumption() {
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

  return (
    <div className="admin-page">

      <div className="page-heading">

        <h1>Consumption Records</h1>

        <p>
          Review submitted household water bills.
        </p>

      </div>

      <section className="content-card">

        <div className="history-header">

          <h2>Water Consumption</h2>

          <span className="record-count">
            {bills.length} records
          </span>

        </div>

        {bills.length === 0 ? (
          <div className="empty-state">
            No consumption records available.
          </div>
        ) : (
          <div className="table-container">

            <table>

              <thead>
                <tr>
                  <th>MONTH</th>
                  <th>CONSUMPTION</th>
                  <th>AMOUNT</th>
                  <th>DATE</th>
                </tr>
              </thead>

              <tbody>

                {[...bills]
                  .reverse()
                  .map((bill) => (

                    <tr key={bill.id}>

                      <td>
                        <strong>
                          {bill.month}
                        </strong>
                      </td>

                      <td className="consumption-value">
                        {bill.consumption} m³
                      </td>

                      <td>
                        ₱{Number(bill.amount).toLocaleString()}
                      </td>

                      <td>
                        {bill.date}
                      </td>

                    </tr>

                  ))}

              </tbody>

            </table>

          </div>
        )}

      </section>

    </div>
  );
}

export default Consumption;