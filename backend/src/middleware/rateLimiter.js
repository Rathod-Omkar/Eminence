const rateLimit = require('express-rate-limit');

const isLoadTest = process.env.SKIP_RATE_LIMIT === 'true' || process.env.LOAD_TEST === 'true';

/**
 * Robust Client Key Generator:
 * Identifies authenticated users by their verified server-side identity (req.user.id),
 * and falls back to the client IP address for unauthenticated requests.
 * 
 * CRITICAL SECURITY RULE:
 * Never trust client-supplied headers (e.g. X-User-Id) or request body properties!
 * Only trust req.user.id when populated by verified authMiddleware/protect.
 */
const getClientKey = (req) => {
  if (req.user && req.user.id) {
    return `usr_${req.user.id}`;
  }
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
};

/**
 * Standard rate limit handler:
 * Sets the Retry-After header and returns a consistent, non-sensitive JSON payload.
 */
const createRateLimitHandler = (defaultMessage) => (req, res, _next, options) => {
  const windowSeconds = Math.ceil((options.windowMs || 15 * 60 * 1000) / 1000);
  res.setHeader('Retry-After', String(windowSeconds));
  return res.status(429).json({
    success: false,
    message: defaultMessage || 'Too many requests, please try again later.',
    retryAfter: windowSeconds
  });
};

/**
 * Helper to create standard rate limiters with unified headers, validation, and key generation.
 */
const createRateLimiter = (options = {}) => {
  const windowMs = options.windowMs || 15 * 60 * 1000;
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getClientKey,
    validate: { keyGeneratorIpFallback: false, xForwardedForHeader: false },
    handler: createRateLimitHandler(options.message),
    ...options,
    windowMs
  });
};

// General API rate limiter (100 req / 15 min)
const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: isLoadTest ? 100000 : (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development' ? 2000 : 100),
  message: 'Too many requests, please try again after 15 minutes'
});

// Stricter limiter for auth / sensitive credential routes (30 req / 15 min)
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: isLoadTest ? 100000 : (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development' ? 2000 : 30),
  message: 'Too many authentication attempts, please try again after 15 minutes'
});

// High-security OTP dispatch limiter to prevent SMS credit exhaustion (5 req / 15 min)
const otpLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: isLoadTest ? 10000 : (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development' ? 200 : 5),
  message: 'Too many OTP requests, please try again after 15 minutes'
});

// Booking mutations and status transitions (100 req / 15 min)
const bookingsLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: isLoadTest ? 100000 : (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development' ? 2000 : 100),
  message: 'Too many booking requests, please try again after 15 minutes'
});

// AI Voice & Assisted Booking endpoint (10 req / 15 min)
const aiBookingLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: isLoadTest ? 10000 : (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development' ? 200 : 10),
  message: 'Too many AI booking requests, please try again after 15 minutes'
});

// Saved address operations (50 req / 15 min)
const addressRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: isLoadTest ? 10000 : (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development' ? 1000 : 50),
  message: 'Too many address requests, please try again after 15 minutes'
});

// Public contact form messages (5 req / 15 min)
const contactLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: isLoadTest ? 10000 : (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development' ? 200 : 5),
  message: 'Too many contact messages sent from this IP, please try again after 15 minutes'
});

// High-frequency Driver Location Tracking Limiter:
// Allows legitimate 5-10s mobile GPS updates (~40/min) without breaking active navigation,
// while preventing malicious DoS flooding of location updates (600 req / 15 min).
const locationTrackingLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: isLoadTest ? 200000 : (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development' ? 20000 : 600),
  message: 'Too many GPS location updates from this driver, please check client update frequency'
});

// Data-heavy Admin Reports, Analytics & CSV Export limiter (60 req / 15 min)
const adminReportsLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: isLoadTest ? 100000 : (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development' ? 1000 : 60),
  message: 'Too many report/analytics requests, please try again after 15 minutes'
});

// Voice & Microphone Query Limiter (30 req / 15 min)
const voiceQueryLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: isLoadTest ? 10000 : (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development' ? 500 : 30),
  message: 'Too many voice query requests, please try again after 15 minutes'
});

module.exports = {
  getClientKey,
  createRateLimiter,
  apiLimiter,
  authLimiter,
  otpLimiter,
  bookingsLimiter,
  aiBookingLimiter,
  addressRateLimiter,
  contactLimiter,
  locationTrackingLimiter,
  adminReportsLimiter,
  voiceQueryLimiter
};
