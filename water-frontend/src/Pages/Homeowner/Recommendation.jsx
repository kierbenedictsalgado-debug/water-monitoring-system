function Recommendation() {
  return (
    <div className="recommendation-page">

      <div className="page-heading">

        <h1>
          Water Saving Recommendations
        </h1>

        <p>
          Recommendations to help reduce
          household water consumption.
        </p>

      </div>

      <div className="recommendation-grid">

        <div className="recommendation-card">
          <div className="recommendation-icon">
            💧
          </div>

          <div>
            <h2>Fix Water Leaks</h2>

            <p>
              Check faucets, pipes, and toilets
              regularly for water leaks.
            </p>
          </div>
        </div>

        <div className="recommendation-card">
          <div className="recommendation-icon">
            🚿
          </div>

          <div>
            <h2>Reduce Shower Time</h2>

            <p>
              Try to keep showers short to reduce
              unnecessary water usage.
            </p>
          </div>
        </div>

        <div className="recommendation-card">
          <div className="recommendation-icon">
            📊
          </div>

          <div>
            <h2>Monitor Daily Consumption</h2>

            <p>
              Check your water consumption and
              avoid excessive usage.
            </p>
          </div>
        </div>

        <div className="recommendation-card">
          <div className="recommendation-icon">
            🌱
          </div>

          <div>
            <h2>Use Water Efficiently</h2>

            <p>
              Turn off taps when they are not
              needed and reuse water when possible.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}

export default Recommendation;