import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

function sanitize(u) {
  const { password, ...rest } = u;
  return rest;
}

export default function userRoutes(db) {
  const router = Router();

  // GET /api/users
  router.get('/', requireAuth, requireAdmin, (req, res) => {
    res.json(db.data.users.map(sanitize));
  });

  // POST /api/users  -- add a new user
  router.post('/', requireAuth, requireAdmin, async (req, res) => {
    const { name, email, role, password } = req.body || {};
    if (!name || !email) return res.status(400).json({ error: 'name and email are required' });
    if (db.data.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }
    const user = {
      name,
      email,
      role: role || 'Homeowner',
      status: 'Active',
      password: password || 'password123'
    };
    db.data.users.unshift(user);
    await db.write();
    res.status(201).json(sanitize(user));
  });

  // PATCH /api/users/:email/toggle -- flip Active/Inactive
  router.patch('/:email/toggle', requireAuth, requireAdmin, async (req, res) => {
    const user = db.data.users.find(u => u.email.toLowerCase() === req.params.email.toLowerCase());
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.status = user.status === 'Active' ? 'Inactive' : 'Active';
    await db.write();
    res.json(sanitize(user));
  });

  return router;
}