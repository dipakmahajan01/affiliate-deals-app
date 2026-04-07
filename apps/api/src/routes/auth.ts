import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';

const router = Router();

// POST /v1/auth/register
router.post('/register', async (req: Request, res: Response) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ error: 'Email is already registered' });

  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, password: hash });

  const token = jwt.sign(
    { userId: user._id, role: 'user' },
    process.env.JWT_SECRET ?? 'secret',
    { expiresIn: '30d' }
  );

  res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email } });
});

// POST /v1/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

  const token = jwt.sign(
    { userId: user._id, role: 'user' },
    process.env.JWT_SECRET ?? 'secret',
    { expiresIn: '30d' }
  );

  res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
});

export default router;
