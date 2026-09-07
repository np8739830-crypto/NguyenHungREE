const crypto = require('crypto');
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function keyFor(req) {
    const identity = String(req.body?.email || req.body?.identity || '').trim().toLowerCase();
    return crypto.createHash('sha256').update(`${req.ip}|${identity}`).digest('hex');
}

function passwordResetRateLimit(req, res, next) {
    const now = Date.now();
    if (attempts.size > 1000) {
        for (const [attemptKey, value] of attempts) if (value.resetAt <= now) attempts.delete(attemptKey);
    }
    const key = keyFor(req);
    const entry = attempts.get(key);
    if (!entry || entry.resetAt <= now) {
        attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
        return next();
    }
    if (entry.count >= MAX_ATTEMPTS) {
        res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
        return res.status(429).json({ error: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.' });
    }
    entry.count += 1;
    return next();
}

module.exports = { passwordResetRateLimit };
