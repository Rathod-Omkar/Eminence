const express = require('express');
const router = express.Router();
const supportController = require('../controllers/supportController');
const protect = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');
const { apiLimiter } = require('../middleware/rateLimiter');

// 1. Ticket Management
router.post('/tickets', protect, apiLimiter, supportController.createTicket);
router.get('/tickets', protect, apiLimiter, supportController.getTickets);
router.get('/tickets/:id', protect, apiLimiter, supportController.getTicketById);
router.post('/tickets/:id/messages', protect, apiLimiter, supportController.addTicketMessage);

// 2. Driver SOS Emergency Alert (Available with or without token in case of driver device emergency)
router.post('/sos', apiLimiter, (req, res, next) => {
  // Try protect middleware if auth header exists, else continue
  if (req.headers.authorization || req.cookies?.accessToken) {
    return protect(req, res, next);
  }
  next();
}, supportController.triggerDriverSos);

// 3. Admin Ticket Management
router.put('/tickets/:id/status', protect, authorize('admin'), apiLimiter, supportController.updateTicketStatus);

// 4. Admin Unified Support Stream (Chats + Tickets + SOS)
router.get('/unified', protect, authorize('admin'), apiLimiter, async (req, res) => {
  try {
    const items = await supportController.getAllSupportItems();
    res.status(200).json({ success: true, count: items.length, items });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching unified support items' });
  }
});

module.exports = router;
