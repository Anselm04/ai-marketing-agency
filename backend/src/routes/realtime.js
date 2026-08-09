/**
 * Real-Time WebSocket Routes
 * Provides endpoints for real-time subscriptions, notifications, and presence.
 */

import express from 'express';
import { getIO, emitToOrg, emitToUser, sendNotification, broadcastSystemAlert } from '../utils/websocket.js';
import { authenticate } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/realtime/status
 * Check WebSocket server status and get connection count.
 */
router.get('/status', authenticate, (req, res) => {
  const io = getIO();
  if (!io) {
    return res.json({ enabled: false, connections: 0 });
  }

  // Get room counts for user's org
  const orgRoom = `org:${req.user?.organizationId || 'personal'}`;
  const userRoom = `user:${req.user?.id}`;
  const orgSockets = io.sockets.adapter.rooms.get(orgRoom)?.size || 0;
  const userSockets = io.sockets.adapter.rooms.get(userRoom)?.size || 0;

  res.json({
    enabled: true,
    totalConnections: io.engine.clientsCount,
    orgConnections: orgSockets,
    userConnections: userSockets,
  });
});

/**
 * POST /api/realtime/notify
 * Send a real-time notification to a user or organization.
 */
router.post('/notify', authenticate, (req, res) => {
  const { userId, orgId, title, message, type = 'info', action = null } = req.body;

  if (!title || !message) {
    return res.status(400).json({ error: 'Title and message are required' });
  }

  const notification = sendNotification(userId, orgId || req.user?.organizationId, {
    title,
    message,
    type,
    action,
    sender: req.user?.id,
  });

  logger.info('Notification sent via API', { userId, orgId: orgId || req.user?.organizationId, type });
  res.json({ success: true, notification });
});

/**
 * POST /api/realtime/broadcast
 * Broadcast a system-wide alert (admin only).
 */
router.post('/broadcast', authenticate, (req, res) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { level, title, message } = req.body;
  if (!title || !message) {
    return res.status(400).json({ error: 'Title and message are required' });
  }

  broadcastSystemAlert(level || 'info', title, message);
  logger.info('System alert broadcasted', { level, title, sender: req.user?.id });
  res.json({ success: true, message: 'Broadcast sent' });
});

/**
 * GET /api/realtime/presence
 * Get presence status for users in the organization.
 */
router.get('/presence', authenticate, (req, res) => {
  const io = getIO();
  if (!io) {
    return res.json({ enabled: false, users: [] });
  }

  const orgRoom = `org:${req.user?.organizationId || 'personal'}`;
  const orgSockets = io.sockets.adapter.rooms.get(orgRoom);
  const users = [];

  if (orgSockets) {
    for (const socketId of orgSockets) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        users.push({
          userId: socket.userId,
          socketId: socket.id,
          connectedAt: socket.handshake?.time,
        });
      }
    }
  }

  res.json({ enabled: true, users, count: users.length });
});

export default router;
