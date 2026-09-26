import { Router } from 'express';
import { forecastNext } from '../forecast.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

function nextMonthLabel(history) {
  if (!history.length) return 'Next month';
  const last = history[history.length - 1];
  const [y, m] = last.monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + 1, 1);
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function analyticsFor(history) {
  const values = history.map(h => h.consumption);
  const total = values.reduce((a, b) => a + b, 0);
  const average = values.length ? total / values.length : 0;
  const high = values.length ? Math.max(...values) : 0;
  const low = values.length ? Math.min(...values) : 0;
  const highEntry = history.find(h => h.consumption === high);
  const lowEntry = history.find(h => h.consumption === low);
  return {
    average: Math.round(average * 10) / 10,
    total,
    high,
    highMonth: highEntry ? highEntry.month : null,
    low,
    lowMonth: lowEntry ? lowEntry.month : null
  };
}

export default function householdRoutes(db) {
  const router = Router();

  // GET /api/households  -- list (summary) for the households table / admin dashboard
  router.get('/', requireAuth, (req, res) => {
    const list = db.data.households.map(h => {
      const latest = h.history[h.history.length - 1];
      return {
        id: h.id,
        name: h.name,
        email: h.email,
        barangay: h.barangay,
        status: h.status,
        month: latest ? latest.month : null,
        consumption: latest ? latest.consumption : null,
        forecast: h.forecast
      };
    });
    res.json(list);
  });

  // GET /api/households/:id  -- full detail incl. history + analytics + forecast
  router.get('/:id', requireAuth, (req, res) => {
    const h = db.data.households.find(x => x.id === req.params.id);
    if (!h) return res.status(404).json({ error: 'Household not found' });
    res.json({ ...h, analytics: analyticsFor(h.history) });
  });

  // POST /api/households  -- register a new household (admin: "Data Management")
  router.post('/', requireAuth, requireAdmin, async (req, res) => {
    const { id, name, email, barangay, month, consumption } = req.body || {};
    if (!id || !name || consumption == null) {
      return res.status(400).json({ error: 'id, name and consumption are required' });
    }
    if (db.data.households.some(h => h.id === id)) {
      return res.status(409).json({ error: 'A household with this id already exists' });
    }
    const monthLabel = month || new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const monthKey = new Date().toISOString().slice(0, 7);
    const record = {
      id,
      name,
      email: email || `${id.toLowerCase()}@email.com`,
      barangay: barangay || 'Unspecified',
      accountType: 'Residential — Standard',
      status: 'Active',
      history: [{ monthKey, month: monthLabel, consumption: Number(consumption) }],
      forecast: null
    };
    db.data.households.unshift(record);
    await db.write();
    res.status(201).json(record);
  });

  // POST /api/households/:id/records  -- append a new monthly reading to an existing household
  router.post('/:id/records', requireAuth, requireAdmin, async (req, res) => {
    const h = db.data.households.find(x => x.id === req.params.id);
    if (!h) return res.status(404).json({ error: 'Household not found' });
    const { month, consumption } = req.body || {};
    if (consumption == null) return res.status(400).json({ error: 'consumption is required' });
    const monthLabel = month || new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const monthKey = new Date().toISOString().slice(0, 7);
    h.history.push({ monthKey, month: monthLabel, consumption: Number(consumption) });
    await db.write();
    res.status(201).json(h);
  });

  // POST /api/households/import  -- bulk import from parsed CSV rows: [{id,name,month,consumption}, ...]
  router.post('/import', requireAuth, requireAdmin, async (req, res) => {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    let imported = 0;
    for (const row of rows) {
      const id = row.id || `HH-${100 + db.data.households.length + imported}`;
      const consumption = Number(row.consumption) || 0;
      const monthLabel = row.month || new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
      const monthKey = new Date().toISOString().slice(0, 7);
      let h = db.data.households.find(x => x.id === id);
      if (!h) {
        h = {
          id,
          name: row.name || 'Imported Homeowner',
          email: row.email || `${id.toLowerCase()}@email.com`,
          barangay: row.barangay || 'Unspecified',
          accountType: 'Residential — Standard',
          status: 'Active',
          history: [],
          forecast: null
        };
        db.data.households.unshift(h);
      }
      h.history.push({ monthKey, month: monthLabel, consumption });
      imported++;
    }
    if (imported) await db.write();
    res.json({ imported });
  });

  // GET /api/households/export/csv  -- server-generated CSV download
  router.get('/export/csv', requireAuth, (req, res) => {
    const header = 'household,name,month,consumption,forecast\n';
    const rows = db.data.households
      .map(h => {
        const latest = h.history[h.history.length - 1];
        return [h.id, h.name, latest?.month || '', latest?.consumption ?? '', h.forecast?.value ?? ''].join(',');
      })
      .join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="consumption_records.csv"');
    res.send(header + rows);
  });

  // POST /api/households/forecast/run  -- recompute a real regression-based forecast for every household
  router.post('/forecast/run', requireAuth, requireAdmin, async (req, res) => {
    const results = db.data.households.map(h => {
      const forecast = forecastNext(h.history, nextMonthLabel(h.history));
      h.forecast = forecast;
      return { id: h.id, name: h.name, forecast };
    });
    await db.write();
    res.json({ ran: results.length, results });
  });

  // GET /api/households/:id/forecast  -- forecast + analytics for one household (used by resident forecast tab)
  router.get('/:id/forecast', requireAuth, (req, res) => {
    const h = db.data.households.find(x => x.id === req.params.id);
    if (!h) return res.status(404).json({ error: 'Household not found' });
    const forecast = h.forecast || forecastNext(h.history, nextMonthLabel(h.history));
    res.json({ forecast, analytics: analyticsFor(h.history) });
  });

  return router;
}

export { analyticsFor, nextMonthLabel };