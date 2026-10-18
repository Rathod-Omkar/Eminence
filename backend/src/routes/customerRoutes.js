const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const authMiddleware = require('../middleware/authMiddleware');
const { apiLimiter, paymentLimiter } = require('../middleware/rateLimiter');

// All customer routes are protected (auth runs first to ensure per-user rate attribution)
router.use(authMiddleware);
router.use(apiLimiter);

// Eminence Pro Subscription routes
router.get('/pro/status', customerController.getProStatus);
router.post('/pro/create-order', paymentLimiter, customerController.createProOrder);
router.post('/pro/verify', paymentLimiter, customerController.verifyProSubscription);

module.exports = router;
