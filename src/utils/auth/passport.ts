import bcrypt from 'bcrypt'
import passport_ from 'passport'
import { ExtractJwt, Strategy as JwtStrategy } from 'passport-jwt'
import { Strategy as LocalStrategy } from 'passport-local'
import { prisma } from 'utils/db'

passport_.use(
  new LocalStrategy(
    { usernameField: 'email', passwordField: 'password' },
    async (email, password, done) => {
      try {
        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) {
          return done(null, false, { message: 'Invalid email or password.' })
        }
        const match = await bcrypt.compare(password, user.password)
        if (!match) {
          return done(null, false, { message: 'Invalid email or password.' })
        }
        // Remove password before passing on
        const safeUser = { id: user.id, email: user.email, createdAt: user.createdAt }
        return done(null, safeUser)
      } catch (err) {
        return done(err as any)
      }
    }
  )
)

passport_.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
    },
    async (jwtPayload, done) => {
      try {
        // jwtPayload was signed at login: { sub: user.id, email: user.email, iat, exp }
        const user = await prisma.user.findUnique({
          where: { id: (jwtPayload as any).sub },
        })
        if (!user) {
          return done(null, false)
        }
        // strip password
        const safeUser = { id: user.id, email: user.email, username: user.username, createdAt: user.createdAt }
        return done(null, safeUser)
      } catch (err) {
        return done(err as any, false)
      }
    }
  )
)

export const passport = passport_

