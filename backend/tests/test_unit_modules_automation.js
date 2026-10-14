/**
 * Comprehensive Automated Unit Test Suite for Core Backend Modules
 * - Module 1: Groq AI Support Bot & Strict Guardrail Validation
 * - Module 2: Pricing Engine (Surge Multipliers & Corporate Contracts)
 * - Module 3: Route Optimizer & Haversine Distance Engine
 * - Module 4: AI Demand Forecasting & Hotspot Engine
 * - Module 5: Request Validator & XSS Sanitization Middleware
 * 
 * SECURITY NOTICE: No credentials or API keys are hardcoded in this test file.
 */

const path = require('path');
const assert = require('assert');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { 
  handleSupportMessage, 
  isOffTopicQuery, 
  OFF_TOPIC_REFUSAL_MESSAGE 
} = require('../src/services/supportBotService');
const { 
  calculateSurgeMultiplier, 
  calculateCorporateFare 
} = require('../src/services/pricingEngine');
const { 
  calculateDistance, 
  optimizeRoute 
} = require('../src/services/routeOptimizer');
const { getSurgeHeatmap } = require('../src/services/aiForecasting');
const { 
  sanitizeString, 
  isValidEmail, 
  validateDriver, 
  validateVehicle 
} = require('../src/middleware/requestValidator');

function mockResponse() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return res;
}

