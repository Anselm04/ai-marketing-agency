import express from 'express';
import crypto from 'crypto';
import store from '../utils/store.js';
import { isOwnerEmail } from '../utils/owner.js';
import { sendPasswordReset, emailTransportConfigured } from '../services/emailService.js';

const router = express.Router();
const LEGAL_VERSION = '2026-10-21';

router.post('/register', async (req, res) => {
  const { email, password, firstName, lastName, acceptedTerms } = req.body;
  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Email and password (min 8 chars) required' });
  }
  if (acceptedTerms !== true) {
    return res.status(400).json({
      error: 'You must agree to the Terms of Service and Privacy Policy to create an account.',
      code: 'legal_acceptance_required',
    });
  }
  if (isOwnerEmail(email)) {
    return res.status(403).json({ error: 'This identity must be provisioned by the operator.', code: 'reserved_identity' });
  }
  try {
    const acceptedAt = new Date().toISOString();
    const user = await store.createUser({
      email: email.trim().toLowerCase(),
      password,
      profile: {
        firstName,
        lastName,
        legalAcceptance: {
          version: LEGAL_VERSION,
          terms: true,
          privacy: true,
          acceptedAt,
        },
      },
    });
    const token = await store.generateToken(user.id);
    res.status(201).json({ token, user: { ...user, isOwner: isOwnerEmail(user.email) } });
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  try {
    const user = await store.findUserByEmail(email.trim().toLowerCase());
    const authenticatedHash = user?.password;
    if (!user || !(await store.comparePassword(password, authenticatedHash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = await store.generateToken(user.id, authenticatedHash);
    const { password: _, resetToken, resetTokenExpires, ...safe } = user;
    res.json({ token, user: { ...safe, isOwner: isOwnerEmail(user.email) } });
  } catch (err) {
    if (err.code === 'credentials_changed') return res.status(401).json({ error: 'Credentials changed; please sign in again' });
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
    const decoded = await store.verifyToken(token);
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
    const transportConfigured = emailTransportConfigured();
    if (process.env.NODE_ENV === 'production' && !transportConfigured) {
      return res.status(503).json({
        error: 'Password reset email is temporarily unavailable. Please try again later.',
        code: 'password_reset_email_unavailable',
      });
    }

    const { email } = req.body;
    const user = await store.findUserByEmail(String(email || '').toLowerCase());
    const generic = {
      success: true,
      message: 'If an account exists and email delivery succeeds, a reset link will arrive shortly.',
    };
    if (!user) {
      return res.json(generic);
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const resetKey = 'password_reset:' + tokenHash;
    await store.setSettings(resetKey, {
      userId: user.id,
      expiresAt: resetTokenExpires,
    });

    const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${appUrl.replace(/\/$/, '')}/reset-password`;
    if (transportConfigured) {
      const delivery = await sendPasswordReset(user.email, resetToken, resetUrl);
      if (!delivery?.success) {
        await store.deleteSetting(resetKey);
        // Keep the public response non-enumerating. The wording above never claims that a message was sent.
        return res.json(generic);
      }
    }

    const response = { ...generic };
    if (process.env.NODE_ENV !== 'production' && !transportConfigured) {
      response.devToken = resetToken;
      response.devResetUrl = `${resetUrl}?token=${encodeURIComponent(resetToken)}`;
      response.note = 'Email transport not configured; devToken returned for local testing only.';
    }
    return res.json(response);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (typeof token !== 'string' || !token || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Token and password (min 8 chars) required' });
    }
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const key = 'password_reset:' + tokenHash;
    const reset = await store.takeSetting(key);
    if (!reset?.userId || !reset.expiresAt || new Date(reset.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }
    const updated = await store.setUserPassword(reset.userId, password);
    if (!updated) return res.status(400).json({ error: 'Invalid or expired token' });
    return res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;

