const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const database = require('../config/database');

function request(server, path) {
    const { port } = server.address();
    return new Promise((resolve, reject) => {
        const req = http.get({ host: '127.0.0.1', port, path, headers: { Accept: 'application/json' } }, response => {
            let body = '';
            response.on('data', chunk => { body += chunk; });
            response.on('end', () => resolve({ response, body }));
        });
        req.on('error', reject);
    });
}

test('news detail page and slug API resolve the corresponding published article', async () => {
    const originalQuery = database.query;
    database.query = async (sql, params = {}) => {
        if (sql.includes("FROM news WHERE slug = @slug")) {
            if (params.slug !== 'bao-tri-may-lanh') return { recordset: [] };
            return { recordset: [{ id: 12, slug: 'bao-tri-may-lanh', title: 'Bảo trì máy lạnh', category: 'Máy lạnh', image: 'suamaylanh.png', excerpt: 'Mẹo bảo trì.', content: 'Nội dung bài viết.', status: 'published', published_at: '2025-03-15T00:00:00.000Z' }] };
        }
        if (sql.includes('SELECT TOP (3)')) return { recordset: [{ id: 13, slug: 've-sinh-may-lanh', title: 'Vệ sinh máy lạnh', category: 'Máy lạnh', image: 'vsmaylanh.png', excerpt: 'Bài viết liên quan.', published_at: '2025-03-10T00:00:00.000Z' }] };
        if (sql.includes('FROM settings')) return { recordset: [{ value: 'Điện Lạnh Nguyên Hùng' }] };
        return { recordset: [] };
    };

    delete require.cache[require.resolve('../controllers/newsController')];
    delete require.cache[require.resolve('../routes/news')];
    delete require.cache[require.resolve('../server')];
    const { app } = require('../server');
    const server = await new Promise(resolve => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });

    try {
        const page = await request(server, '/news/bao-tri-may-lanh');
        assert.equal(page.response.statusCode, 200);
        assert.match(page.body, /newsArticle/);

        const missingPage = await request(server, '/news/khong-ton-tai');
        assert.equal(missingPage.response.statusCode, 404);
        assert.match(missingPage.body, /Bài viết không tồn tại/);

        const api = await request(server, '/news/api/slug/bao-tri-may-lanh');
        assert.equal(api.response.statusCode, 200);
        const body = JSON.parse(api.body);
        assert.equal(body.article.slug, 'bao-tri-may-lanh');
        assert.equal(body.article.author, 'Điện Lạnh Nguyên Hùng');
        assert.equal(body.related[0].slug, 've-sinh-may-lanh');
    } finally {
        database.query = originalQuery;
        await new Promise(resolve => server.close(resolve));
    }
});
