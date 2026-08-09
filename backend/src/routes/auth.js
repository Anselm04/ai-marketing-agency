import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import store from '../utils/store.js';
import { validateBody } from '../middleware/validate.js';
import { sendPasswordReset, sendWelcomeEmail } from '../services/emailService.js';

const router = express.Router();

router.post('/register',
  validateBody({
    email: { required: true, type: 'string', minLength: 5 },
    password: { required: true, type: 'string', minLength: 6 },
    firstName: { required: false, type: 'string' },
    lastName: { required: false, type: 'string' },
  }),
  async (req, res) => {
    const { email, password, firstName, lastName } = req.body;
    try {
      const user = await store.createUser({
        email: email.toLowerCase(),
        password,
        profile: { firstName, lastName },
      });
      const token = store.generateToken(user.id);
      // Send welcome email asynchronously (don't block registration)
      sendWelcomeEmail(user.email, user.profile?.firstName).catch(() => {});
      res.status(201).json({ token, user });
    } catch (err) {
      res.status(409).json({ error: err.message });
    }
  }
);

router.post('/login',
  validateBody({
    email: { required: true, type: 'string' },
    password: { required: true, type: 'string' },
  }),
  async (req, res) => {
    const { email, password } = req.body;
    try {
      const user = await store.findUserByEmail(email.toLowerCase());
      if (!user || !(await store.comparePassword(password, user.password))) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const token = store.generateToken(user.id);
      const { password: _, ...safe } = user;
      res.json({ token, user: safe });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

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
    const { password, ...safe } = user;
    res.json(safe);
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
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await store.updateUser(user.id, { resetToken, resetTokenExpires });

    // Send actual email via configured provider (SendGrid/SES/SMTP)
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password`;
    const emailResult = await sendPasswordReset(email, resetToken, resetUrl);

    res.json({
      success: true,
      message: 'If an account exists, a reset link has been sent.',
      devToken: emailResult.fallback ? resetToken : undefined,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password || password.length < 6) {
      return res.status(400).json({ error: 'Token and password (min 6 chars) required' });
    }

    const user = store.getUsers().find(u => u.resetToken === token);
    if (!user || new Date(user.resetTokenExpires) < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const hashed = await bcrypt.hash(password, 12);
    await store.updateUser(user.id, { password: hashed, resetToken: null, resetTokenExpires: null });
    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;