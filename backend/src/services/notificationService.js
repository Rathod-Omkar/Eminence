const crypto = require('crypto');
const { Notification } = require('../models');

/**
 * Safely retrieve the initialized Socket.io instance
 */
const getSocketIo = () => {
  try {
    const { getIo } = require('../socket');
    return getIo();
  } catch (_err) {
    return null;
  }
};

/**
 * Creates and emits a notification in real-time
 * @param {Object} params
 * @param {string} [params.userId] - Recipient user UUID (optional for admin-wide broadcasts)
 * @param {string} [params.recipientRole] - 'customer' | 'admin' | 'driver' | 'all'
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification message body
 * @param {string} params.type - 'order_created' | 'driver_assigned' | 'arrived' | 'in_transit' | 'completed' | 'cancelled' | 'expired' | 'sos' | 'support' | 'system'
 * @param {Object} [params.metadata] - Extra metadata like bookingId, ticketId, url
 */
const createAndEmitNotification = async ({
  userId = null,
  recipientRole = 'customer',
  title,
  message,
  type = 'system',
  metadata = null,
}) => {
  try {
    if (!title || !message) {
      console.warn('[NotificationService] Missing title or message for notification');
      return null;
    }

    const notification = await Notification.create({
      id: crypto.randomUUID(),
      userId: userId || null,
      recipientRole: recipientRole || 'customer',
      title,
      message,
      type: type || 'system',
      isRead: false,
      metadata: metadata || {},
    });

    const payload = {
      id: notification.id,
      userId: notification.userId,
      recipientRole: notification.recipientRole,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      isRead: false,
      metadata: notification.metadata,
      createdAt: notification.createdAt,
    };

    const io = getSocketIo();
    if (io) {
      if (userId) {
        io.to(`user_${userId}`).emit('new_notification', payload);
        io.to(`user_${userId}`).emit('notification', payload);
      }
      if (recipientRole === 'admin') {
        io.to('admin_notifications').emit('new_notification', payload);
        io.to('admin_notifications').emit('notification', payload);
        io.to('admin_inbox').emit('new_notification', payload);
      }
      if (recipientRole === 'all') {
        io.emit('new_notification', payload);
        io.emit('notification', payload);
      }
    }

    return notification;
  } catch (error) {
    console.warn('[NotificationService] Failed to create or emit notification:', error.message);
    return null;
  }
};

module.exports = {
  createAndEmitNotification,
  getSocketIo,
};
