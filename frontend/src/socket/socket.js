import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket = null;

export const initSocketClient = () => {
  if (!socket) {
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
    socket = io(SOCKET_URL, {
      withCredentials: true,
      autoConnect: true,
      transports: ['websocket', 'polling'],
      auth: {
        token: token,
        accessToken: token
      }
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected to server successfully:', socket.id);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
    });
  } else if (!socket.connected) {
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
    if (token) {
      socket.auth = { token, accessToken: token };
      socket.connect();
    }
  }

  return socket;
};

export const getSocketClient = () => {
  return initSocketClient();
};

export const getSocket = getSocketClient;

export const disconnectSocketClient = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
