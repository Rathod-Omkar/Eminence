const crypto = require('crypto');
const { createWalletOrder, verifyWalletFunds } = require('../../src/controllers/walletController');
const { createBooking } = require('../../src/controllers/bookingController');
const { Customer } = require('../../src/models');

function mockResponse() {
  const res = {
    statusCode: null,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    }
  };
  return res;
}

describe('Module: Booking Date Validation & Wallet Razorpay Integration', () => {
  let testCustomer;

  beforeAll(async () => {
    // Ensure a valid customer exists in the test DB for foreign key relations
    [testCustomer] = await Customer.findOrCreate({
      where: { phone: '9988776655' },
      defaults: {
        name: 'Unit Test Customer',
        phone: '9988776655',
        email: 'unittest@eminence.test'
      }
    });
  });

  describe('Booking Past Date Restriction', () => {
    test('should immediately reject booking date in the past with 400 status', async () => {
      const req = {
        user: { id: testCustomer.id },
        body: {
          pickupAddress: 'Shivajinagar, Pune',
          dropAddress: 'Kothrud, Pune',
          date: '2020-01-01',
          time: '14:00',
          estimatedFare: 450,
          goodsType: 'Electronics',
          weight: 100,
          tempoType: 'small'
        }
      };
      const res = mockResponse();

      await createBooking(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.data.success).toBe(false);
      expect(res.data.message).toMatch(/Booking date cannot be in the past/i);
    });

    test('should reject scheduledAt in the past with 400 status', async () => {
      const pastDate = new Date(Date.now() - 86400000 * 2).toISOString();
      const req = {
        user: { id: testCustomer.id },
        body: {
          pickupAddress: 'Shivajinagar, Pune',
          dropAddress: 'Kothrud, Pune',
          scheduledAt: pastDate,
          estimatedFare: 450,
          goodsType: 'Electronics',
          weight: 100,
          tempoType: 'small'
        }
      };
      const res = mockResponse();

      await createBooking(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.data.success).toBe(false);
      expect(res.data.message).toMatch(/Scheduled booking date cannot be in the past/i);
    });

    test('should reject advance booking date beyond 1 month with 400 status', async () => {
      const farFuture = new Date();
      farFuture.setDate(farFuture.getDate() + 60); // 2 months in future
      const farFutureStr = `${farFuture.getFullYear()}-${String(farFuture.getMonth() + 1).padStart(2, '0')}-${String(farFuture.getDate()).padStart(2, '0')}`;

      const req = {
        user: { id: testCustomer.id },
        body: {
          pickupAddress: 'Shivajinagar, Pune',
          dropAddress: 'Kothrud, Pune',
          date: farFutureStr,
          time: '14:00',
          estimatedFare: 450,
          goodsType: 'Electronics',
          weight: 100,
          tempoType: 'small'
        }
      };
      const res = mockResponse();

      await createBooking(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.data.success).toBe(false);
      expect(res.data.message).toMatch(/Advance booking is limited to 1 month only/i);
    });

    test('should reject scheduledAt beyond 1 month with 400 status', async () => {
      const farFuture = new Date(Date.now() + 86400000 * 60).toISOString();
      const req = {
        user: { id: testCustomer.id },
        body: {
          pickupAddress: 'Shivajinagar, Pune',
          dropAddress: 'Kothrud, Pune',
          scheduledAt: farFuture,
          estimatedFare: 450,
          goodsType: 'Electronics',
          weight: 100,
          tempoType: 'small'
        }
      };
      const res = mockResponse();

      await createBooking(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.data.success).toBe(false);
      expect(res.data.message).toMatch(/Advance booking is limited to 1 month only/i);
    });
  });

  describe('Wallet Top-Up Order Creation', () => {
    test('should reject top-up amount less than minimum threshold ₹10', async () => {
      const req = {
        user: { id: testCustomer.id },
        body: { amount: 5 }
      };
      const res = mockResponse();

      await createWalletOrder(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.data.success).toBe(false);
      expect(res.data.message).toContain('Minimum top-up amount is ₹10');
    });

    test('should reject invalid non-numeric amount', async () => {
      const req = {
        user: { id: testCustomer.id },
        body: { amount: 'invalid-amount' }
      };
      const res = mockResponse();

      await createWalletOrder(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.data.success).toBe(false);
    });

    test('should reject top-up amount exceeding maximum limit ₹100,000', async () => {
      const req = {
        user: { id: testCustomer.id },
        body: { amount: 150000 }
      };
      const res = mockResponse();

      await createWalletOrder(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.data.success).toBe(false);
      expect(res.data.message).toContain('Maximum top-up amount is ₹1,00,000');
    });

    test('should create valid order for ₹500', async () => {
      const req = {
        user: { id: testCustomer.id },
        body: { amount: 500 }
      };
      const res = mockResponse();

      await createWalletOrder(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.order).toBeDefined();
      expect(res.data.order.amount).toBe(50000); // 500 * 100 paise
      expect(res.data.order.currency).toBe('INR');
    });
  });

  describe('Wallet Payment Signature Verification & Credit', () => {
    test('should reject missing signature verification credentials', async () => {
      const req = {
        user: { id: testCustomer.id },
        body: { amount: 500 }
      };
      const res = mockResponse();

      await verifyWalletFunds(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.data.success).toBe(false);
    });

    test('should reject invalid Razorpay HMAC signature', async () => {
      const req = {
        user: { id: testCustomer.id },
        body: {
          razorpay_order_id: 'order_test_123',
          razorpay_payment_id: 'pay_test_456',
          razorpay_signature: 'invalid_tampered_signature_hex',
          amount: 500
        }
      };
      const res = mockResponse();

      await verifyWalletFunds(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.data.success).toBe(false);
      expect(res.data.message).toMatch(/Invalid payment signature/i);
    });

    test('should verify valid HMAC signature and credit wallet balance', async () => {
      const orderId = 'order_valid_789';
      const paymentId = 'pay_valid_999_' + Date.now();
      const secret = process.env.RAZORPAY_KEY_SECRET || 'mock_secret';
      const expectedSign = crypto
        .createHmac('sha256', secret)
        .update(orderId + '|' + paymentId)
        .digest('hex');

      const req = {
        user: { id: testCustomer.id },
        body: {
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: expectedSign,
          amount: 500
        }
      };
      const res = mockResponse();

      await verifyWalletFunds(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.message).toMatch(/₹500.00 added to your wallet successfully/i);
      expect(res.data.newBalance).toBeGreaterThanOrEqual(500);
    });

    test('should be idempotent and prevent duplicate credits on replayed payment id', async () => {
      const orderId = 'order_idempotent_123';
      const paymentId = 'pay_idempotent_reuse_' + Date.now();
      const secret = process.env.RAZORPAY_KEY_SECRET || 'mock_secret';
      const signature = crypto
        .createHmac('sha256', secret)
        .update(orderId + '|' + paymentId)
        .digest('hex');

      const req = {
        user: { id: testCustomer.id },
        body: {
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
          amount: 250
        }
      };

      // First call: Credits the wallet
      const res1 = mockResponse();
      await verifyWalletFunds(req, res1);
      expect(res1.statusCode).toBe(200);
      const balanceAfterFirst = res1.data.newBalance;

      // Second replayed call: Returns existing balance without double crediting
      const res2 = mockResponse();
      await verifyWalletFunds(req, res2);
      expect(res2.statusCode).toBe(200);
      expect(res2.data.newBalance).toBe(balanceAfterFirst);
      expect(res2.data.message).toMatch(/already verified/i);
    });
  });
});
