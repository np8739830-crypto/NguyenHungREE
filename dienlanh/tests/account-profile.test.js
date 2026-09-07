const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const bcrypt = require('bcryptjs');
const database = require('../config/database');

function request(server, { path, method = 'GET', headers = {}, body } = {}) {
    const { port } = server.address();
    return new Promise((resolve, reject) => {
        const req = http.request({ host: '127.0.0.1', port, path, method, headers }, response => {
            let responseBody = '';
            response.setEncoding('utf8');
            response.on('data', chunk => { responseBody += chunk; });
            response.on('end', () => resolve({ response, body: responseBody }));
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

test('profile uses the session user and persists validated changes', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    const user = { id: 19, name: 'Old Name', email: 'member@example.com', phone: '0904000000', address: 'Địa chỉ cũ', avatar: null, created_at: '2026-01-01', role: 'user', status: 'active', password_hash: passwordHash };
    const originalQuery = database.query;
    let updateParams;
    database.query = async (sql, params = {}) => {
        if (sql.includes('UPDATE users')) {
            updateParams = params;
            Object.assign(user, { name: params.name, phone: params.phone, address: params.address });
        }
        return { recordset: [{ ...user }] };
    };
    delete require.cache[require.resolve('../controllers/authController')];
    delete require.cache[require.resolve('../routes/auth')];
    delete require.cache[require.resolve('../routes/account')];
    delete require.cache[require.resolve('../server')];
    const { app } = require('../server');
    const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });

    try {
        const unauthenticated = await request(server, { path: '/account/api/profile', headers: { Accept: 'application/json' } });
        assert.equal(unauthenticated.response.statusCode, 401);

        const login = await request(server, { path: '/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identity: user.email, password: 'correct-password' }) });
        const cookie = login.response.headers['set-cookie'][0].split(';')[0];
        const page = await request(server, { path: '/account/profile', headers: { Cookie: cookie } });
        assert.equal(page.response.statusCode, 200);
        assert.match(page.body, /header__container/);
        assert.match(page.body, /header__logo-brand/);

        const bookingHistory = await request(server, { path: '/account/bookings', headers: { Cookie: cookie } });
        assert.equal(bookingHistory.response.statusCode, 200);
        assert.match(bookingHistory.body, /header__container/);
        assert.match(bookingHistory.body, /js\/script\.js/);
        assert.match(bookingHistory.body, /headerUser/);

        const update = await request(server, { path: '/account/api/profile', method: 'PUT', headers: { Cookie: cookie, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ name: 'New Name', phone: '0904123456', address: 'Địa chỉ mới' }) });
        assert.equal(update.response.statusCode, 200);
        assert.deepEqual(JSON.parse(update.body).user.name, 'New Name');
        assert.equal(updateParams.userId, user.id);
        assert.equal(updateParams.phone, '0904123456');

        const profile = await request(server, { path: '/account/api/profile', headers: { Cookie: cookie, Accept: 'application/json' } });
        assert.deepEqual(JSON.parse(profile.body).user.address, 'Địa chỉ mới');
    } finally {
        database.query = originalQuery;
        await new Promise(resolve => server.close(resolve));
    }
});
