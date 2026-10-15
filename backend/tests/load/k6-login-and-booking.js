import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// Custom metrics to track specific parts of the user journey
export const loginDuration = new Trend('login_duration', true);
export const bookingDuration = new Trend('booking_duration', true);
export const loginSuccessRate = new Rate('login_success_rate');
export const bookingSuccessRate = new Rate('booking_success_rate');
export const totalBookingsCreated = new Counter('total_bookings_created');

// Configurable via CLI environment variables:
// e.g. k6 run -e TARGET_VUS=100 -e DURATION=30s ...
const TARGET_VUS = parseInt(__ENV.TARGET_VUS || '100', 10);
const HOLD_DURATION = __ENV.HOLD_DURATION || '20s';
const RAMP_UP = __ENV.RAMP_UP || '10s';
const RAMP_DOWN = __ENV.RAMP_DOWN || '5s';

export const options = {
  stages: [
    { duration: RAMP_UP, target: TARGET_VUS },       // Ramp-up
    { duration: HOLD_DURATION, target: TARGET_VUS },  // Steady state load
    { duration: RAMP_DOWN, target: 0 },              // Ramp-down
  ],
  thresholds: {
    // 90% Accuracy Requirement (Success Rate >= 90%)
    login_success_rate: ['rate>=0.90'],
    booking_success_rate: ['rate>=0.90'],
    http_req_failed: ['rate<=0.10'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3000';

export default function () {
  const headers = { 'Content-Type': 'application/json' };

  // ==========================================
  // STEP 1: USER LOGIN
  // ==========================================
  const loginPayload = JSON.stringify({
    identifier: 'loadtest@eminence.com',
    password: 'LoadTest@12345',
    role: 'customer',
  });

  const loginStart = new Date();
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, loginPayload, {
    headers: headers,
    tags: { name: 'UserLogin' },
  });
  loginDuration.add(new Date() - loginStart);

  const loginOk = check(loginRes, {
    'login status is 200': (r) => r.status === 200,
    'token is present': (r) => {
      try {
        const body = JSON.parse(r.body);
        return !!body.token;
      } catch (e) {
        return false;
      }
    },
  });

  loginSuccessRate.add(loginOk);

  let token = null;
  if (loginOk) {
    try {
      const parsed = JSON.parse(loginRes.body);
      token = parsed.token;
    } catch (e) {
      token = null;
    }
  }

  // Small delay to simulate user navigating to booking screen
  sleep(0.3);

  // ==========================================
  // STEP 2: BOOK A TEMPO (AFTER LOGIN)
  // ==========================================
  if (token) {
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    // Semi-randomize payload slightly to avoid static cache shortcuts
    const weights = [150, 300, 500, 750, 1200];
    const tempos = ['small', 'medium', 'medium', 'large'];
    const selectedWeight = weights[Math.floor(Math.random() * weights.length)];
    const selectedTempo = selectedWeight > 750 ? 'large' : 'medium';
    const fare = (350 + Math.floor(Math.random() * 400)).toFixed(2);

    const bookingPayload = JSON.stringify({
      pickupAddress: 'Shivajinagar, Pune',
      dropAddress: 'Hinjewadi Phase 1, Pune',
      date: '2026-10-16',
      time: '14:30',
      goodsType: 'Automotive & Electronics',
      weight: selectedWeight,
      tempoType: selectedTempo,
      estimatedFare: parseFloat(fare),
      paymentMethod: 'cash',
      totalDistance: 19.5,
    });

    const bookingStart = new Date();
    const bookingRes = http.post(`${BASE_URL}/api/bookings`, bookingPayload, {
      headers: authHeaders,
      tags: { name: 'BookTempo' },
    });
    bookingDuration.add(new Date() - bookingStart);

    const bookingOk = check(bookingRes, {
      'booking status is 201': (r) => r.status === 201,
      'booking id returned': (r) => {
        try {
          const body = JSON.parse(r.body);
          return !!(body.booking && body.booking.id);
        } catch (e) {
          return false;
        }
      },
    });

    bookingSuccessRate.add(bookingOk);
    if (bookingOk) {
      totalBookingsCreated.add(1);
    }
  } else {
    // If login failed, record booking failure
    bookingSuccessRate.add(false);
  }

  // Pacing before next loop iteration
  sleep(0.5);
}
