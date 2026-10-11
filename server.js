import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

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

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// Database
const db = await getDb();

// API routes
app.use("/api/auth", authRoutes(db));
app.use("/api/households", householdRoutes(db));
app.use("/api/users", userRoutes(db));
app.use("/api", miscRoutes(db));
app.use("/api/sensor", sensorRoutes(db));
// Health check
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    name: "Water Monitoring System API",
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    error: "Internal server error",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(
    `Water Monitoring System API running at http://localhost:${PORT}`
  );
});