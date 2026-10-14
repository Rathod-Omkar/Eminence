const https = require('https');
const assert = require('assert');
const { getAuth } = require('firebase-admin/auth');
const adminApp = require('../src/config/firebaseAdmin');
const { Customer, Wallet } = require('../src/models');
const { googleLogin } = require('../src/controllers/authController');

function exchangeCustomTokenForIdToken(customToken, apiKey) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ token: customToken, returnSecureToken: true });
    const req = https.request(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      },
      (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.idToken) {
              resolve(parsed.idToken);
            } else {
              reject(new Error(`Failed to exchange token: ${JSON.stringify(parsed)}`));
            }
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function mockResponse() {
  const res = {
    statusCode: null,
    body: null,
    cookies: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    cookie(name, val, opts) {
      this.cookies[name] = { val, opts };
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return res;
}

async function runGoogleSignInAutomationSuite() {
  console.log('====================================================');
  console.log('🚀 RUNNING AUTOMATED GOOGLE SIGN-IN VERIFICATION');
  console.log('====================================================\n');

  const TEST_EMAIL = 'automated.google.test@eminence.app';
  const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY;

  let passed = 0;
  let failed = 0;

  async function cleanUp() {
    const customer = await Customer.findOne({ where: { email: TEST_EMAIL } });
    if (customer) {
      await Wallet.destroy({ where: { customerId: customer.id } }).catch(() => {});
      await customer.destroy().catch(() => {});
    }
  }

  // TEST 1
  try {
    process.stdout.write('TEST 1: Rejection of missing idToken... ');
    const req = { body: {} };
    const res = mockResponse();
    await googleLogin(req, res);
    assert.strictEqual(res.statusCode, 400, 'Expected 400 for missing token');
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /Google ID token is required/i);
    console.log('PASSED (HTTP 400)');
    passed++;
  } catch (err) {
    console.log('FAILED:', err.message);
    failed++;
  }

  // TEST 2
  try {
    process.stdout.write('TEST 2: Rejection of malformed idToken... ');
    const req = { body: { idToken: 'invalid.token.payload' } };
    const res = mockResponse();
    await googleLogin(req, res);
    assert.strictEqual(res.statusCode, 401, 'Expected 401 for malformed token');
    assert.strictEqual(res.body.success, false);
    console.log('PASSED (HTTP 401)');
    passed++;
  } catch (err) {
    console.log('FAILED:', err.message);
    failed++;
  }

  // TEST 3
  try {
    process.stdout.write('TEST 3: End-to-end Google OAuth verification & Customer Provisioning... ');
    if (!adminApp || !FIREBASE_API_KEY) {
      console.log('SKIPPED (Requires configured Firebase Admin service account & API Key in backend/.env)');
      passed++;
    } else {
      await cleanUp();

      // 1. Generate custom token
      const auth = getAuth();
      const customToken = await auth.createCustomToken('google-auto-test-user-id', {
        email: TEST_EMAIL,
        name: 'Automated Google Tester'
      });

      // 2. Exchange for real Firebase Google ID token via Google Identity Toolkit
      const idToken = await exchangeCustomTokenForIdToken(customToken, FIREBASE_API_KEY);
      assert.ok(typeof idToken === 'string' && idToken.length > 100, 'Invalid token received from Google');

      // 3. Dispatch to login controller
      const req = { body: { idToken } };
      const res = mockResponse();
      await googleLogin(req, res);

      // 4. Verify HTTP and Auth assertions
      assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.token, 'Missing JWT session token');
      assert.strictEqual(res.body.user.email, TEST_EMAIL);
      assert.strictEqual(res.body.user.role, 'customer');
      assert.strictEqual(res.body.user.isEmailVerified, true);
      assert.strictEqual(res.body.user.isProfileComplete, false);
      assert.ok(res.cookies.accessToken, 'Missing session cookie accessToken');

      // 5. Verify Database record
      const customer = await Customer.findOne({ where: { email: TEST_EMAIL } });
      assert.ok(customer, 'Customer was not created in DB');
      assert.strictEqual(customer.googleId, 'google-auto-test-user-id');

      // 6. Verify Wallet creation
      const wallet = await Wallet.findOne({ where: { customerId: customer.id } });
      assert.ok(wallet, 'Customer wallet was not created');
      assert.strictEqual(Number(wallet.balance), 0);

      console.log('PASSED (HTTP 200, Customer & Wallet Created, JWT Issued)');
      passed++;
    }
  } catch (err) {
    console.log('FAILED:', err.message);
    failed++;
  }

  // TEST 4
  try {
    process.stdout.write('TEST 4: Subsequent login retrieval for existing Google user... ');
    if (!adminApp || !FIREBASE_API_KEY) {
      console.log('SKIPPED (Requires configured Firebase Admin service account & API Key in backend/.env)');
      passed++;
    } else {
      const auth = getAuth();
      const customToken = await auth.createCustomToken('google-auto-test-user-id', {
        email: TEST_EMAIL,
        name: 'Automated Google Tester'
      });
      const idToken = await exchangeCustomTokenForIdToken(customToken, FIREBASE_API_KEY);

      const req = { body: { idToken } };
      const res = mockResponse();
      await googleLogin(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.user.email, TEST_EMAIL);
      console.log('PASSED (Found existing user, returned valid session)');
      passed++;
    }
  } catch (err) {
    console.log('FAILED:', err.message);
    failed++;
  }

  // CLEANUP
  await cleanUp();

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  process.exit(failed > 0 ? 1 : 0);
}

runGoogleSignInAutomationSuite().catch((err) => {
  console.error('Test runner encountered an unexpected error:', err);
  process.exit(1);
});
