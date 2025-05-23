import { Server as SocketIOServer } from "socket.io"
import type { Server as HTTPServer } from "http"

export let io: SocketIOServer | null = null

export const createSocket = (server: HTTPServer)=> {
  io = new SocketIOServer(server, {
    pingInterval: 30000,
    pingTimeout: 60000,
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  })

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id)
    emit('hello', {world: true})
    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id)
    })
  })
}

export const emit = (evt: string, data?: any) => {
  if(io) {
    io.emit(evt, data);
  }
}
