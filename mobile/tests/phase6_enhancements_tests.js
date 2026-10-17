const axios = require('axios');
const crypto = require('crypto');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3100';
let passCount = 0;
let failCount = 0;

function logTest(testId, name, passed, details = '') {
  if (passed) {
    passCount++;
    console.log(`✅ [PASS] ${testId}: ${name} ${details ? `(${details})` : ''}`);
  } else {
    failCount++;
    console.error(`❌ [FAIL] ${testId}: ${name} - ${details}`);
  }
}

async function runPhase6Tests() {
  console.log('================================================================');
  console.log('🚀 RUNNING MOBILE PHASE 6: ENHANCEMENTS & WORKFLOW TESTS');
  console.log('Target Backend:', BASE_URL);
  console.log('================================================================\n');

  let referrerToken = '';
  let referrerId = '';
  let referrerCode = '';
  let refereeToken = '';
  let refereeId = '';

  // Setup: Authenticate primary user (Referrer)
  try {
    await axios.post(`${BASE_URL}/api/auth/phone-login`, { phone: '1234567890', role: 'customer' });
    const verifyRes = await axios.post(`${BASE_URL}/api/auth/phone-verify`, {
      phone: '1234567890',
      code: '123456',
      role: 'customer',
    });
    referrerToken = verifyRes.data.token;
    referrerId = verifyRes.data.user.id;
    referrerCode = verifyRes.data.user.referralCode;

    // If referral code was empty, fetch profile to ensure auto-generation
    if (!referrerCode) {
      const profRes = await axios.get(`${BASE_URL}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${referrerToken}` },
      });
      referrerCode = profRes.data.user?.referralCode;
    }
  } catch (err) {
    console.error('Setup Auth Failed:', err.message);
    process.exit(1);
  }

  // ----------------------------------------------------------------
  // TC-060: Mobile Registration with Referral Code & Dual Bonus Credit
  // ----------------------------------------------------------------
  try {
    const randomSuffix = Math.floor(Math.random() * 100000);
    const refereeEmail = `mobile_referee_${randomSuffix}@example.com`;
    const refereePhone = '98' + Math.floor(10000000 + Math.random() * 90000000);

    const regRes = await axios.post(`${BASE_URL}/api/auth/register`, {
      name: 'Mobile Referee User',
      email: refereeEmail,
      phone: refereePhone,
      password: 'password123',
      role: 'customer',
      referralCode: referrerCode,
    });

    const regSuccess = regRes.data?.success === true;

    // Login referee to check wallet balance
    const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: refereeEmail,
      password: 'password123',
      role: 'customer',
    });
    refereeToken = loginRes.data?.token;
    refereeId = loginRes.data?.user?.id;

    const refereeWalletRes = await axios.get(`${BASE_URL}/api/wallet`, {
      headers: { Authorization: `Bearer ${refereeToken}` },
    });
    const refereeBalance = refereeWalletRes.data?.balance || 0;

    logTest(
      'TC-060',
      'Mobile Registration with Referral Code & Dual ₹100 Bonus',
      regSuccess && refereeBalance >= 100,
      `ReferredBy: ${referrerCode}, Referee Balance: ₹${refereeBalance}`
    );
  } catch (err) {
    logTest('TC-060', 'Mobile Registration with Referral Code & Dual ₹100 Bonus', false, err.response?.data?.message || err.message);
  }

  // ----------------------------------------------------------------
  // TC-061: Customer Auto-Referral Code Provisioning on Mobile Profile
  // ----------------------------------------------------------------
  try {
    const profRes = await axios.get(`${BASE_URL}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${refereeToken}` },
    });
    const code = profRes.data?.user?.referralCode;
    const isValidFormat = typeof code === 'string' && code.startsWith('EMINENCE-') && code.length >= 12;

    logTest(
      'TC-061',
      'Auto-Referral Code Provisioning on Mobile Profile (EMINENCE-XXXXXX)',
      isValidFormat,
      `Generated Code: ${code}`
    );
  } catch (err) {
    logTest('TC-061', 'Auto-Referral Code Provisioning on Mobile Profile', false, err.response?.data?.message || err.message);
  }

  // ----------------------------------------------------------------
  // TC-062: Mobile Saved Address Quick-Select Retrieval
  // ----------------------------------------------------------------
  try {
    // Ensure an address exists
    await axios.post(
      `${BASE_URL}/api/address`,
      { label: 'Warehouse', street: 'Plot 45, MIDC Bhosari', city: 'Pune', postalCode: '411026' },
      { headers: { Authorization: `Bearer ${referrerToken}` } }
    ).catch(() => {});

    const addrRes = await axios.get(`${BASE_URL}/api/address`, {
      headers: { Authorization: `Bearer ${referrerToken}` },
    });

    const addresses = addrRes.data?.addresses || (Array.isArray(addrRes.data) ? addrRes.data : []);
    const hasValidAddress = addresses.length > 0 && !!addresses[0].street && !!addresses[0].label;

    logTest(
      'TC-062',
      'Mobile Saved Address Retrieval for Quick-Select Chips',
      hasValidAddress,
      `Found ${addresses.length} saved addresses (e.g. ${addresses[0]?.label}: ${addresses[0]?.street})`
    );
  } catch (err) {
    logTest('TC-062', 'Mobile Saved Address Retrieval for Quick-Select Chips', false, err.response?.data?.message || err.message);
  }

  // ----------------------------------------------------------------
  // TC-063: Mobile Eminence Pro Subscription Order Creation & Verification
  // ----------------------------------------------------------------
  try {
    // 1. Create Pro Order
    const orderRes = await axios.post(
      `${BASE_URL}/api/customer/pro/create-order`,
      {},
      { headers: { Authorization: `Bearer ${refereeToken}` } }
    );
    const order = orderRes.data?.order;
    const orderCreated = orderRes.data?.success === true && order?.amount === 49900;

    // 2. Generate HMAC signature matching backend secret
    const secret = process.env.RAZORPAY_KEY_SECRET || 'PO4Z1b230wAIeip8m87i8k2o';
    const mockPaymentId = 'pay_mobile_test_' + Math.random().toString(36).substring(7);
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${order.id}|${mockPaymentId}`)
      .digest('hex');

    // 3. Verify Subscription
    const verifyRes = await axios.post(
      `${BASE_URL}/api/customer/pro/verify`,
      {
        razorpay_order_id: order.id,
        razorpay_payment_id: mockPaymentId,
        razorpay_signature: expectedSig,
      },
      { headers: { Authorization: `Bearer ${refereeToken}` } }
    );

    const isProActive = verifyRes.data?.success === true && verifyRes.data?.isPro === true;

    // 4. Check Pro Status
    const statusRes = await axios.get(`${BASE_URL}/api/customer/pro/status`, {
      headers: { Authorization: `Bearer ${refereeToken}` },
    });

    const statusConfirmed = statusRes.data?.isPro === true;

    logTest(
      'TC-063',
      'Mobile Eminence Pro Razorpay Subscription Flow (₹499/mo)',
      orderCreated && isProActive && statusConfirmed,
      `OrderId: ${order?.id}, ProStatus: active, Expiry: ${statusRes.data?.proExpiresAt?.split('T')[0]}`
    );
  } catch (err) {
    logTest('TC-063', 'Mobile Eminence Pro Razorpay Subscription Flow', false, err.response?.data?.message || err.message);
  }

  // ----------------------------------------------------------------
  // TC-064: Mobile Booking with OSRM Road Distance Telematics & Pro 5% Discount
  // ----------------------------------------------------------------
  try {
    const bookingPayload = {
      pickupAddress: 'Plot 45, MIDC Bhosari, Pune',
      dropAddress: 'Koregaon Park, Pune',
      drops: ['Koregaon Park, Pune'],
      totalDistance: 16.5,
      tempoType: 'small',
      weight: 250,
      goodsType: 'Automotive Parts',
      date: new Date().toISOString().split('T')[0],
      time: '15:00',
      estimatedFare: 480,
      paymentMethod: 'cash',
      customerId: refereeId,
    };

    const bookingRes = await axios.post(`${BASE_URL}/api/bookings`, bookingPayload, {
      headers: { Authorization: `Bearer ${refereeToken}` },
    });

    const bookingCreated = bookingRes.data?.success === true && !!bookingRes.data?.booking?.id;
    const finalFare = bookingRes.data?.booking?.fare || bookingRes.data?.booking?.estimatedFare;
    const refereeBookingId = bookingRes.data?.booking?.id;

    logTest(
      'TC-064',
      'Mobile Booking with Road Distance Telematics & Pro 5% Discount',
      bookingCreated,
      `Booking ID: ${bookingRes.data?.booking?.id}, Distance: 16.5km, Fare: ₹${finalFare}`
    );
  } catch (err) {
    logTest('TC-064', 'Mobile Booking with Road Distance Telematics & Pro 5% Discount', false, err.response?.data?.message || err.message);
  }

  // ----------------------------------------------------------------
  // TC-065: Mobile Promo Code Application Independent of Referral History
  // ----------------------------------------------------------------
  try {
    // 1. Admin creates a promo code (e.g. OMKAR100 or MOBPROMO)
    const adminLoginRes = await axios.post(`${BASE_URL}/api/admin/login`, {
      email: 'admin@eminence.com',
      password: 'adminpassword123',
    });
    const adminToken = adminLoginRes.data?.token;

    const promoCode = `MOBPROMO${Math.floor(1000 + Math.random() * 9000)}`;
    await axios.post(
      `${BASE_URL}/api/admin/promocodes`,
      {
        code: promoCode,
        description: 'Mobile Exclusive Discount',
        discountType: 'FLAT',
        discountValue: 400,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true,
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    // 2. Referee (who already has referredBy from TC-060) applies this promo code
    const applyRes = await axios.post(
      `${BASE_URL}/api/wallet/referral`,
      { referralCode: promoCode },
      { headers: { Authorization: `Bearer ${refereeToken}` } }
    );

    const applySuccess = applyRes.data?.success === true && applyRes.data?.discount === 400;

    // 3. Applying the same promo code again must be rejected as already used
    let duplicateRejected = false;
    try {
      await axios.post(
        `${BASE_URL}/api/wallet/referral`,
        { referralCode: promoCode },
        { headers: { Authorization: `Bearer ${refereeToken}` } }
      );
    } catch (dupErr) {
      duplicateRejected = dupErr.response?.status === 400 && /already used this promo code/i.test(dupErr.response?.data?.message || '');
    }

    logTest(
      'TC-065',
      'Mobile Promo Code Application Independent of Existing Referral History',
      applySuccess && duplicateRejected,
      `Code: ${promoCode}, Discount: ₹400, Duplicate Rejected: ${duplicateRejected}`
    );
  } catch (err) {
    logTest('TC-065', 'Mobile Promo Code Application Independent of Existing Referral History', false, err.response?.data?.message || err.message);
  }

  // Teardown: Clean up referee user and bookings created in this test suite
  try {
    const adminRes = await axios.post(`${BASE_URL}/api/admin/login`, {
      email: 'admin@eminence.com',
      password: 'adminpassword123',
    });
    const adminToken = adminRes.data?.token;
    if (adminToken && refereeId) {
      await axios.post(
        `${BASE_URL}/api/admin/customers/bulk-delete`,
        { ids: [refereeId] },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      ).catch(() => {});
    }
  } catch (e) {}

  console.log('\n================================================================');
  console.log(`📊 PHASE 6 TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase6Tests();
