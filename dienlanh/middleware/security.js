'use strict';

const crypto = require('crypto');

const buckets = new Map();

function clientIp(req) {
    return String(req.ip || req.socket?.remoteAddress || 'unknown').slice(0, 100);
}

function securityHeaders(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    if (process.env.NODE_ENV === 'production' && req.secure) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
}

function requestIdentity(req, res, next) {
    const incoming = String(req.get('x-request-id') || '');
    req.requestId = /^[a-zA-Z0-9._:-]{8,100}$/.test(incoming) ? incoming : crypto.randomUUID();
    res.setHeader('X-Request-ID', req.requestId);
    next();
}

function rateLimit(options = {}) {
    const windowMs = Number(options.windowMs) || 15 * 60 * 1000;
    const max = Number(options.max) || 100;
    const namespace = options.namespace || 'default';
    const message = options.message || 'Quá nhiều yêu cầu. Vui lòng thử lại sau.';
    const methods = Array.isArray(options.methods) ? new Set(options.methods.map(value => String(value).toUpperCase())) : null;

    return (req, res, next) => {
        if (methods && !methods.has(req.method)) return next();
        const now = Date.now();
        const key = `${namespace}:${clientIp(req)}`;
        let bucket = buckets.get(key);
        if (!bucket || bucket.resetAt <= now) bucket = { count: 0, resetAt: now + windowMs };
        bucket.count += 1;
        buckets.set(key, bucket);
        res.setHeader('RateLimit-Limit', String(max));
        res.setHeader('RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
        res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
        if (bucket.count <= max) return next();
        res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
        if (req.accepts('json') || req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
            return res.status(429).json({ error: message, requestId: req.requestId });
        }
        return res.status(429).send(message);
    };
}

function rejectBots(req, res, next) {
    const body = req.body || {};
    if (body.website || body.company_website || body.fax_number) return res.sendStatus(204);
    next();
}

function cleanupRateLimits(now = Date.now()) {
    let removed = 0;
    for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) {
            buckets.delete(key);
            removed += 1;
        }
    }
    return removed;
}

module.exports = { securityHeaders, requestIdentity, rateLimit, rejectBots, cleanupRateLimits };
