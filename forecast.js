// Real (if simple) forecasting: ordinary least-squares linear regression over
// a household's consumption history, extrapolated one step forward.
// Confidence is derived from how well the line fits the history (R^2).

export function linearRegression(values) {
  const n = values.length;
  if (n === 0) return { slope: 0, intercept: 0, r2: 0 };
  const xs = values.map((_, i) => i);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = values.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (values[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;

  // R^2 goodness of fit
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const predicted = slope * xs[i] + intercept;
    ssRes += (values[i] - predicted) ** 2;
    ssTot += (values[i] - yMean) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);

  return { slope, intercept, r2 };
}

export function forecastNext(history, nextMonthLabel) {
  const values = history.map(h => h.consumption);
  if (values.length === 0) {
    return { value: 0, confidence: 0, month: nextMonthLabel };
  }
  const { slope, intercept, r2 } = linearRegression(values);
  const nextX = values.length; // one step past the last known point
  const rawPrediction = slope * nextX + intercept;
  const value = Math.max(0, Math.round(rawPrediction * 10) / 10);

  // Map R^2 (0..1) into a believable confidence band (55%..97%), and give a
  // small bonus for longer histories (more data -> more trustworthy trend).
  const historyBonus = Math.min(values.length / 12, 1) * 8;
  const confidence = Math.round(Math.min(97, 55 + r2 * 34 + historyBonus));

  return { value, confidence, month: nextMonthLabel };
}