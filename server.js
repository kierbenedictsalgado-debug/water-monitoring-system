

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { calculateMetrics } from "./metrics.js";

import { getDb } from "./Db.js";
import authRoutes from "./routes/auth.js";
import householdRoutes from "./routes/households.js";
import userRoutes from "./routes/users.js";
import miscRoutes from "./routes/misc.js";
import sensorRoutes from "./sensor.js";


// Path and server configuration
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;

// Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve frontend files from the public folder
app.use(express.static(path.join(__dirname, "public")));

// Database connection
const db = await getDb();

// Existing API routes
app.use("/api/auth", authRoutes(db));
app.use("/api/households", householdRoutes(db));
app.use("/api/users", userRoutes(db));
app.use("/api", miscRoutes(db));
app.use("/api/sensor", sensorRoutes(db));

// Health check API
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    name: "Water Monitoring System API",
  });
});

// Forecast evaluation API
// Calculates MAE and RMSE from actual and predicted values.
app.post("/api/evaluate", (req, res) => {
  try {
    const { actual, predicted } = req.body ?? {};

    const metrics = calculateMetrics(actual, predicted);

    res.json({
      success: true,
      message: "Forecast evaluation completed.",
      metrics,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to evaluate forecast.",
    });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error("API error:", err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(
    `Water Monitoring System API running at http://localhost:${PORT}`
  );
});
