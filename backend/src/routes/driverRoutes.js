const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const { getSurgeHeatmap } = require('../services/aiForecasting');
const protect = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');
const { apiLimiter, locationTrackingLimiter } = require('../middleware/rateLimiter');

// Add heatmap route (protected for driver or admin)
router.get('/heatmap', protect, authorize('driver', 'admin'), apiLimiter, (req, res) => {
  try {
    const data = getSurgeHeatmap();
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error fetching heatmap' });
  }
});

const { Inventory } = require('../models');

// Inventory scanning route for WMS (protected)
router.all('/scan-inventory', protect, authorize('driver', 'admin'), apiLimiter, async (req, res) => {
  try {
    const barcode = req.body.barcode || req.query.barcode;

    if (!barcode && process.env.NODE_ENV === 'production') {
      return res.status(400).json({
        success: false,
        message: 'Barcode parameter is required'
      });
    }

    if (barcode) {
      const realItem = await Inventory.findOne({ where: { barcode } });
      if (realItem) {
        realItem.status = 'Loaded';
        await realItem.save();
        return res.status(200).json({
          success: true,
          message: 'Item scanned and marked Loaded successfully',
          item: realItem
        });
      }
    }

    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found for the provided barcode. Mock scanning is disabled in production.'
      });
    }

    // Development/test mock fallback
    const fallbackBarcode = barcode || 'MOCK-BOX-001';
    res.status(200).json({ 
      success: true, 
      message: 'Item scanned successfully (mock mode)',
      item: {
        barcode: fallbackBarcode,
        itemName: 'Simulated Cargo Box',
        status: 'Loaded'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error scanning barcode' });
  }
});

router.get('/', protect, authorize('driver', 'admin'), apiLimiter, driverController.getAllDrivers);
router.post('/', protect, authorize('admin'), apiLimiter, driverController.createDriver);
router.patch('/:id/toggle', protect, authorize('driver', 'admin'), apiLimiter, driverController.toggleAvailability);
router.post('/location', protect, authorize('driver'), locationTrackingLimiter, driverController.updateLocation);
router.get('/:id/metrics', protect, authorize('driver', 'admin'), apiLimiter, driverController.getDriverMetrics);
router.get('/:id/queue', protect, authorize('driver', 'admin'), apiLimiter, driverController.getDriverQueue);
router.put('/:id/queue/activate/:bookingId', protect, authorize('driver', 'admin'), apiLimiter, driverController.activateQueuedTrip);
router.get('/:id/payslip', protect, authorize('driver', 'admin'), apiLimiter, driverController.generatePayslip);
router.get('/:id/payslip/download', protect, authorize('driver', 'admin'), apiLimiter, driverController.downloadPayslip);

module.exports = router;
