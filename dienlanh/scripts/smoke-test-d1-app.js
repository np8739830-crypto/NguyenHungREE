'use strict';

require('dotenv').config({ override: true });
process.env.DATABASE_PROVIDER = 'd1';
process.env.NODE_ENV = 'development';

const app = require('../server');

async function main() {
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });
    try {
        const port = server.address().port;
        const [services, content, me] = await Promise.all([
            fetch(`http://127.0.0.1:${port}/services/api`),
            fetch(`http://127.0.0.1:${port}/content/bootstrap`),
            fetch(`http://127.0.0.1:${port}/auth/me`)
        ]);
        const serviceRows = await services.json();
        const contentBody = await content.json();
        const meBody = await me.json();
        if (!services.ok || serviceRows.length !== 9) throw new Error('API dịch vụ D1 không hợp lệ.');
        if (!content.ok || !contentBody.settings || !Array.isArray(contentBody.pricing)) throw new Error('API nội dung D1 không hợp lệ.');
        if (!me.ok || meBody.user !== null) throw new Error('API session chưa đăng nhập không hợp lệ.');
        console.log(`D1_APP_SMOKE=OK SERVICES=${serviceRows.length} PRICING=${contentBody.pricing.length}`);
    } finally {
        await new Promise(resolve => server.close(resolve));
    }
}

main().catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
});
