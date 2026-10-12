
export function calculateMetrics(actual, predicted) {
  if (!Array.isArray(actual) || !Array.isArray(predicted)) {
    throw new Error(
      "Actual and predicted values must both be arrays."
    );
  }

  if (
    actual.length === 0 ||
    actual.length !== predicted.length
  ) {
    throw new Error(
      "Actual and predicted must have the same non-zero length."
    );
  }

  const validValues = [...actual, ...predicted].every(
    (value) =>
      typeof value === "number" &&
      Number.isFinite(value)
  );

  if (!validValues) {
    throw new Error(
      "All actual and predicted values must be finite numbers."
    );
  }

  const errors = actual.map(
    (value, index) => value - predicted[index]
  );

  const mae =
    errors.reduce(
      (sum, error) => sum + Math.abs(error),
      0
    ) / errors.length;

  const mse =
    errors.reduce(
      (sum, error) => sum + error * error,
      0
    ) / errors.length;

  return {
    sampleCount: errors.length,
    mae: Number(mae.toFixed(4)),
    rmse: Number(Math.sqrt(mse).toFixed(4)),
  };
}
