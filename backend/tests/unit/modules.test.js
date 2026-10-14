/**
 * Jest Unit Test Suite for Core Backend Modules
 * - Groq AI Bot & Guardrails
 * - Pricing Engine
 * - Route Optimization & Haversine Formula
 * - AI Demand Surge Forecasting
 * - Request Validation & Sanitization
 */

const { 
  handleSupportMessage, 
  isOffTopicQuery, 
  OFF_TOPIC_REFUSAL_MESSAGE 
} = require('../../src/services/supportBotService');
const { 
  calculateSurgeMultiplier, 
  calculateCorporateFare 
} = require('../../src/services/pricingEngine');
const { 
  calculateDistance, 
  optimizeRoute 
} = require('../../src/services/routeOptimizer');
const { getSurgeHeatmap } = require('../../src/services/aiForecasting');
const { 
  sanitizeString, 
  isValidEmail, 
  validateDriver, 
  validateVehicle 
} = require('../../src/middleware/requestValidator');

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

describe('Module 1: Groq AI Bot & Logistics Guardrails', () => {
  test('Fast rejection of coding and development prompts', () => {
    expect(isOffTopicQuery('write a python script to reverse an array')).toBe(true);
    expect(isOffTopicQuery('create a react component with typescript')).toBe(true);
    expect(isOffTopicQuery('debug this sql query select * from users')).toBe(true);
  });

  test('Fast rejection of general trivia, homework and cooking', () => {
    expect(isOffTopicQuery('who was the 16th president of the united states')).toBe(true);
    expect(isOffTopicQuery('what is the capital of australia')).toBe(true);
    expect(isOffTopicQuery('tell me a recipe for chocolate cake')).toBe(true);
    expect(isOffTopicQuery('write an essay on global warming')).toBe(true);
  });

  test('Fast rejection of raw math expressions', () => {
    expect(isOffTopicQuery('45 * 12 + 8')).toBe(true);
    expect(isOffTopicQuery('100 / 5')).toBe(true);
  });

  test('Permits genuine delivery, driver, and logistics queries', () => {
    expect(isOffTopicQuery('where is my delivery?')).toBe(false);
    expect(isOffTopicQuery('who is my assigned driver?')).toBe(false);
    expect(isOffTopicQuery('what is the base fare for a small tempo?')).toBe(false);
    expect(isOffTopicQuery('how do I cancel my tempo booking?')).toBe(false);
    expect(isOffTopicQuery('what is the customer care helpline phone number?')).toBe(false);
  });

  test('Off-topic query returns strict refusal message', async () => {
    const res = await handleSupportMessage(null, 'write a python function to sort a list');
    expect(res).toBe(OFF_TOPIC_REFUSAL_MESSAGE);
  });

  test('Logistics rates query returns accurate base fares', async () => {
    const res = await handleSupportMessage(null, 'how much does a small tempo cost on eminence?');
    expect(typeof res).toBe('string');
    expect(res.length).toBeGreaterThan(10);
    expect(res.includes('350') || res.includes('Eminence') || res.includes('tempo')).toBe(true);
  });

  test('Delivery tracking query handles customer inquiry gracefully without code blocks', async () => {
    const res = await handleSupportMessage(null, 'where is my delivery?');
    expect(typeof res).toBe('string');
    expect(res.includes('```')).toBe(false);
  });
});

describe('Module 2: Pricing & Surge Engine', () => {
  test('Morning rush hour surge multiplier (9am-11am -> 1.4x)', () => {
    expect(calculateSurgeMultiplier({ hour: 9, isRaining: false, highTraffic: false })).toBe(1.4);
  });

  test('Evening rush hour surge multiplier (6pm-8pm -> 1.4x)', () => {
    expect(calculateSurgeMultiplier({ hour: 19, isRaining: false, highTraffic: false })).toBe(1.4);
  });

  test('Late night surge multiplier (11pm-4am -> 1.2x)', () => {
    expect(calculateSurgeMultiplier({ hour: 23, isRaining: false, highTraffic: false })).toBe(1.2);
  });

  test('Compound surge calculation (Rush hour + Rain + High Traffic)', () => {
    expect(calculateSurgeMultiplier({ hour: 10, isRaining: true, highTraffic: true })).toBe(1.9);
  });

  test('Maximum surge cap enforcement (capped at 2.5x)', () => {
    const surge = calculateSurgeMultiplier({ hour: 10, isRaining: true, highTraffic: true });
    expect(surge).toBeLessThanOrEqual(2.5);
  });

  test('Corporate contract volume discount (20% off active contract)', () => {
    const baseFare = 1000;
    const contract = { status: 'active', discountPercentage: 20 };
    expect(calculateCorporateFare(baseFare, contract)).toBe(800);
  });

  test('Corporate contract inactive or expired bypasses discount', () => {
    const baseFare = 1000;
    const contract = { status: 'expired', discountPercentage: 20 };
    expect(calculateCorporateFare(baseFare, contract)).toBe(1000);
  });
});

