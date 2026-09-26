function Households() {
  return (
    <div className="admin-page">

      <div className="page-heading">

        <h1>Households</h1>

        <p>
          Manage registered households.
        </p>

      </div>

      <section className="content-card">

        <div className="household-row">

          <div className="household-avatar">
            H
          </div>

          <div className="household-info">

            <strong>
              Homeowner
            </strong>

            <span>
              Primary household account
            </span>

          </div>

          <span className="status-badge">
            Active
          </span>

        </div>

      </section>

    </div>
  );
}

export default Households;