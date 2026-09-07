const fs = require('fs');
const path = require('path');
const { getConnection } = require('../config/database');

async function runContactOwnershipMigration() {
    const migrationSql = fs.readFileSync(
        path.join(__dirname, '../migrations/20260826_contact_ownership.sql'),
        'utf8'
    );
    const connection = await getConnection();
    const batches = migrationSql
        .split(/^\s*GO\s*$/gim)
        .map(batch => batch.trim())
        .filter(Boolean);

    for (const batch of batches) await connection.request().batch(batch);
}

module.exports = { runContactOwnershipMigration };
