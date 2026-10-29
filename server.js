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

// Keep this path if your sensor code is saved as sensor.js.
import sensorRoutes from "./sensor.js";

// Path and server configuration.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4000;

// Create Express application.
const app = express();

// Middleware.
app.use(cors());
app.use(express.json());

// Serve frontend files.
app.use(express.static(path.join(__dirname, "public")));

// Health check.
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    name: "Water Monitoring System API",
  });
});

// Forecast evaluation.
app.post("/api/evaluate", (req, res) => {
  try {
    const { actual, predicted } = req.body ?? {};

    const metrics = calculateMetrics(actual, predicted);

    return res.json({
      success: true,
      message: "Forecast evaluation completed.",
      metrics,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to evaluate forecast.",
    });
  }
});

// General error handler.
app.use((err, req, res, next) => {
  console.error("API error:", err);

  if (res.headersSent) {
    return next(err);
  }

  return res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

// Initialize database and start server.
async function startServer() {
  try {
    const db = await getDb();

    // Register existing API routes.
    app.use("/api/auth", authRoutes(db));
    app.use("/api/households", householdRoutes(db));
    app.use("/api/users", userRoutes(db));
    app.use("/api", miscRoutes(db));
    app.use("/api/sensor", sensorRoutes(db));

    // Handle requests that do not match an API route.
    app.use((req, res) => {
      res.status(404).json({
        ok: false,
        error: "Route not found",
        path: req.originalUrl,
      });
    });

    app.listen(PORT, "0.0.0.0", () => {
      console.log(
        `Water Monitoring System API running on port ${PORT}`
      );
      console.log("Database initialized successfully.");
      console.log("Sensor API: /api/sensor");
    });
  } catch (error) {
    console.error("Failed to start the API server:", error);
    process.exitCode = 1;
  }
}

startServer();