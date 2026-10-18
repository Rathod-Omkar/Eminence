const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const { authLimiter, otpLimiter } = require('../middleware/rateLimiter');

// Public Route (with rate limiting)
router.get('/terms', authController.getTerms);
router.post('/google-login', authLimiter, authController.googleLogin);
router.post('/phone-login', otpLimiter, authController.phoneLogin);
router.post('/phone-verify', authLimiter, authController.phoneVerify);
router.post('/register', authLimiter, authController.register);
router.post('/register-password', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/login-password', authLimiter, authController.login);
router.post('/forgot-password', otpLimiter, authController.forgotPassword);
router.post('/reset-password', authLimiter, authController.resetPassword);

// Protected Routes (authMiddleware placed before rate limiters to authenticate user first for accurate per-user rate attribution)
router.get('/profile', authMiddleware, authLimiter, authController.getProfile);
router.get('/me', authMiddleware, authLimiter, authController.getProfile);
router.post('/accept-terms', authMiddleware, authLimiter, authController.acceptTerms);
router.post('/complete-profile', authMiddleware, authLimiter, authController.updateProfile);
router.post('/change-password', authMiddleware, authLimiter, authController.changePassword);
router.post('/send-otp', authMiddleware, otpLimiter, authController.sendOtp);
router.post('/verify-otp', authMiddleware, authLimiter, authController.verifyOtp);

// DPDP / GDPR Compliance Routes
router.get('/export-data', authMiddleware, authLimiter, authController.exportUserData);
router.post('/delete-account', authMiddleware, authLimiter, authController.deleteUserData);

module.exports = router;
