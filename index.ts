import express from "express"
import cors from 'cors'
import { createSocket } from './src/sockets'
import apiRoutes from './src/routes'
import http from "http"

const app = express()
const server = http.createServer(app)

app.use(cors())
app.use(express.json())

app.use('/v1', apiRoutes)

const PORT = process.env.PORT || 5000

createSocket(server);

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})

server.setTimeout(1000 * 60 * 10);
