import express from "express"
import cors from 'cors'
import { prisma } from 'utils/db'
import { createSocket } from './src/sockets'
import apiRoutes from './src/routes'
import http from "http"
import passport from 'passport';
import bcrypt from 'bcrypt';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import dotenv from "dotenv";

dotenv.config();


const app = express()
const server = http.createServer(app)

app.use(cors());
app.use(express.json())

// store: new (require('connect-redis')(session))({ client: redisClient })




app.use('/v1', apiRoutes)

const PORT = process.env.PORT || 5000

createSocket(server);

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})

server.setTimeout(1000 * 60 * 10);
