const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { app } = require('../server');

function request(server, path) {
    const { port } = server.address();
    return new Promise((resolve, reject) => {
        const req = http.get({ host: '127.0.0.1', port, path }, res => {
            res.resume();
            res.on('end', () => resolve(res));
        });
        req.on('error', reject);
    });
}

test('server returns the public home page', async () => {
    const server = await new Promise(resolve => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });

    try {
        const response = await request(server, '/');
        assert.equal(response.statusCode, 200);
        assert.match(response.headers['content-type'], /text\/html/);
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});

test('Admin static assets use browser-compatible MIME types', async () => {
    const server = await new Promise(resolve => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });

    try {
        const css = await request(server, '/admin/css/1.css');
        const js = await request(server, '/admin/js/1.js');
        const logo = await request(server, '/images/logo.png');

        assert.equal(css.statusCode, 200);
        assert.match(css.headers['content-type'], /^text\/css/i);
        assert.equal(js.statusCode, 200);
        assert.match(js.headers['content-type'], /^(application|text)\/javascript/i);
        assert.equal(logo.statusCode, 200);
        assert.match(logo.headers['content-type'], /^image\/png/i);
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
});
