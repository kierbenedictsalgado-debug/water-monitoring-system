import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

function Forecast() {

  // Your actual water consumption records
  const consumptionData = [
    {
      month: "June",
      consumption: 16.8
    },
    {
      month: "July",
      consumption: 18.2
    },
    {
      month: "August",
      consumption: 20
    },
    {
      month: "September",
      consumption: 25
    }
  ];

  // Calculate next month forecast
  const total = consumptionData.reduce(
    (sum, item) => sum + item.consumption,
    0
  );

  const average = total / consumptionData.length;

  const nextMonthForecast = average.toFixed(1);

  return (
    <div className="forecast-page">

      {/* PAGE TITLE */}
      <div className="page-header">
        <h1>Forecast</h1>

        <p>
          Estimated future water consumption based on your records.
        </p>
      </div>


      {/* FORECAST SUMMARY */}
      <div className="forecast-summary">

        <div className="forecast-summary-icon">
          💧
        </div>

        <div className="forecast-summary-content">

          <span>
            Next Month Forecast
          </span>

          <strong>
            {nextMonthForecast} m³
          </strong>

          <p>
            Estimated from your average consumption.
          </p>

        </div>

      </div>


      {/* LINE GRAPH */}
      <div className="forecast-chart-card">

        <div className="chart-header">

          <h2>
            Water Consumption Forecast
          </h2>

          <p>
            Monthly water consumption based on your recorded bills.
          </p>

        </div>


        <div className="forecast-chart">

          <ResponsiveContainer
            width="100%"
            height={350}
          >

            <LineChart
              data={consumptionData}
              margin={{
                top: 20,
                right: 30,
                left: 10,
                bottom: 20
              }}
            >

              <CartesianGrid
                strokeDasharray="3 3"
              />

              <XAxis
                dataKey="month"
              />

              <YAxis
                label={{
                  value: "Consumption (m³)",
                  angle: -90,
                  position: "insideLeft"
                }}
              />

              <Tooltip
                formatter={(value) => [
                  `${value} m³`,
                  "Consumption"
                ]}
              />

              <Line
                type="monotone"
                dataKey="consumption"
                stroke="#0099a8"
                strokeWidth={3}
                dot={{
                  r: 6
                }}
                activeDot={{
                  r: 8
                }}
              />

            </LineChart>

          </ResponsiveContainer>

        </div>

      </div>


      {/* FORECAST INFORMATION */}
      <div className="forecast-information">

        <h2>
          Forecast Information
        </h2>

        <p>
          This estimate is based on your submitted
          consumption history. Adding more actual bills
          will improve the available historical data
          for forecasting.
        </p>

      </div>

    </div>
  );
}

export default Forecast;