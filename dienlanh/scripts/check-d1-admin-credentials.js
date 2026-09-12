'use strict';

require('dotenv').config({ override: true });
process.env.DATABASE_PROVIDER = 'd1';

const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

async function main() {
    const identity = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const user = (await query(`SELECT id, role, role_id, status, password_hash
        FROM users
        WHERE LOWER(username) = @identity OR LOWER(email) = @identity`, { identity })).recordset[0];
    console.log(`ADMIN_FOUND=${Boolean(user)}`);
    if (!user) return;
    console.log(`ROLE_OK=${user.role === 'admin'}`);
    console.log(`ROLE_ID_PRESENT=${Boolean(user.role_id)}`);
    console.log(`STATUS_ACTIVE=${user.status === 'active'}`);
    console.log(`PASSWORD_MATCH=${await bcrypt.compare(process.env.ADMIN_PASSWORD || '', user.password_hash || '')}`);
}

main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});
