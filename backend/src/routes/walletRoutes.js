const express = require('express');
const router = express.Router();
const { 
  getWallet, 
  applyReferralCode, 
  createWalletOrder, 
  verifyWalletFunds 
} = require('../controllers/walletController');
const authMiddleware = require('../middleware/authMiddleware');
const { apiLimiter, authLimiter } = require('../middleware/rateLimiter');

// Apply auth middleware before rate limiting so getClientKey uses req.user.id
router.use(authMiddleware);
router.use(apiLimiter);

router.get('/', getWallet);
router.post('/referral', authLimiter, applyReferralCode);
router.post('/create-order', authLimiter, createWalletOrder);
router.post('/verify-funds', authLimiter, verifyWalletFunds);

module.exports = router;