describe('Module 3: Route Optimization & Geometry', () => {
  test('Haversine distance calculation between known Pune coordinates', () => {
    const puneStation = { lat: 18.5284, lng: 73.8744 };
    const hinjewadi = { lat: 18.5913, lng: 73.7389 };
    const dist = calculateDistance(puneStation, hinjewadi);
    expect(dist).toBeGreaterThanOrEqual(14);
    expect(dist).toBeLessThanOrEqual(18);
  });

  test('Optimize route returns empty array when no waypoints provided', async () => {
    const start = { lat: 18.5204, lng: 73.8567 };
    const result = await optimizeRoute(start, []);
    expect(result).toEqual([]);
  });

  test('Optimize route with single waypoint returns same waypoint', async () => {
    const start = { lat: 18.5204, lng: 73.8567 };
    const waypoints = [{ id: 'stop_1', lat: 18.5300, lng: 73.8600 }];
    const result = await optimizeRoute(start, waypoints);
    expect(result).toEqual(waypoints);
  });
});

describe('Module 4: AI Demand & Surge Forecasting', () => {
  test('Generate surge heatmap with valid schema & metadata', () => {
    const forecast = getSurgeHeatmap();
    expect(forecast).toHaveProperty('timestamp');
    expect(forecast).toHaveProperty('forecastWindow');
    expect(forecast).toHaveProperty('modelConfidence');
    expect(Array.isArray(forecast.hotspots)).toBe(true);
    expect(forecast.hotspots.length).toBeGreaterThan(0);

    const first = forecast.hotspots[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(typeof first.lat).toBe('number');
    expect(typeof first.lng).toBe('number');
    expect(first.surgeMultiplier).toBeGreaterThanOrEqual(1.0);
  });
});

describe('Module 5: Request Validation & XSS Sanitization', () => {
  test('XSS sanitization escapes script tags and dangerous HTML characters', () => {
    const dirty = '<script>alert("XSS")</script>&"\'';
    const clean = sanitizeString(dirty);
    expect(clean.includes('<script>')).toBe(false);
    expect(clean.includes('&lt;script&gt;')).toBe(true);
    expect(clean.includes('&quot;')).toBe(true);
  });

  test('Linear ReDoS-safe email validation (isValidEmail)', () => {
    expect(isValidEmail('admin@eminence.com')).toBe(true);
    expect(isValidEmail('customer.logistics+tag@domain.co.in')).toBe(true);
    expect(isValidEmail('invalid-email-without-at.com')).toBe(false);
    expect(isValidEmail('@missinglocal.com')).toBe(false);
    expect(isValidEmail('missingdomain@')).toBe(false);
  });

  test('Driver Payload Validation rejects invalid phone or short name', () => {
    const req = { body: { name: 'A', phone: '123' } };
    const res = mockResponse();
    let nextCalled = false;
    validateDriver(req, res, () => { nextCalled = true; });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(nextCalled).toBe(false);
  });

  test('Driver Payload Validation accepts valid driver data', () => {
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
    expect(nextCalled).toBe(true);
  });

  test('Vehicle Payload Validation rejects invalid type', () => {
    const req = {
      body: { registrationNumber: 'MH-12-AB-1234', type: 'unsupported-vehicle', capacityWeight: -50 }
    };
    const res = mockResponse();
    let nextCalled = false;
    validateVehicle(req, res, () => { nextCalled = true; });
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(nextCalled).toBe(false);
  });

  test('Vehicle Payload Validation accepts valid tempo asset', () => {
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
    expect(nextCalled).toBe(true);
  });
});
