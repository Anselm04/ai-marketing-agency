import express from 'express';
import store from '../utils/store.js';
import { validateBody } from '../middleware/validate.js';

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

export default router;