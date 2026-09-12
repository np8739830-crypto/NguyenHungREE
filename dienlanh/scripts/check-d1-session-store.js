'use strict';

require('dotenv').config({ override: true });
process.env.DATABASE_PROVIDER = 'd1';

const D1SessionStore = require('../services/d1SessionStore');

function invoke(store, method, ...args) {
    return new Promise((resolve, reject) => {
        store[method](...args, (error, value) => error ? reject(error) : resolve(value));
    });
}

async function main() {
    const store = new D1SessionStore({ ttl: 60_000 });
    const sid = `migration-check-${Date.now()}`;
    const expected = { cookie: { maxAge: 60_000 }, customer: { id: 7, role: 'user' } };

    await invoke(store, 'set', sid, expected);
    const restored = await invoke(store, 'get', sid);
    await invoke(store, 'destroy', sid);
    const removed = await invoke(store, 'get', sid);

    if (restored?.customer?.id !== expected.customer.id || removed !== null) {
        throw new Error('D1 session round-trip không hợp lệ.');
    }
    console.log('D1_SESSION_STORE=OK');
}

main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});
