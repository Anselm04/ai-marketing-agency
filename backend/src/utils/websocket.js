/**
 * Socket.IO Real-Time Service
 * Provides WebSocket rooms for org-scoped events, user-specific events,
 * and system-wide notifications with authentication middleware.
 */

import { Server } from 'socket.io';
import store from './store.js';
import { logger } from './logger.js';

let io = null;
const WEBSOCKET_ENABLED = process.env.WEBSOCKET_ENABLED !== 'false';
const WEBSOCKET_CORS_ORIGIN = process.env.WEBSOCKET_CORS_ORIGIN || process.env.CORS_ORIGIN || 'http://localhost:3000';

/**
 * Initialize Socket.IO server with authentication middleware.
 */
export function initializeWebSocket(httpServer) {
  if (!WEBSOCKET_ENABLED || !httpServer) {
    logger.info('WebSocket disabled or no HTTP server provided');
    return null;
  }

  io = new Server(httpServer, {
    cors: {
      origin: WEBSOCKET_CORS_ORIGIN.split(',').map((s) => s.trim()),
      credentials: true,
    },
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 30000,
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }
      const decoded = await store.verifyToken(token);
      socket.userId = decoded.userId;
      socket.orgId = decoded.organizationId || 'personal';
      socket.role = decoded.role || 'user';
      next();
    } catch (err) {
      logger.warn('WebSocket auth failed', { error: err.message });
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info('WebSocket client connected', { userId: socket.userId, orgId: socket.orgId, socketId: socket.id });

    // Join org-scoped room
    socket.join(`org:${socket.orgId}`);
    socket.join(`user:${socket.userId}`);

    // Handle client events
    socket.on('subscribe', (room) => {
      if (room.startsWith(`org:${socket.orgId}`) || room.startsWith(`user:${socket.userId}`)) {
        socket.join(room);
        socket.emit('subscribed', { room });
      } else {
        socket.emit('error', { message: 'Unauthorized room' });
      }
    });

    socket.on('unsubscribe', (room) => {
      socket.leave(room);
      socket.emit('unsubscribed', { room });
    });

    socket.on('typing', (data) => {
      socket.to(`org:${socket.orgId}`).emit('typing', { userId: socket.userId, ...data });
    });

    socket.on('disconnect', (reason) => {
      logger.info('WebSocket client disconnected', { userId: socket.userId, reason, socketId: socket.id });
    });
  });

  logger.info('Socket.IO initialized');
  return io;
}

/**
 * Get the Socket.IO instance.
 */
export function getIO() {
  return io;
}

/**
 * Emit an event to a specific organization room.
 */
export function emitToOrg(orgId, event, data) {
  if (!io || !WEBSOCKET_ENABLED) return;
  io.to(`org:${orgId}`).emit(event, {
    ...data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Emit an event to a specific user.
 */
export function emitToUser(userId, event, data) {
  if (!io || !WEBSOCKET_ENABLED) return;
  io.to(`user:${userId}`).emit(event, {
    ...data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Emit an event to all connected clients (system-wide).
 */
export function emitToAll(event, data) {
  if (!io || !WEBSOCKET_ENABLED) return;
  io.emit(event, {
    ...data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Notify agent status update in real-time.
 */
export function notifyAgentStatus(orgId, agentId, status, details = {}) {
  emitToOrg(orgId, 'agent:status', {
    agentId,
    status, // 'idle', 'running', 'completed', 'failed'
    ...details,
  });
}

/**
 * Notify task progress in real-time.
 */
export function notifyTaskProgress(userId, taskId, progress, message = '') {
  emitToUser(userId, 'task:progress', {
    taskId,
    progress, // 0-100
    message,
  });
}

/**
 * Send a notification to a user or org.
 */
export function sendNotification(userId, orgId, notification) {
  const payload = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: notification.type || 'info', // 'info', 'success', 'warning', 'error'
    title: notification.title,
    message: notification.message,
    action: notification.action || null,
    read: false,
    ...notification,
    timestamp: new Date().toISOString(),
  };

  if (userId) {
    emitToUser(userId, 'notification', payload);
  } else if (orgId) {
    emitToOrg(orgId, 'notification', payload);
  }

  return payload;
}

/**
 * Broadcast system-wide alert.
 */
export function broadcastSystemAlert(level, title, message) {
  emitToAll('system:alert', {
    level, // 'info', 'warning', 'critical'
    title,
    message,
  });
}

/**
 * Graceful shutdown.
 */
export async function closeWebSocket() {
  if (!io) return;
  return new Promise((resolve) => {
    io.close(() => {
      logger.info('Socket.IO server closed');
      resolve();
    });
  });
}

export default {
  initializeWebSocket,
  getIO,
  emitToOrg,
  emitToUser,
  emitToAll,
  notifyAgentStatus,
  notifyTaskProgress,
  sendNotification,
  broadcastSystemAlert,
  closeWebSocket,
};

