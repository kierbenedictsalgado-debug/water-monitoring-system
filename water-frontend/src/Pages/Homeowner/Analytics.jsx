import { useEffect, useState } from "react";

function Consumption() {
  const [billingMonth, setBillingMonth] = useState("");
  const [consumption, setConsumption] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billingDate, setBillingDate] = useState("");

  const [bills, setBills] = useState([]);

  const [message, setMessage] = useState("");

  useEffect(() => {
    loadBills();
  }, []);

  const loadBills = () => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("waterBills") || "[]"
      );

      setBills(saved);
    } catch {
      setBills([]);
    }
  };

  const saveBill = (e) => {
    e.preventDefault();

    if (
      !billingMonth ||
      !consumption ||
      !billAmount ||
      !billingDate
    ) {
      setMessage("Please complete all fields.");
      return;
    }

    const newBill = {
      id: Date.now(),
      month: billingMonth,
      consumption: Number(consumption),
      amount: Number(billAmount),
      date: billingDate
    };

    const updatedBills = [
      ...bills,
      newBill
    ];

    localStorage.setItem(
      "waterBills",
      JSON.stringify(updatedBills)
    );

    setBills(updatedBills);

    setBillingMonth("");
    setConsumption("");
    setBillAmount("");
    setBillingDate("");

    setMessage("Water bill saved successfully!");

    setTimeout(() => {
      setMessage("");
    }, 3000);
  };

  const deleteBill = (id) => {
    const updatedBills = bills.filter(
      (bill) => bill.id !== id
    );

    localStorage.setItem(
      "waterBills",
      JSON.stringify(updatedBills)
    );

    setBills(updatedBills);
  };

  return (
    <div className="consumption-page">

      <div className="page-heading">
        <h1>My Consumption</h1>

        <p>
          Enter your actual water bill information.
        </p>
      </div>

      <section className="content-card">

        <div className="section-header">
          <div>
            <h2>Submit Water Bill</h2>

            <p>
              Add your monthly consumption to improve
              your analytics and forecast.
            </p>
          </div>
        </div>

        <form
          className="bill-form"
          onSubmit={saveBill}
        >

          <div className="form-group">

            <label>Billing Month</label>

            <input
              type="text"
              value={billingMonth}
              onChange={(e) =>
                setBillingMonth(e.target.value)
              }
              placeholder="Example: August 2026"
            />

          </div>

          <div className="form-group">

            <label>
              Consumption (m³)
            </label>

            <input
              type="number"
              step="0.1"
              min="0"
              value={consumption}
              onChange={(e) =>
                setConsumption(e.target.value)
              }
              placeholder="20"
            />

          </div>

          <div className="form-group">

            <label>
              Bill Amount (₱)
            </label>

            <input
              type="number"
              step="0.01"
              min="0"
              value={billAmount}
              onChange={(e) =>
                setBillAmount(e.target.value)
              }
              placeholder="700"
            />

          </div>

          <div className="form-group">

            <label>Billing Date</label>

            <input
              type="date"
              value={billingDate}
              onChange={(e) =>
                setBillingDate(e.target.value)
              }
            />

          </div>

          {message && (
            <div className="form-message">
              {message}
            </div>
          )}

          <button
            className="primary-button"
            type="submit"
          >
            + Save Water Bill
          </button>

        </form>

      </section>

      <section className="content-card history-card">

        <div className="history-header">

          <div>
            <h2>Consumption History</h2>
          </div>

          <span className="record-count">
            {bills.length} records
          </span>

        </div>

        {bills.length === 0 ? (
          <div className="empty-state">
            No water bills have been saved yet.
          </div>
        ) : (
          <div className="table-container">

            <table>

              <thead>
                <tr>
                  <th>MONTH</th>
                  <th>CONSUMPTION</th>
                  <th>BILL AMOUNT</th>
                  <th>DATE</th>
                  <th>ACTION</th>
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

                      <td>

                        <button
                          className="delete-button"
                          onClick={() =>
                            deleteBill(bill.id)
                          }
                        >
                          Delete
                        </button>

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