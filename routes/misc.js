import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { analyticsFor, nextMonthLabel } from './households.js';
import { forecastNext } from '../forecast.js';
import { resetDb } from '../Db.js';

export default function miscRoutes(db) {
  const router = Router();

  
  // ---- Consumption history ----
  router.get('/consumption', requireAuth, (req, res) => {
    const households = db.data.households || [];

    const records = households.flatMap((household) =>
      (household.history || []).map((record) => ({
        ...record,
        household_id: household.id,
        household_name: household.name
      }))
    );

    res.json(records);
  });


  // ---- Settings ----
  router.get('/settings', requireAuth, (req, res) => res.json(db.data.settings));

  router.put('/settings', requireAuth, requireAdmin, async (req, res) => {
    const { threshold, emailAlerts, autoForecast } = req.body || {};
    if (threshold != null) db.data.settings.threshold = Number(threshold);
    if (emailAlerts != null) db.data.settings.emailAlerts = Boolean(emailAlerts);
    if (autoForecast != null) db.data.settings.autoForecast = Boolean(autoForecast);
    await db.write();
    res.json(db.data.settings);
  });

  // ---- Admin dashboard aggregate stats ----
  router.get('/dashboard/admin', requireAuth, requireAdmin, (req, res) => {
    const households = db.data.households;
    const totalRecords = households.reduce((sum, h) => sum + h.history.length, 0);
    const latestValues = households
      .map(h => h.history[h.history.length - 1]?.consumption)
      .filter(v => v != null);
    const thisMonthAvg = latestValues.length
      ? Math.round((latestValues.reduce((a, b) => a + b, 0) / latestValues.length) * 10) / 10
      : 0;
    const threshold = db.data.settings.threshold;
    const activeAlerts = households.filter(h => {
      const latest = h.history[h.history.length - 1];
      return latest && latest.consumption > threshold;
    }).length;

    // month-by-month avg/high/low across all households, for the multi-line chart
    const monthKeys = [...new Set(households.flatMap(h => h.history.map(r => r.monthKey)))].sort();
    const series = monthKeys.map(key => {
      const vals = households
        .map(h => h.history.find(r => r.monthKey === key)?.consumption)
        .filter(v => v != null);
      return {
        monthKey: key,
        average: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0,
        high: vals.length ? Math.max(...vals) : 0,
        low: vals.length ? Math.min(...vals) : 0
      };
    });

    res.json({
      totalHouseholds: households.length,
      totalRecords,
      thisMonthAvg,
      activeAlerts,
      series
    });
  });

  // ---- Resident dashboard for one household ----
  router.get('/dashboard/resident/:id', requireAuth, (req, res) => {
    const h = db.data.households.find(x => x.id === req.params.id);
    if (!h) return res.status(404).json({ error: 'Household not found' });
    const analytics = analyticsFor(h.history);
    const latest = h.history[h.history.length - 1];
    const forecast = h.forecast || forecastNext(h.history, nextMonthLabel(h.history));

    const allLatest = db.data.households
      .map(x => x.history[x.history.length - 1]?.consumption)
      .filter(v => v != null);
    const barangayAvg = allLatest.length ? allLatest.reduce((a, b) => a + b, 0) / allLatest.length : 0;
    const vsBarangayPct = barangayAvg ? Math.round(((latest.consumption - barangayAvg) / barangayAvg) * 100) : 0;

    res.json({
      household: { id: h.id, name: h.name, status: h.status },
      currentMonth: latest,
      forecast,
      analytics,
      threshold: db.data.settings.threshold,
      vsBarangayPct
    });
  });

  // ---- Reports ----
  router.get('/reports/summary', requireAuth, requireAdmin, (req, res) => {
    const lines = db.data.households.map(h => {
      const latest = h.history[h.history.length - 1];
      const fc = h.forecast ? `${h.forecast.value} m3 (${h.forecast.confidence}% confidence)` : 'not yet run';
      return `${h.id} — ${h.name}: ${latest ? latest.consumption : '-'} m3 (forecast ${fc})`;
    });
    const text = `AquaTrack Consumption & Forecast Report\nGenerated ${new Date().toLocaleString('en-US')}\n\n${lines.join('\n')}\n`;
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="aquatrack_report.txt"');
    res.send(text);
  });

  // ---- Dev-only reset (mirrors the demo's "reset demo" action) ----
  router.post('/dev/reset', requireAuth, requireAdmin, async (req, res) => {
    await resetDb(db);
    res.json({ reset: true });
  });

  return router;
}