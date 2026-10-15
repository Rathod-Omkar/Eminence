const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const authMiddleware = require('../middleware/authMiddleware');
const { apiLimiter } = require('../middleware/rateLimiter');

// All customer routes are protected
router.use(apiLimiter);
router.use(authMiddleware);

// Eminence Pro Subscription routes
router.get('/pro/status', customerController.getProStatus);
router.post('/pro/create-order', customerController.createProOrder);
router.post('/pro/verify', customerController.verifyProSubscription);

module.exports = router;
