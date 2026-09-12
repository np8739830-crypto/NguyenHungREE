'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local'), override: true });
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), override: true });
process.env.DATABASE_PROVIDER = 'd1';

const { query, requestD1 } = require('../config/database');
const { del } = require('@vercel/blob');

async function main() {
    const email = 'vercel-blob-smoke-20260912@example.invalid';
    const user = (await query('SELECT id, avatar FROM users WHERE email = @email', { email })).recordset[0];
    if (user?.avatar?.startsWith('/uploads/')) {
        await del(`public-uploads/${path.basename(user.avatar)}`).catch(() => {});
    }
    await requestD1('DELETE FROM app_sessions WHERE data LIKE ?', [`%${email}%`]);
    const result = await query('DELETE FROM users WHERE email = @email', { email });
    console.log(`BLOB_USER_SMOKE_CLEANUP=${result.rowsAffected.reduce((sum, value) => sum + value, 0)}`);
}

main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});
