const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SupportTicket = sequelize.define('SupportTicket', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  ticketNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  type: {
    type: DataTypes.STRING, // 'ticket' | 'sos'
    defaultValue: 'ticket',
  },
  customerId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  driverId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  bookingId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  userName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  userPhone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  userRole: {
    type: DataTypes.STRING, // 'customer' | 'driver'
    defaultValue: 'customer',
  },
  subject: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  category: {
    type: DataTypes.STRING,
    defaultValue: 'general',
  },
  priority: {
    type: DataTypes.STRING, // 'low' | 'medium' | 'high' | 'critical'
    defaultValue: 'medium',
  },
  status: {
    type: DataTypes.STRING, // 'open' | 'in_progress' | 'resolved' | 'closed'
    defaultValue: 'open',
  },
  location: {
    type: DataTypes.JSON, // { lat, lng, address }
    allowNull: true,
  },
  messages: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
  },
  resolvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'SupportTickets',
});

module.exports = SupportTicket;
