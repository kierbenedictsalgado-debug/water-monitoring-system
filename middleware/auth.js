import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'aquatrack-dev-secret-change-me';

export function signToken(user) {
  return jwt.sign(
    { email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'Administrator') {
    return res.status(403).json({ error: 'Administrator access required' });
  }
  next();
}