'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.local'), override: true });

const { put, get, del } = require('@vercel/blob');

async function main() {
    const pathname = `migration-smoke/${Date.now()}.txt`;
    let url;
    try {
        const created = await put(pathname, Buffer.from('blob-ok'), {
            access: 'private',
            contentType: 'text/plain',
            addRandomSuffix: false
        });
        url = created.url;
        const restored = await get(pathname, { access: 'private' });
        if (!restored || restored.statusCode !== 200) throw new Error('Không đọc lại được Blob vừa tạo.');
        const content = await new Response(restored.stream).text();
        if (content !== 'blob-ok') throw new Error('Nội dung Blob đọc lại không khớp.');
        console.log('VERCEL_BLOB_SMOKE=OK');
    } finally {
        if (url) await del(url).catch(() => {});
    }
}

main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});
