const fs = require('fs');
const path = require('path');
const { getConnection } = require('../config/database');

async function runRbacMigration() {
    const migrationPath = path.join(__dirname, '../migrations/001_admin_rbac.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    const batches = migrationSql.split(/^\s*GO\s*$/gim).map(batch => batch.trim()).filter(Boolean);
    const connection = await getConnection();

    for (const batch of batches) {
        await connection.request().batch(batch);
    }
}

module.exports = { runRbacMigration };