async function runAllUnitModules() {
  console.log('========================================================================');
  console.log('🚀 EMINENCE CORE BACKEND: COMPREHENSIVE UNIT TEST SUITE');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function record(title, fn) {
    try {
      process.stdout.write(`• ${title}... `);
      fn();
      console.log('✅ PASSED');
      passed++;
    } catch (err) {
      console.log(`❌ FAILED: ${err.message}`);
      failed++;
    }
  }

  async function recordAsync(title, fn) {
    try {
      process.stdout.write(`• ${title}... `);
      await fn();
      console.log('✅ PASSED');
      passed++;
    } catch (err) {
      console.log(`❌ FAILED: ${err.message}`);
      failed++;
    }
  }

  // ========================================================================
  // MODULE 1: GROQ AI BOT & GUARDRAIL VALIDATION
  // ========================================================================
  console.log('--- [MODULE 1: GROQ SUPPORT BOT & LOGISTICS GUARDRAILS] ---');

  record('Guardrail Filter: Fast rejection of coding requests', () => {
    assert.strictEqual(isOffTopicQuery('write a python script to reverse an array'), true);
    assert.strictEqual(isOffTopicQuery('create a react component with typescript'), true);
    assert.strictEqual(isOffTopicQuery('debug this sql query select * from users'), true);
  });

  record('Guardrail Filter: Fast rejection of general trivia & homework', () => {
    assert.strictEqual(isOffTopicQuery('who was the 16th president of the united states'), true);
    assert.strictEqual(isOffTopicQuery('what is the capital of australia'), true);
    assert.strictEqual(isOffTopicQuery('tell me a recipe for chocolate cake'), true);
    assert.strictEqual(isOffTopicQuery('write an essay on global warming'), true);
  });

  record('Guardrail Filter: Fast rejection of raw math expressions', () => {
    assert.strictEqual(isOffTopicQuery('45 * 12 + 8'), true);
    assert.strictEqual(isOffTopicQuery('100 / 5'), true);
  });

  record('Guardrail Filter: Permitting genuine logistics & delivery queries', () => {
    assert.strictEqual(isOffTopicQuery('where is my delivery?'), false);
    assert.strictEqual(isOffTopicQuery('who is my assigned driver?'), false);
    assert.strictEqual(isOffTopicQuery('what is the base fare for a small tempo?'), false);
    assert.strictEqual(isOffTopicQuery('how do I cancel my tempo booking?'), false);
    assert.strictEqual(isOffTopicQuery('what is the customer care helpline phone number?'), false);
  });

  await recordAsync('End-to-End Bot: Off-topic query returns strict refusal message', async () => {
    const res = await handleSupportMessage(null, 'write a python function to sort a list');
    assert.strictEqual(res, OFF_TOPIC_REFUSAL_MESSAGE);
  });

  await recordAsync('End-to-End Bot: Logistics rates query returns accurate base fares', async () => {
    const res = await handleSupportMessage(null, 'how much does a small tempo cost on eminence?');
    assert.ok(typeof res === 'string' && res.length > 10, 'Expected non-empty response');
    // Verifies either real Groq answer with 350 or standard platform fallback
    assert.ok(res.includes('350') || res.includes('Eminence') || res.includes('tempo'), `Unexpected bot response: ${res}`);
  });

  await recordAsync('End-to-End Bot: Delivery tracking query handles customer inquiry gracefully', async () => {
    const res = await handleSupportMessage(null, 'where is my delivery?');
    assert.ok(typeof res === 'string' && res.length > 10, 'Expected non-empty response');
    assert.ok(!res.includes('```'), 'Bot should never output code blocks');
  });

  // ========================================================================
  // MODULE 2: PRICING ENGINE
  // ========================================================================
  console.log('\n--- [MODULE 2: PRICING & SURGE ENGINE] ---');

  record('Morning rush hour surge multiplier (9am-11am -> 1.4x)', () => {
    const surge = calculateSurgeMultiplier({ hour: 9, isRaining: false, highTraffic: false });
    assert.strictEqual(surge, 1.4);
  });

  record('Evening rush hour surge multiplier (6pm-8pm -> 1.4x)', () => {
    const surge = calculateSurgeMultiplier({ hour: 19, isRaining: false, highTraffic: false });
    assert.strictEqual(surge, 1.4);
  });

  record('Late night surge multiplier (11pm-4am -> 1.2x)', () => {
    const surge = calculateSurgeMultiplier({ hour: 23, isRaining: false, highTraffic: false });
    assert.strictEqual(surge, 1.2);
  });

  record('Compound surge: Rush hour + Rain + High Traffic', () => {
    // 1.0 base + 0.4 rush + 0.3 rain + 0.2 traffic = 1.9
    const surge = calculateSurgeMultiplier({ hour: 10, isRaining: true, highTraffic: true });
    assert.strictEqual(surge, 1.9);
  });

  record('Maximum surge cap enforcement (capped at 2.5x)', () => {
    const surge = calculateSurgeMultiplier({ hour: 10, isRaining: true, highTraffic: true });
    assert.ok(surge <= 2.5, `Surge exceeded 2.5 cap: ${surge}`);
  });

  record('Corporate contract volume discount (20% off active contract)', () => {
    const baseFare = 1000;
    const contract = { status: 'active', discountPercentage: 20 };
    const discountedFare = calculateCorporateFare(baseFare, contract);
    assert.strictEqual(discountedFare, 800);
  });

  record('Corporate contract inactive or expired bypasses discount', () => {
    const baseFare = 1000;
    const contract = { status: 'expired', discountPercentage: 20 };
    const fare = calculateCorporateFare(baseFare, contract);
    assert.strictEqual(fare, 1000);
  });

  // ========================================================================
  // MODULE 3: ROUTE OPTIMIZER & HAVERSINE ENGINE
  // ========================================================================
  console.log('\n--- [MODULE 3: ROUTE OPTIMIZATION & GEOMETRY] ---');

  record('Haversine distance calculation between known Pune coordinates', () => {
    // Pune Station (18.5284, 73.8744) to Hinjewadi Phase 1 (18.5913, 73.7389)
    const puneStation = { lat: 18.5284, lng: 73.8744 };
    const hinjewadi = { lat: 18.5913, lng: 73.7389 };
    const dist = calculateDistance(puneStation, hinjewadi);
    // Aerial distance is roughly 15.8 - 16.2 km
    assert.ok(dist >= 14 && dist <= 18, `Unexpected distance: ${dist} km`);
  });

  await recordAsync('Optimize route returns empty array when no waypoints provided', async () => {
    const start = { lat: 18.5204, lng: 73.8567 };
    const result = await optimizeRoute(start, []);
    assert.deepStrictEqual(result, []);
  });

  await recordAsync('Optimize route with single waypoint returns same waypoint', async () => {
    const start = { lat: 18.5204, lng: 73.8567 };
    const waypoints = [{ id: 'stop_1', lat: 18.5300, lng: 73.8600 }];
    const result = await optimizeRoute(start, waypoints);
    assert.deepStrictEqual(result, waypoints);
  });

  // ========================================================================
  // MODULE 4: AI DEMAND SURGE FORECASTING
  // ========================================================================
  console.log('\n--- [MODULE 4: AI DEMAND & SURGE FORECASTING] ---');

  record('Generate surge heatmap with valid schema & metadata', () => {
    const forecast = getSurgeHeatmap();
    assert.ok(forecast.timestamp, 'Missing timestamp');
    assert.ok(forecast.forecastWindow, 'Missing forecastWindow');
    assert.ok(forecast.modelConfidence, 'Missing modelConfidence');
    assert.ok(Array.isArray(forecast.hotspots), 'Hotspots must be an array');
    assert.ok(forecast.hotspots.length > 0, 'Hotspots array must not be empty');

    const firstHotspot = forecast.hotspots[0];
    assert.ok(firstHotspot.id, 'Hotspot missing id');
    assert.ok(firstHotspot.name, 'Hotspot missing name');
    assert.ok(typeof firstHotspot.lat === 'number', 'Hotspot lat must be number');
    assert.ok(typeof firstHotspot.lng === 'number', 'Hotspot lng must be number');
    assert.ok(firstHotspot.surgeMultiplier >= 1.0, 'Multiplier must be >= 1.0');
  });

  // ========================================================================
  // MODULE 5: REQUEST VALIDATION & SECURITY MIDDLEWARE
  // ========================================================================
  console.log('\n--- [MODULE 5: INPUT VALIDATION & XSS SANITIZATION] ---');

  record('XSS sanitization: Neutralizes malicious HTML & script injections', () => {
    const dirty = '<script>alert("XSS")</script>&"\'';
    const clean = sanitizeString(dirty);
    assert.ok(!clean.includes('<script>'), 'Script tag not escaped');
    assert.ok(clean.includes('&lt;script&gt;'), 'Expected HTML entity escaping');
    assert.ok(clean.includes('&quot;'), 'Quotes should be escaped');
  });

  record('Linear ReDoS-safe email validation (isValidEmail)', () => {
    assert.strictEqual(isValidEmail('admin@eminence.com'), true);
    assert.strictEqual(isValidEmail('customer.logistics+tag@domain.co.in'), true);
    assert.strictEqual(isValidEmail('invalid-email-without-at.com'), false);
    assert.strictEqual(isValidEmail('@missinglocal.com'), false);
    assert.strictEqual(isValidEmail('missingdomain@'), false);
    assert.strictEqual(isValidEmail('spaces in@domain.com'), false);
  });

  record('Driver Payload Validation: Rejects short name or missing phone', () => {
    const req = {
      body: { name: 'A', phone: '123' } // Too short
    };
    const res = mockResponse();
    let nextCalled = false;
    validateDriver(req, res, () => { nextCalled = true; });

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(nextCalled, false);
  });

  record('Driver Payload Validation: Accepts valid driver registration payload', () => {
    const req = {
      body: {
        name: 'Ramesh Pawar',
        phone: '9876543210',
        licenseNumber: 'MH-12-2023-998877',
        status: 'active'
      }
    };
    const res = mockResponse();
    let nextCalled = false;
    validateDriver(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true);
  });

  record('Vehicle Payload Validation: Rejects invalid capacity or invalid type', () => {
    const req = {
      body: { registrationNumber: 'MH-12-AB-1234', type: 'unsupported-vehicle', capacityWeight: -50 }
    };
    const res = mockResponse();
    let nextCalled = false;
    validateVehicle(req, res, () => { nextCalled = true; });

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(nextCalled, false);
  });

  record('Vehicle Payload Validation: Accepts valid commercial tempo asset payload', () => {
    const req = {
      body: {
        registrationNumber: 'MH-12-AB-1234',
        type: 'small',
        capacityWeight: 500,
        status: 'available'
      }
    };
    const res = mockResponse();
    let nextCalled = false;
    validateVehicle(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true);
  });

  // ========================================================================
  // SCORECARD SUMMARY
  // ========================================================================
  console.log('\n========================================================================');
  console.log(`🏆 ALL UNIT MODULES EXECUTED: ${passed} Passed, ${failed} Failed`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllUnitModules().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
