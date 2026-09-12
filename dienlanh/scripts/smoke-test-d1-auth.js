'use strict';

require('dotenv').config({ override: true });
process.env.DATABASE_PROVIDER = 'd1';
process.env.NODE_ENV = 'development';

const app = require('../server');
const { query, requestD1 } = require('../config/database');

async function main() {
    const marker = Date.now().toString();
    const email = `migration-check-${marker}@example.invalid`;
    const phone = `09${marker.slice(-8)}`;
    const password = `D1-check-${marker}!`;
    let userId = null;
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });

    try {
        const base = `http://127.0.0.1:${server.address().port}`;
        const register = await fetch(`${base}/auth/register`, {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: 'D1 Migration Check', email, phone, password })
        });
        const registered = await register.json();
        if (register.status !== 201 || !registered.id) throw new Error(`Đăng ký D1 lỗi: ${JSON.stringify(registered)}`);
        userId = registered.id;

        const login = await fetch(`${base}/auth/login`, {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const loggedIn = await login.json();
        const cookie = login.headers.get('set-cookie')?.split(';')[0];
        if (!login.ok || !loggedIn.user || !cookie) throw new Error(`Đăng nhập D1 lỗi: ${JSON.stringify(loggedIn)}`);

        const me = await fetch(`${base}/auth/me`, { headers: { cookie } });
        const meBody = await me.json();
        if (meBody.user?.id !== userId) throw new Error('Session D1 không giữ đúng tài khoản.');

        console.log(`D1_AUTH_SMOKE=OK USER_ID=${userId}`);
    } finally {
        if (userId) await query('DELETE FROM users WHERE id = @id', { id: userId });
        await requestD1('DELETE FROM app_sessions WHERE data LIKE ?', [`%${email}%`]);
        await new Promise(resolve => server.close(resolve));
    }
}

main().catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
});
