import { useState } from "react";

import {
  CalendarDays,
  Droplets,
  PhilippinePeso,
  Save,
} from "lucide-react";

function Consumption() {

  const [billingMonth, setBillingMonth] =
    useState("");

  const [consumption, setConsumption] =
    useState("");

  const [billAmount, setBillAmount] =
    useState("");

  const [billingDate, setBillingDate] =
    useState("");

  const [records, setRecords] =
    useState(() => {

      try {
        return JSON.parse(
          localStorage.getItem(
            "waterConsumptionRecords"
          ) || "[]"
        );
      } catch {
        return [];
      }

    });

  /* =========================================================
     SAVE WATER BILL
     ========================================================= */

  const saveWaterBill = () => {

    if (
      !billingMonth ||
      !consumption ||
      !billAmount ||
      !billingDate
    ) {
      alert(
        "Please complete all water bill information."
      );

      return;
    }

    const newRecord = {
      billingMonth,
      consumption: Number(consumption),
      billAmount: Number(billAmount),
      billingDate,
    };

    const updatedRecords = [
      newRecord,
      ...records,
    ];

    setRecords(updatedRecords);

    localStorage.setItem(
      "waterConsumptionRecords",
      JSON.stringify(updatedRecords)
    );

    setBillingMonth("");
    setConsumption("");
    setBillAmount("");
    setBillingDate("");
  };

  return (
    <div className="consumption-page">

      {/* =====================================================
          INTRO
          ===================================================== */}

      <div className="consumption-intro">

        <div className="consumption-intro-icon">
          <Droplets size={22} />
        </div>

        <div>

          <h2>
            My Consumption
          </h2>

          <p>
            Enter your actual water bill information.
          </p>

        </div>

      </div>

      {/* =====================================================
          SUBMIT WATER BILL
          ===================================================== */}

      <div className="card consumption-form-card">

        <div className="card-heading-row">

          <h2 className="card-title">
            Submit Water Bill
          </h2>

          <p className="muted">
            Add your monthly consumption to improve
            your analytics and forecast.
          </p>

        </div>

        <div className="water-bill-grid">

          {/* =================================================
              LEFT
              ================================================= */}

          <div className="water-bill-column">

            {/* BILLING MONTH */}

            <div className="form-field">

              <label>
                Billing Month
              </label>

              <div className="input-with-icon">

                <CalendarDays size={17} />

                <input
                  type="text"
                  placeholder="Example: August 2026"
                  value={billingMonth}
                  onChange={(e) =>
                    setBillingMonth(
                      e.target.value
                    )
                  }
                />

              </div>

            </div>

            {/* BILLING DATE */}

            <div className="form-field">

              <label>
                Billing Date
              </label>

              <div className="input-with-icon">

                <CalendarDays size={17} />

                <input
                  type="date"
                  value={billingDate}
                  onChange={(e) =>
                    setBillingDate(
                      e.target.value
                    )
                  }
                />

              </div>

            </div>

            {/* SAVE BUTTON */}

            <button
              type="button"
              className="save-water-button"
              onClick={saveWaterBill}
            >

              <Save size={17} />

              Save Water Bill

            </button>

          </div>

          {/* =================================================
              RIGHT
              ================================================= */}

          <div className="water-bill-column">

            {/* CONSUMPTION */}

            <div className="form-field">

              <label>
                Consumption (m³)
              </label>

              <div className="input-with-icon">

                <Droplets size={17} />

                <input
                  type="number"
                  placeholder="Enter consumption"
                  value={consumption}
                  onChange={(e) =>
                    setConsumption(
                      e.target.value
                    )
                  }
                />

              </div>

            </div>

            {/* BILL AMOUNT */}

            <div className="form-field">

              <label>
                Bill Amount (₱)
              </label>

              <div className="input-with-icon">

                <PhilippinePeso size={17} />

                <input
                  type="number"
                  placeholder="Enter bill amount"
                  value={billAmount}
                  onChange={(e) =>
                    setBillAmount(
                      e.target.value
                    )
                  }
                />

              </div>

            </div>

          </div>

        </div>

      </div>

      {/* =====================================================
          CONSUMPTION HISTORY
          ===================================================== */}

      <div className="card consumption-history-card">

        <div className="history-header">

          <div>

            <h2 className="card-title">
              Consumption History
            </h2>

            <p className="muted">
              Your saved household water consumption records.
            </p>

          </div>

          <div className="record-count">
            {records.length}{" "}
            {records.length === 1
              ? "record"
              : "records"}
          </div>

        </div>

        {/* EMPTY */}

        {records.length === 0 ? (

          <div className="empty-history">

            <div className="empty-history-icon">
              <Droplets size={22} />
            </div>

            <strong>
              No water bills yet
            </strong>

            <p>
              Save your first water bill above
              to start tracking your consumption.
            </p>

          </div>

        ) : (

          /* RECORDS */

          <div className="history-list">

            {records.map(
              (record, index) => (

                <div
                  className="history-item"
                  key={index}
                >

                  <div className="history-month">

                    <div className="history-icon">
                      <CalendarDays size={18} />
                    </div>

                    <div>

                      <strong>
                        {record.billingMonth}
                      </strong>

                      <span>
                        {record.billingDate}
                      </span>

                    </div>

                  </div>

                  <div className="history-stat">

                    <span>
                      Consumption
                    </span>

                    <strong>
                      {Number(
                        record.consumption
                      ).toFixed(1)}{" "}
                      m³
                    </strong>

                  </div>

                  <div className="history-stat">

                    <span>
                      Bill Amount
                    </span>

                    <strong>
                      ₱
                      {Number(
                        record.billAmount
                      ).toFixed(2)}
                    </strong>

                  </div>

                </div>

              )
            )}

          </div>

        )}

      </div>

    </div>
  );
}

export default Consumption;