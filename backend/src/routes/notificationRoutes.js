const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const protect = require('../middleware/authMiddleware');
const { apiLimiter } = require('../middleware/rateLimiter');

router.use(protect);
router.use(apiLimiter);

router.get('/', notificationController.getNotifications);
router.put('/mark-all-read', notificationController.markAllAsRead);
router.put('/:id/read', notificationController.markAsRead);

module.exports = router;
