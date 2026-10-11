
import { Router } from "express";

export default function sensorRoutes(db) {
  const router = Router();

  router.get("/test", (req, res) => {
    res.json({
      ok: true,
      message: "Sensor route is working",
    });
  });

  // Return existing monthly records.
  router.get("/records", (req, res) => {
    const householdId = "HH-ESP32-001";

    const household = db.data.households.find(
      (item) => item.id === householdId
    );

    res.json({
      records: household?.history ?? [],
    });
  });

  // Return daily consumption records.
  router.get("/daily-records", (req, res) => {
    const householdId = "HH-ESP32-001";

    const household = db.data.households.find(
      (item) => item.id === householdId
    );

    res.json({
      records: household?.dailyHistory ?? [],
    });
  });

  // Receive and save ESP32 readings.
  router.post("/reading", async (req, res) => {
    const { deviceId, consumption } = req.body || {};

    if (
      !deviceId ||
      typeof consumption !== "number" ||
      !Number.isFinite(consumption) ||
      consumption < 0
    ) {
      return res.status(400).json({
        error:
          "Valid deviceId and non-negative numeric consumption are required",
      });
    }

    try {
      const now = new Date();

      // Use a consistent date for daily and monthly records.
      const dateKey = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
      ].join("-");

      const monthKey = dateKey.slice(0, 7);

      const month = now.toLocaleString("en-US", {
        month: "long",
        year: "numeric",
      });

      const householdId = `HH-${deviceId}`;

      let household = db.data.households.find(
        (item) => item.id === householdId
      );

      if (!household) {
        household = {
          id: householdId,
          name: `${deviceId} Water Sensor`,
          username: deviceId,
          email: "",
          barangay: "",
          accountType: "Residential — Standard",
          status: "Active",
          history: [],
          dailyHistory: [],
          forecast: null,
        };

        db.data.households.push(household);
      }

      if (!Array.isArray(household.history)) {
        household.history = [];
      }

      if (!Array.isArray(household.dailyHistory)) {
        household.dailyHistory = [];
      }

      // Preserve the existing monthly record behavior.
      let monthlyRecord = household.history.find(
        (item) => item.monthKey === monthKey
      );

      if (monthlyRecord) {
        monthlyRecord.consumption = consumption;
        monthlyRecord.lastUpdated = now.toISOString();
      } else {
        monthlyRecord = {
          monthKey,
          month,
          consumption,
          lastUpdated: now.toISOString(),
        };

        household.history.push(monthlyRecord);
      }

      /*
       * IMPORTANT:
       * This daily calculation is valid only when consumption
       * is a cumulative total for the current month.
       *
       * Daily usage = current cumulative total minus the
       * previous day's final cumulative total.
       */
      const previousMonthlyRecord = household.dailyHistory
        .filter((item) => item.monthKey === monthKey)
        .sort((a, b) => b.date.localeCompare(a.date))[0];

      const existingDailyRecord = household.dailyHistory.find(
        (item) => item.date === dateKey
      );

      let dailyConsumption = consumption;

      if (existingDailyRecord) {
        dailyConsumption = Math.max(
          0,
          consumption - (existingDailyRecord.monthToDate || 0)
        );

        // If the monthly total increases during the day,
        // accumulate the difference into today's usage.
        existingDailyRecord.consumption += dailyConsumption;
        existingDailyRecord.monthToDate = consumption;
        existingDailyRecord.lastUpdated = now.toISOString();
      } else {
        const previousMonthToDate =
          previousMonthlyRecord?.monthToDate ?? 0;

        dailyConsumption = Math.max(
          0,
          consumption - previousMonthToDate
        );

        household.dailyHistory.push({
          date: dateKey,
          monthKey,
          consumption: dailyConsumption,
          monthToDate: consumption,
          lastUpdated: now.toISOString(),
        });
      }

      await db.write();

      console.log("ESP32 reading saved:", {
        deviceId,
        householdId,
        consumption,
        date: dateKey,
        month,
      });

      return res.json({
        ok: true,
        message: "Reading saved",
        householdId,
        consumption,
        date: dateKey,
      });
    } catch (error) {
      console.error("Failed to save sensor reading:", error);

      return res.status(500).json({
        error: "Failed to save sensor reading",
      });
    }
  });

  return router;
}
