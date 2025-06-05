import bcrypt from 'bcrypt'
import { Router } from 'express'
import { passport } from 'utils/auth/passport'
import jwt from 'jsonwebtoken';

import { prisma } from 'utils/db'

const router = Router()

const JWT_EXPIRES_IN = '1d';

router.post('/register', async (req, res) => {
  const {email, username, password} = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required.' })
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return res.status(409).json({ error: 'Email already registered.' })
    }
    const hashed = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({ data: { email, password: hashed, username } })

    return res.status(201).json({ id: user.id, email: user.email, username })

  } catch (err) {
    console.error('Register error:', err)
    return res.status(500).json({ error: 'Internal server error.' })
  }
})

router.post('/login', (req, res, next) => {
  passport.authenticate('local', { session: false }, (err, user, info) => {
    if (err) {
      return res.status(500).json({ error: 'Internal server error.' });
    }
    if (!user) {
      return res.status(401).json({ error: info?.message || 'Authentication failed.' });
    }
    // User is valid; sign a JWT:
    const payload = { sub: (user as any).id, email: (user as any).email };
    const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: JWT_EXPIRES_IN });
    return res.json({ token });
  })(req, res, next);
})

router.get('/me', passport.authenticate('jwt', { session: false }),
  (req, res) => {
    // @ts-ignore: user came from JwtStrategy
    const user = req.user;

    return res.json(user);
  })




export default router
