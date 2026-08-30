// Simple in-memory rate limiter, keyed by IP address.
//
// Good enough as a first line of defense against a single visitor (or bot)
// burning through your free-tier quota. It is NOT a perfect global limit:
// each serverless instance keeps its own counts in memory, and Vercel may
// run multiple instances or recycle one after inactivity, so a determined
// or high-traffic caller could exceed the stated limit somewhat. For a
// strict, shared-across-everything limit, swap this for a hosted store like
// Upstash Redis (a few lines of change, see README).

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_WINDOW = 20; // per IP, per window

// Map<ip, number[]> — timestamps of recent requests
const hits = new Map();

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : 'unknown';
}

// Returns { allowed: boolean, remaining: number, resetInSeconds: number }
function checkRateLimit(req) {
  const ip = getClientIp(req);
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  const existing = hits.get(ip) || [];
  const recent = existing.filter((t) => t > windowStart);

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldest = recent[0];
    const resetInSeconds = Math.ceil((oldest + WINDOW_MS - now) / 1000);
    hits.set(ip, recent);
    return { allowed: false, remaining: 0, resetInSeconds };
  }

  recent.push(now);
  hits.set(ip, recent);

  // Occasional cleanup so the map doesn't grow forever across a long-lived instance.
  if (hits.size > 5000) {
    for (const [key, timestamps] of hits) {
      const stillRecent = timestamps.filter((t) => t > windowStart);
      if (stillRecent.length === 0) hits.delete(key);
      else hits.set(key, stillRecent);
    }
  }

  return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - recent.length, resetInSeconds: 0 };
}

module.exports = { checkRateLimit, WINDOW_MS, MAX_REQUESTS_PER_WINDOW };
