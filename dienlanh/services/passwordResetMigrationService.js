const fs = require('fs');
const path = require('path');
const { getConnection } = require('../config/database');

async function runPasswordResetMigration() {
    const sql = fs.readFileSync(path.join(__dirname, '../migrations/20260813_secure_password_resets.sql'), 'utf8');
    const connection = await getConnection();
    for (const batch of sql.split(/^\s*GO\s*$/gim).map(value => value.trim()).filter(Boolean)) {
        await connection.request().batch(batch);
    }
}

module.exports = { runPasswordResetMigration };
