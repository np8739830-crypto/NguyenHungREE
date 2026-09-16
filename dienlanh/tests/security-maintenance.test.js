'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { securityHeaders, requestIdentity, rateLimit, rejectBots } = require('../middleware/security');
const { restoreToPoint } = require('../services/d1RecoveryService');

function response() {
    return {
        headers: {}, statusCode: 200, body: null,
        setHeader(name, value) { this.headers[name] = value; },
        status(code) { this.statusCode = code; return this; },
        json(value) { this.body = value; return this; },
        send(value) { this.body = value; return this; },
        sendStatus(code) { this.statusCode = code; return this; }
    };
}

test('security middleware sets defensive headers and a request id', () => {
    const req = { secure: true, get: () => '', socket: {} };
    const res = response();
    requestIdentity(req, res, () => {});
    securityHeaders(req, res, () => {});
    assert.match(req.requestId, /^[0-9a-f-]{36}$/i);
    assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
    assert.equal(res.headers['X-Frame-Options'], 'DENY');
    assert.equal(res.headers['X-Request-ID'], req.requestId);
});

test('rate limiter applies only to configured methods', () => {
    const limiter = rateLimit({ namespace: `test-${Date.now()}`, max: 1, windowMs: 60_000, methods: ['POST'] });
    const makeReq = method => ({ method, ip: '127.0.0.1', path: '/auth/login', accepts: type => type === 'json' });
    let nextCalls = 0;
    limiter(makeReq('GET'), response(), () => { nextCalls += 1; });
    limiter(makeReq('POST'), response(), () => { nextCalls += 1; });
    const blocked = response();
    limiter(makeReq('POST'), blocked, () => { nextCalls += 1; });
    assert.equal(nextCalls, 2);
    assert.equal(blocked.statusCode, 429);
});

test('honeypot silently rejects automated form submissions', () => {
    const res = response();
    rejectBots({ body: { website: 'https://spam.invalid' } }, res, () => assert.fail('must not continue'));
    assert.equal(res.statusCode, 204);
});

test('D1 restore refuses to run without explicit production confirmation', async () => {
    await assert.rejects(
        restoreToPoint({ timestamp: '2026-09-15T00:00:00Z' }),
        /confirmation/i
    );
});
