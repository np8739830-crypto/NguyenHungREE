'use strict';

require('dotenv').config({ override: true });
process.env.DATABASE_PROVIDER = 'd1';
const { query, requestD1 } = require('../config/database');

async function main() {
    const email = 'vercel-d1-smoke-20260912@example.invalid';
    await requestD1('DELETE FROM app_sessions WHERE data LIKE ?', [`%${email}%`]);
    const result = await query('DELETE FROM users WHERE email = @email', { email });
    console.log(`D1_SMOKE_CLEANUP=${result.rowsAffected.reduce((sum, value) => sum + value, 0)}`);
}

main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});
