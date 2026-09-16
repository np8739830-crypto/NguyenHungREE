'use strict';

const crypto = require('crypto');

const buckets = new Map();
let distributedTableReady;

function clientIp(req) {
    return String(req.ip || req.socket?.remoteAddress || 'unknown').slice(0, 100);
}

function distributedAvailable() {
    return Boolean(process.env.VERCEL && process.env.CLOUDFLARE_ACCOUNT_ID &&
        process.env.CLOUDFLARE_D1_DATABASE_ID && process.env.CLOUDFLARE_D1_API_TOKEN);
}

function safeKeyPart(value) {
    return crypto.createHash('sha256').update(String(value)).digest('hex');
}

async function distributedBucket(key, windowMs, now) {
    const { requestD1 } = require('../config/d1Database');
    if (!distributedTableReady) {
        distributedTableReady = requestD1(`CREATE TABLE IF NOT EXISTS security_rate_limits (
            bucket_key TEXT PRIMARY KEY,
            request_count INTEGER NOT NULL,
            reset_at INTEGER NOT NULL
        )`).catch(error => {
            distributedTableReady = null;
            throw error;
        });
    }
    await distributedTableReady;
    const resetAt = now + windowMs;
    const result = await requestD1(`INSERT INTO security_rate_limits(bucket_key, request_count, reset_at)
        VALUES (?, 1, ?)
        ON CONFLICT(bucket_key) DO UPDATE SET
            request_count = CASE WHEN reset_at <= ? THEN 1 ELSE request_count + 1 END,
            reset_at = CASE WHEN reset_at <= ? THEN ? ELSE reset_at END
        RETURNING request_count, reset_at`, [key, resetAt, now, now, resetAt]);
    const row = result.results?.[0] || {};
    return { count: Number(row.request_count || 1), resetAt: Number(row.reset_at || resetAt) };
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
    const distributed = options.distributed === true;
    const identity = typeof options.identity === 'function' ? options.identity : () => '';

    return async (req, res, next) => {
        if (methods && !methods.has(req.method)) return next();
        const now = Date.now();
        const rawKey = `${namespace}:${clientIp(req)}:${identity(req)}`;
        const key = distributed ? `${namespace}:${safeKeyPart(rawKey)}` : rawKey;
        let bucket;
        if (distributed && distributedAvailable()) {
            try {
                bucket = await distributedBucket(key, windowMs, now);
            } catch (error) {
                console.error(`Distributed rate limit unavailable (${namespace}): ${error.message}`);
            }
        }
        if (!bucket) {
            bucket = buckets.get(key);
            if (!bucket || bucket.resetAt <= now) bucket = { count: 0, resetAt: now + windowMs };
            bucket.count += 1;
            buckets.set(key, bucket);
        }
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
    if (body.website || body.company_website || body.fax_number) {
        res.setHeader('Cache-Control', 'no-store');
        return res.sendStatus(204);
    }
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
