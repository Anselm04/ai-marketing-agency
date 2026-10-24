import store from '../utils/store.js';
import { isOwnerEmail } from '../utils/owner.js';
import { runWithRequestContext } from '../utils/requestContext.js';

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = await store.verifyToken(token);
    const user = await store.findUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    const { password, resetToken, resetTokenExpires, ...safe } = user;
    req.user = { ...safe, isOwner: isOwnerEmail(user.email) };
    req.userId = user.id;
    return runWithRequestContext({ userId: user.id }, next);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

export function requireAdmin(req, res, next) {
  return requireRole('admin')(req, res, next);
}

