'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local'), override: true });
process.env.DATABASE_PROVIDER = 'd1';

const { query } = require('../config/database');

const KEEP_USER_ID = 12;
const CONFIRMATION = `KEEP_USER_${KEEP_USER_ID}`;

async function rows(statement, params = {}) {
    return (await query(statement, params)).recordset || [];
}

async function main() {
    const customers = await rows(
        "SELECT id, name, email, phone, status, created_at FROM users WHERE role='user' ORDER BY created_at DESC"
    );
    const keep = customers.find(customer => Number(customer.id) === KEEP_USER_ID);
    const remove = customers.filter(customer => Number(customer.id) !== KEEP_USER_ID);

    if (!keep) throw new Error(`Không tìm thấy tài khoản cần giữ: KH-${String(KEEP_USER_ID).padStart(3, '0')}.`);

    console.log(JSON.stringify({ mode: process.env.RESET_CUSTOMERS_CONFIRM === CONFIRMATION ? 'execute' : 'preview', keep, remove }, null, 2));
    if (process.env.RESET_CUSTOMERS_CONFIRM !== CONFIRMATION) return;

    // Preserve operational history while removing ownership by deleted accounts.
    for (const table of ['bookings', 'contacts', 'reviews']) {
        await query(`UPDATE ${table} SET user_id=NULL WHERE user_id<>@keepUserId`, { keepUserId: KEEP_USER_ID });
    }
    await query('DELETE FROM password_resets WHERE user_id<>@keepUserId', { keepUserId: KEEP_USER_ID });
    await query("DELETE FROM users WHERE role='user' AND id<>@keepUserId", { keepUserId: KEEP_USER_ID });

    const remaining = await rows(
        "SELECT id, name, email, phone, status, created_at FROM users WHERE role='user' ORDER BY created_at DESC"
    );
    console.log(JSON.stringify({ deleted: remove.length, remaining }, null, 2));
}

main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});
