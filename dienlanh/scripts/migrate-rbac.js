require('dotenv').config();

const { getConnection } = require('../config/database');
const { runRbacMigration } = require('../services/rbacMigrationService');

async function migrate() {
    await runRbacMigration();
    console.log('RBAC migration completed successfully.');
    const connection = await getConnection();
    await connection.close();
}

migrate().catch(error => {
    console.error('RBAC migration failed:', error.message);
    process.exitCode = 1;
});
