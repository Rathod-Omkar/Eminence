const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const protect = require('../middleware/authMiddleware');
const { bookingsLimiter, aiBookingLimiter } = require('../middleware/rateLimiter');

router.post('/', protect, bookingsLimiter, bookingController.createBooking);
router.get('/', protect, bookingsLimiter, bookingController.getAllBookings);
router.get('/:id', protect, bookingsLimiter, bookingController.getBookingById);
router.put('/:id/status', protect, bookingsLimiter, bookingController.updateBookingStatus);
router.post('/:id/cancel', protect, bookingsLimiter, bookingController.cancelBooking);
router.post('/:id/complete', protect, bookingsLimiter, bookingController.completeBooking);
router.post('/ai-booking', protect, aiBookingLimiter, bookingController.aiVoiceBooking);

module.exports = router;
