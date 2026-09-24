import { Server } from "socket.io";
import socketAuth from "../socket/socketAuth.js";
import registerChatSocketHandlers from "../socket/chatSocket.js";
import registerVideoSocketHandlers from "../socket/videoSocket.js";

let io = null;

export const initSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.CLIENT_URL || 'http://localhost:5173',
            credentials: true,
            methods: ["GET", "POST"]
        }
    });

    io.use(socketAuth);

    io.on("connection", (socket) => {
        registerChatSocketHandlers(io, socket);
        registerVideoSocketHandlers(io, socket);
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error("Socket.IO server has not been initialized");
    }
    return io;
};

export default initSocket;
