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

test('login session survives navigation and refresh checks, then is removed by logout', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    const originalQuery = database.query;
    let loginQuery;
    database.query = async sql => {
        loginQuery = sql;
        return {
            recordset: [{ id: 7, name: 'Session User', email: 'user@example.com', role: 'user', status: 'active', password_hash: passwordHash }]
        };
    };

    // Load the app after stubbing the database function used by authController.
    delete require.cache[require.resolve('../controllers/authController')];
    delete require.cache[require.resolve('../routes/auth')];
    delete require.cache[require.resolve('../server')];
    const { app } = require('../server');
    const server = await new Promise(resolve => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });

    try {
        const login = await request(server, {
            path: '/auth/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ identity: 'user@example.com', password: 'correct-password' })
        });
        assert.equal(login.response.statusCode, 200);
        assert.match(loginQuery, /role\s*=\s*'user'/i);
        assert.deepEqual(JSON.parse(login.body).user, { id: 7, name: 'Session User', email: 'user@example.com', role: 'user' });

        const cookie = login.response.headers['set-cookie'][0].split(';')[0];
        assert.match(login.response.headers['set-cookie'][0], /HttpOnly/i);
        assert.match(login.response.headers['set-cookie'][0], /SameSite=Lax/i);

        const currentUser = await request(server, { path: '/auth/me', headers: { Cookie: cookie, Accept: 'application/json' } });
        assert.deepEqual(JSON.parse(currentUser.body).user, { id: 7, name: 'Session User', email: 'user@example.com', role: 'user' });

        const navigation = await request(server, { path: '/about', headers: { Cookie: cookie } });
        assert.equal(navigation.response.statusCode, 200);

        const refreshedUser = await request(server, { path: '/auth/me', headers: { Cookie: cookie, Accept: 'application/json' } });
        assert.deepEqual(JSON.parse(refreshedUser.body).user, { id: 7, name: 'Session User', email: 'user@example.com', role: 'user' });

        const protectedWithoutSession = await request(server, {
            path: '/booking', method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: '{}'
        });
        assert.equal(protectedWithoutSession.response.statusCode, 401);
        assert.deepEqual(JSON.parse(protectedWithoutSession.body), {
            success: false,
            message: 'Vui lòng đăng nhập để gửi yêu cầu.'
        });

        for (const path of ['/contact', '/api/bookings', '/api/contacts']) {
            const response = await request(server, {
                path, method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: '{}'
            });
            assert.equal(response.response.statusCode, 401, `${path} must reject unauthenticated writes`);
            assert.deepEqual(JSON.parse(response.body), {
                success: false,
                message: 'Vui lòng đăng nhập để gửi yêu cầu.'
            });
        }

        const apiWithoutJsonHeaders = await request(server, { path: '/api/bookings', method: 'POST' });
        assert.equal(apiWithoutJsonHeaders.response.statusCode, 401);

        const logout = await request(server, { path: '/auth/logout', method: 'POST', headers: { Cookie: cookie, Accept: 'application/json' } });
        assert.equal(logout.response.statusCode, 200);

        const afterLogout = await request(server, { path: '/auth/me', headers: { Cookie: cookie, Accept: 'application/json' } });
        assert.equal(JSON.parse(afterLogout.body).user, null);
    } finally {
        database.query = originalQuery;
        await new Promise(resolve => server.close(resolve));
    }
});
