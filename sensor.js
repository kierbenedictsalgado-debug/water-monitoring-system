
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

  // Return every individually saved ESP32 reading.
  router.get("/readings", (req, res) => {
    const householdId = "HH-ESP32-001";

    const household = db.data.households.find(
      (item) => item.id === householdId
    );

    const readings = Array.isArray(household?.readings)
      ? household.readings
      : [];

    res.json({
      records: [...readings].reverse(),
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

      // Use the server's local date for daily and monthly records.
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
          readings: [],
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

      if (!Array.isArray(household.readings)) {
        household.readings = [];
      }

      // Save every incoming ESP32 reading separately.
      household.readings.push({
        id: `${now.getTime()}-${household.readings.length}`,
        deviceId,
        consumption,
        date: dateKey,
        timestamp: now.toISOString(),
      });

      // Keep one monthly record per month.
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
       * ESP32 sends a cumulative total.
       * Calculate daily usage from the previous saved total.
       */
      const existingDailyRecord = household.dailyHistory.find(
        (item) => item.date === dateKey
      );

      // Get the most recently saved cumulative total for this month.
      const previousDailyRecord = household.dailyHistory
        .filter((item) => item.monthKey === monthKey)
        .sort((a, b) => b.date.localeCompare(a.date))[0];

      let dailyConsumption;

      if (existingDailyRecord) {
        const previousTotal =
          Number(existingDailyRecord.monthToDate) || 0;

        // If the ESP32 total decreases, treat it as a reset.
        dailyConsumption =
          consumption >= previousTotal
            ? consumption - previousTotal
            : consumption;

        existingDailyRecord.consumption =
          (Number(existingDailyRecord.consumption) || 0) +
          dailyConsumption;

        existingDailyRecord.monthToDate = consumption;
        existingDailyRecord.lastUpdated = now.toISOString();
      } else {
        const previousTotal =
          previousDailyRecord &&
          Number.isFinite(Number(previousDailyRecord.monthToDate))
            ? Number(previousDailyRecord.monthToDate)
            : 0;

        // On a new day, calculate usage since the last saved total.
        dailyConsumption =
          consumption >= previousTotal
            ? consumption - previousTotal
            : consumption;

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
        dailyConsumption,
        date: dateKey,
        month,
      });

      return res.json({
        ok: true,
        message: "Reading saved",
        householdId,
        consumption,
        dailyConsumption,
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
