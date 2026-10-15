const crypto = require('crypto');
const { register, login, getProfile } = require('../../src/controllers/authController');
const { createProOrder, verifyProSubscription, getProStatus } = require('../../src/controllers/customerController');
const { bulkDeleteCustomers, bulkDeleteDrivers, bulkDeleteAdmins } = require('../../src/controllers/adminController');
const { Customer, Driver, Admin, Wallet, Transaction, Address } = require('../../src/models');

function mockResponse() {
  const res = {
    statusCode: null,
    data: null,
    cookies: {},
    cookie(name, val, options) {
      this.cookies[name] = val;
    },
    clearCookie(name) {
      delete this.cookies[name];
    },
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

describe('System Features & Enhancements Suite', () => {
  describe('1. Referral Code Generation & Registration Dual Credit', () => {
    let referrerCustomer;
    const testReferrerEmail = `referrer_${Date.now()}@test.com`;
    const testReferrerPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;

    test('should register a customer and auto-generate referral code', async () => {
      const req = {
        body: {
          name: 'Referrer User',
          email: testReferrerEmail,
          phone: testReferrerPhone,
          password: 'Password123!',
          role: 'customer'
        }
      };
      const res = mockResponse();

      await register(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.data.success).toBe(true);

      referrerCustomer = await Customer.findOne({ where: { email: testReferrerEmail } });
      expect(referrerCustomer).toBeDefined();
      expect(referrerCustomer.referralCode).toMatch(/^EMINENCE-[A-Z0-9]+$/);
    });

    test('should reject registration if an invalid referral code is supplied', async () => {
      const req = {
        body: {
          name: 'Invalid Ref User',
          email: `invalid_ref_${Date.now()}@test.com`,
          phone: `97${Math.floor(10000000 + Math.random() * 90000000)}`,
          password: 'Password123!',
          referralCode: 'EMINENCE-NONEXISTENT',
          role: 'customer'
        }
      };
      const res = mockResponse();

      await register(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.data.success).toBe(false);
      expect(res.data.message).toMatch(/Invalid referral code/i);
    });

    test('should credit ₹100 dual bonus to both referee and referrer upon valid referral registration', async () => {
      const refereeEmail = `referee_${Date.now()}@test.com`;
      const refereePhone = `96${Math.floor(10000000 + Math.random() * 90000000)}`;

      const req = {
        body: {
          name: 'Referee User',
          email: refereeEmail,
          phone: refereePhone,
          password: 'Password123!',
          referralCode: referrerCustomer.referralCode,
          role: 'customer'
        }
      };
      const res = mockResponse();

      await register(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.data.success).toBe(true);
      expect(res.data.message).toMatch(/₹100 referral bonus/i);

      // Verify Referee wallet
      const refereeCustomer = await Customer.findOne({ where: { email: refereeEmail } });
      expect(refereeCustomer.referredBy).toBe(referrerCustomer.referralCode);

      const refereeWallet = await Wallet.findOne({ where: { customerId: refereeCustomer.id } });
      expect(parseFloat(refereeWallet.balance)).toBe(100.00);

      // Verify Referrer wallet
      const referrerWallet = await Wallet.findOne({ where: { customerId: referrerCustomer.id } });
      expect(parseFloat(referrerWallet.balance)).toBe(100.00);
    });

    test('should auto-generate referral code on login if user lacks one', async () => {
      // Create user without referral code
      const noRefEmail = `noref_${Date.now()}@test.com`;
      const noRefPhone = `95${Math.floor(10000000 + Math.random() * 90000000)}`;
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('Password123!', 10);

      const userWithoutRef = await Customer.create({
        name: 'No Ref User',
        email: noRefEmail,
        phone: noRefPhone,
        password: hashedPassword,
        referralCode: null
      });

      const req = {
        body: {
          identifier: noRefEmail,
          password: 'Password123!',
          role: 'customer'
        }
      };
      const res = mockResponse();

      await login(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.data.success).toBe(true);

      const refreshed = await Customer.findByPk(userWithoutRef.id);
      expect(refreshed.referralCode).toMatch(/^EMINENCE-[A-Z0-9]+$/);
    });
  });

  describe('2. Eminence Pro Subscription via Razorpay', () => {
    let proTestCustomer;

    beforeAll(async () => {
      const email = `pro_user_${Date.now()}@test.com`;
      const phone = `94${Math.floor(10000000 + Math.random() * 90000000)}`;
      proTestCustomer = await Customer.create({
        name: 'Pro Candidate',
        email,
        phone,
        isPro: false
      });
      await Wallet.create({ customerId: proTestCustomer.id, balance: 50.0 });
    });

    test('should initiate a ₹499 Razorpay order for Eminence Pro subscription', async () => {
      const req = {
        user: { id: proTestCustomer.id }
      };
      const res = mockResponse();

      await createProOrder(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.order).toBeDefined();
      expect(res.data.order.amount).toBe(49900); // 499 * 100 paise
    });

    test('should verify payment and activate Eminence Pro subscription', async () => {
      const orderId = 'order_mock_pro_123';
      const paymentId = 'pay_mock_pro_456';
      const secret = process.env.RAZORPAY_KEY_SECRET || 'mock_secret';
      const signature = crypto
        .createHmac('sha256', secret)
        .update(orderId + '|' + paymentId)
        .digest('hex');

      const req = {
        user: { id: proTestCustomer.id },
        body: {
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature
        }
      };
      const res = mockResponse();

      await verifyProSubscription(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.isPro).toBe(true);

      const refreshed = await Customer.findByPk(proTestCustomer.id);
      expect(refreshed.isPro).toBe(true);
    });

    test('should return Pro status and active perks', async () => {
      const req = {
        user: { id: proTestCustomer.id }
      };
      const res = mockResponse();

      await getProStatus(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.isPro).toBe(true);
      expect(res.data.perks.discountPercent).toBe(5);
      expect(res.data.perks.zeroCancellationFee).toBe(true);
    });

    test('should prevent re-initiating Pro order if already Pro', async () => {
      const req = {
        user: { id: proTestCustomer.id }
      };
      const res = mockResponse();

      await createProOrder(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.data.success).toBe(false);
      expect(res.data.message).toMatch(/already have an active Eminence Pro/i);
    });
  });

  describe('3. Admin Bulk / Mass Deletion', () => {
    let dummyCustomers = [];
    let dummyDrivers = [];
    let testAdminA, testAdminB, testAdminC;

    beforeAll(async () => {
      // Create 2 test customers
      for (let i = 0; i < 2; i++) {
        const c = await Customer.create({
          name: `Bulk Cust ${i}`,
          email: `bulkcust_${i}_${Date.now()}@test.com`,
          phone: `93${Math.floor(10000000 + Math.random() * 90000000)}`
        });
        await Wallet.create({ customerId: c.id, balance: 10.0 });
        dummyCustomers.push(c);
      }

      // Create 2 test drivers
      for (let i = 0; i < 2; i++) {
        const d = await Driver.create({
          name: `Bulk Driver ${i}`,
          phone: `92${Math.floor(10000000 + Math.random() * 90000000)}`,
          licenseNumber: `DL-BULK-${Date.now()}-${i}`
        });
        dummyDrivers.push(d);
      }

      // Ensure 3 test admins
      testAdminA = await Admin.create({
        name: 'Admin Self',
        email: `adminself_${Date.now()}@test.com`,
        password: 'Password123!',
        role: 'Superadmin'
      });
      testAdminB = await Admin.create({
        name: 'Admin Target B',
        email: `admintargetb_${Date.now()}@test.com`,
        password: 'Password123!',
        role: 'Superadmin'
      });
      testAdminC = await Admin.create({
        name: 'Admin Target C',
        email: `admintargetc_${Date.now()}@test.com`,
        password: 'Password123!',
        role: 'Superadmin'
      });
    });

    test('bulkDeleteCustomers should delete all specified customer IDs', async () => {
      const req = {
        body: {
          ids: dummyCustomers.map(c => c.id)
        }
      };
      const res = mockResponse();

      await bulkDeleteCustomers(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.count).toBe(2);

      const remaining = await Customer.findAll({
        where: { id: dummyCustomers.map(c => c.id) }
      });
      expect(remaining.length).toBe(0);
    });

    test('bulkDeleteDrivers should delete all specified driver IDs', async () => {
      const req = {
        body: {
          ids: dummyDrivers.map(d => d.id)
        }
      };
      const res = mockResponse();

      await bulkDeleteDrivers(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.count).toBe(2);

      const remaining = await Driver.findAll({
        where: { id: dummyDrivers.map(d => d.id) }
      });
      expect(remaining.length).toBe(0);
    });

    test('bulkDeleteAdmins should prevent deleting own active admin account', async () => {
      const req = {
        user: { id: testAdminA.id },
        body: {
          ids: [testAdminA.id, testAdminB.id]
        }
      };
      const res = mockResponse();

      await bulkDeleteAdmins(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.data.success).toBe(false);
      expect(res.data.message).toMatch(/cannot delete your own active administrator/i);
    });

    test('bulkDeleteAdmins should delete other admins successfully when safety conditions are met', async () => {
      const req = {
        user: { id: testAdminA.id },
        body: {
          ids: [testAdminB.id]
        }
      };
      const res = mockResponse();

      await bulkDeleteAdmins(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.data.success).toBe(true);
      expect(res.data.count).toBe(1);

      const deletedB = await Admin.findByPk(testAdminB.id);
      expect(deletedB).toBeNull();
    });
  });
});
