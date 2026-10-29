
import { Router } from "express";

export default function sensorRoutes(db) {
  const router = Router();

  const HOUSEHOLD_ID = "HH-ESP32-001";

  function getHousehold() {
    return db.data.households.find(
      (item) => item.id === HOUSEHOLD_ID
    );
  }

  function ensureHistoryFields(household) {
    if (!Array.isArray(household.history)) {
      household.history = [];
    }

    if (!Array.isArray(household.dailyHistory)) {
      household.dailyHistory = [];
    }

    if (!Array.isArray(household.readings)) {
      household.readings = [];
    }
  }

  function getLocalDate(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function getMonthName(date) {
    return date.toLocaleString("en-US", {
      month: "long",
      year: "numeric",
    });
  }

  function getMonthlyTotal(household, monthKey) {
    return household.dailyHistory
      .filter((record) => record.monthKey === monthKey)
      .reduce(
        (total, record) =>
          total + Math.max(0, Number(record.consumption) || 0),
        0
      );
  }

  function round6(value) {
    return Number(Math.max(0, value).toFixed(6));
  }

  router.get("/test", (req, res) => {
    res.json({
      ok: true,
      message: "Sensor route is working",
    });
  });

  router.get("/records", (req, res) => {
    const household = getHousehold();

    res.json({
      records: household?.history ?? [],
    });
  });

  router.get("/readings", (req, res) => {
    const household = getHousehold();
    const readings = Array.isArray(household?.readings)
      ? household.readings
      : [];

    res.json({
      records: [...readings].reverse(),
    });
  });

  // Repair the known stale record and return daily history.
  router.get("/daily-records", async (req, res) => {
    try {
      const household = getHousehold();

      if (!household) {
        return res.json({ records: [] });
      }

      ensureHistoryFields(household);

      let changed = false;

      for (const record of household.dailyHistory) {
        const monthlyRecord = household.history.find(
          (item) => item.monthKey === record.monthKey
        );

        if (!monthlyRecord) continue;

        const dailyTotal = Number(record.consumption);
        const monthlyTotal = Number(monthlyRecord.consumption);
        const monthToDate = Number(record.monthToDate);

        /*
         * Targeted repair:
         * Only correct a daily value when the existing month-to-date
         * and monthly total agree, but the daily total is higher.
         * This is for the known stale record, not general history
         * reconstruction.
         */
        if (
          Number.isFinite(dailyTotal) &&
          Number.isFinite(monthlyTotal) &&
          Number.isFinite(monthToDate) &&
          dailyTotal > monthlyTotal &&
          monthToDate === monthlyTotal
        ) {
          record.consumption = round6(monthlyTotal);
          changed = true;
        }
      }

      if (changed) {
        await db.write();
        console.log("Repaired inconsistent daily history.");
      }

      const records = [...household.dailyHistory].sort(
        (a, b) => String(a.date).localeCompare(String(b.date))
      );

      return res.json({ records });
    } catch (error) {
      console.error("Failed to retrieve daily records:", error);

      return res.status(500).json({
        ok: false,
        message: "Failed to retrieve daily records",
      });
    }
  });

  // Destructive operation: clears sensor history only.
  router.delete("/reset", async (req, res) => {
    try {
      const household = getHousehold();

      if (!household) {
        return res.status(404).json({
          ok: false,
          message: "ESP32 household not found",
        });
      }

      ensureHistoryFields(household);

      household.readings = [];
      household.dailyHistory = [];
      household.history = [];
      household.forecast = null;

      await db.write();

      console.log("ESP32 sensor history reset:", HOUSEHOLD_ID);

      return res.json({
        ok: true,
        message: "Sensor history reset successfully",
        householdId: HOUSEHOLD_ID,
        readings: 0,
        dailyRecords: 0,
        monthlyRecords: 0,
        forecast: null,
      });
    } catch (error) {
      console.error("Failed to reset sensor history:", error);

      return res.status(500).json({
        ok: false,
        message: "Failed to reset sensor history",
      });
    }
  });

  router.post("/reading", async (req, res) => {
    try {
      const {
        deviceId,
        consumption,
        flowRate,
        intervalLiters,
        readingId,
      } = req.body ?? {};

      if (
        typeof deviceId !== "string" ||
        deviceId.trim() === ""
      ) {
        return res.status(400).json({
          ok: false,
          error: "A valid deviceId is required",
        });
      }

      if (
        typeof consumption !== "number" ||
        !Number.isFinite(consumption) ||
        consumption < 0
      ) {
        return res.status(400).json({
          ok: false,
          error: "Consumption must be a non-negative number",
        });
      }

      if (
        flowRate !== undefined &&
        (typeof flowRate !== "number" ||
          !Number.isFinite(flowRate) ||
          flowRate < 0)
      ) {
        return res.status(400).json({
          ok: false,
          error: "flowRate must be a non-negative finite number",
        });
      }

      if (
        intervalLiters !== undefined &&
        (typeof intervalLiters !== "number" ||
          !Number.isFinite(intervalLiters) ||
          intervalLiters < 0)
      ) {
        return res.status(400).json({
          ok: false,
          error: "intervalLiters must be a non-negative finite number",
        });
      }

      const now = new Date();
      const dateKey = getLocalDate(now);
      const monthKey = dateKey.slice(0, 7);
      const month = getMonthName(now);
      const normalizedDeviceId = deviceId.trim();
      const householdId = `HH-${normalizedDeviceId}`;

      let household = db.data.households.find(
        (item) => item.id === householdId
      );

      if (!household) {
        household = {
          id: householdId,
          name: `${normalizedDeviceId} Water Sensor`,
          username: normalizedDeviceId,
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

      ensureHistoryFields(household);

      // Prevent duplicate processing if the ESP32 sends a stable ID.
      if (readingId !== undefined && readingId !== null) {
        const duplicate = household.readings.some(
          (item) => item.readingId === String(readingId)
        );

        if (duplicate) {
          return res.json({
            ok: true,
            duplicate: true,
            message: "Reading already processed",
          });
        }
      }

      const previousReading =
        household.readings.length > 0
          ? household.readings[household.readings.length - 1]
          : null;

      const previousTotal =
        previousReading &&
        Number.isFinite(Number(previousReading.consumption))
          ? Number(previousReading.consumption)
          : null;

      const currentTotal = consumption;
      const interval = Number(intervalLiters ?? 0);

      /*
       * Count the positive cumulative difference by default.
       * Use intervalLiters when positive, assuming it represents
       * newly measured liters since the last report.
       * If the cumulative meter resets, count only the interval.
       */
      let dailyConsumption = 0;

      if (previousTotal === null) {
        dailyConsumption = interval;
      } else if (currentTotal >= previousTotal) {
        const increase = currentTotal - previousTotal;

        dailyConsumption = interval > 0 ? interval : increase;
      } else {
        dailyConsumption = interval;
      }

      dailyConsumption = round6(dailyConsumption);

      household.readings.push({
        id: `${now.getTime()}-${household.readings.length}`,
        ...(readingId !== undefined
          ? { readingId: String(readingId) }
          : {}),
        deviceId: normalizedDeviceId,
        consumption: currentTotal,
        flowRate: flowRate ?? 0,
        intervalLiters: interval,
        date: dateKey,
        timestamp: now.toISOString(),
      });

      let dailyRecord = household.dailyHistory.find(
        (record) => record.date === dateKey
      );

      if (dailyRecord) {
        dailyRecord.consumption =
          round6(Number(dailyRecord.consumption) || 0) +
          dailyConsumption;

        dailyRecord.monthKey = monthKey;
        dailyRecord.lastUpdated = now.toISOString();
      } else {
        dailyRecord = {
          date: dateKey,
          monthKey,
          consumption: dailyConsumption,
          monthToDate: dailyConsumption,
          lastUpdated: now.toISOString(),
        };

        household.dailyHistory.push(dailyRecord);
      }

      // Recalculate this month's total from its daily records.
      const monthlyConsumption = round6(
        getMonthlyTotal(household, monthKey)
      );

      let monthlyRecord = household.history.find(
        (record) => record.monthKey === monthKey
      );

      if (monthlyRecord) {
        monthlyRecord.consumption = monthlyConsumption;
        monthlyRecord.lastUpdated = now.toISOString();
      } else {
        monthlyRecord = {
          monthKey,
          month,
          consumption: monthlyConsumption,
          lastUpdated: now.toISOString(),
        };

        household.history.push(monthlyRecord);
      }

      // Keep monthToDate consistent with this month's daily records.
      let runningTotal = 0;

      for (
        const record of household.dailyHistory
          .filter((item) => item.monthKey === monthKey)
          .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      ) {
        runningTotal += Math.max(0, Number(record.consumption) || 0);
        record.monthToDate = round6(runningTotal);
      }

      await db.write();

      console.log("ESP32 reading saved:", {
        deviceId: normalizedDeviceId,
        householdId,
        cumulativeConsumption: currentTotal,
        dailyConsumption,
        flowRate: flowRate ?? 0,
        intervalLiters: interval,
        date: dateKey,
      });

      return res.json({
        ok: true,
        message: "Reading saved",
        householdId,
        consumption: currentTotal,
        dailyConsumption,
        monthlyConsumption,
        date: dateKey,
        timestamp: now.toISOString(),
      });
    } catch (error) {
      console.error("Failed to save sensor reading:", error);

      return res.status(500).json({
        ok: false,
        error: "Failed to save sensor reading",
      });
    }
  });

  return router;
}
