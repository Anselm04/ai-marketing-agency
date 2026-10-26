/**
 * Real-time WebSocket Hook
 * Connects to the backend Socket.IO server and provides event listeners,
 * notifications, and connection status.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || '';

export function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [systemAlerts, setSystemAlerts] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      console.log('Socket connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      setConnected(false);
      console.log('Socket disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      setConnected(false);
      console.error('Socket connection error:', err.message);
    });

    socket.on('notification', (data) => {
      setNotifications((prev) => [data, ...prev].slice(0, 50));
    });

    socket.on('system_alert', (data) => {
      setSystemAlerts((prev) => [data, ...prev].slice(0, 10));
    });

    socket.on('user_online', (data) => {
      setOnlineUsers((prev) => {
        const exists = prev.find((u) => u.userId === data.userId);
        if (exists) return prev;
        return [...prev, data];
      });
    });

    socket.on('user_offline', (data) => {
      setOnlineUsers((prev) => prev.filter((u) => u.userId !== data.userId));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const emit = useCallback((event, data) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const dismissNotification = useCallback((notification) => {
    setNotifications((prev) => prev.filter((item) => item !== notification));
  }, []);

  const clearSystemAlerts = useCallback(() => {
    setSystemAlerts([]);
  }, []);

  return {
    socket: socketRef.current,
    connected,
    notifications,
    systemAlerts,
    onlineUsers,
    emit,
    clearNotifications,
    dismissNotification,
    clearSystemAlerts,
  };
}

export default useSocket;
