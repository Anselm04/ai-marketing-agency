import express from 'express';
import crypto from 'crypto';
import store from '../utils/store.js';
import { isOwnerEmail } from '../utils/owner.js';

const router = express.Router();

router.post('/register', async (req, res) => {
  const { email, password, firstName, lastName } = req.body;
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Email and password (min 8 chars) required' });
  }
  try {
    const user = await store.createUser({
      email: email.toLowerCase(),
      password,
      profile: { firstName, lastName },
    });
    const token = store.generateToken(user.id);
    res.status(201).json({ token, user: { ...user, isOwner: isOwnerEmail(user.email) } });
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  try {
    const user = await store.findUserByEmail(email.toLowerCase());
    if (!user || !(await store.comparePassword(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = store.generateToken(user.id);
    const { password: _, resetToken, resetTokenExpires, ...safe } = user;
    res.json({ token, user: { ...safe, isOwner: isOwnerEmail(user.email) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing token' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = store.verifyToken(token);
    const user = await store.findUserById(decoded.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const { password, resetToken, resetTokenExpires, ...safe } = user;
    res.json({ ...safe, isOwner: isOwnerEmail(user.email) });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await store.findUserByEmail(email.toLowerCase());
    if (!user) {
      return res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
    }
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await store.setSettings('password_reset:' + tokenHash, {
      userId: user.id,
      expiresAt: resetTokenExpires,
    });

    const response = {
      success: true,
      message: 'If an account exists, a reset link has been sent.',
    };
    if (process.env.NODE_ENV !== 'production') response.devToken = resetToken;
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password || password.length < 8) {
      return res.status(400).json({ error: 'Token and password (min 8 chars) required' });
    }
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const key = 'password_reset:' + tokenHash;
    const reset = await store.getSetting(key);
    await store.deleteSetting(key);
    if (!reset?.userId || !reset.expiresAt || new Date(reset.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }
    const updated = await store.setUserPassword(reset.userId, password);
    if (!updated) return res.status(400).json({ error: 'Invalid or expired token' });
    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
