'use strict';

require('dotenv').config({ override: true });
process.env.DATABASE_PROVIDER = 'd1';

const database = require('../config/database');

async function main() {
    await database.testConnection();

    const tableResult = await database.query(
        "SELECT COUNT(*) AS table_count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '_cf_%'"
    );
    const serviceResult = await database.query(
        'SELECT COUNT(*) AS service_count FROM services'
    );
    const userResult = await database.query(
        'SELECT COUNT(*) AS user_count FROM users'
    );

    console.log(`PROVIDER=${database.provider}`);
    console.log(`TABLES=${tableResult.recordset[0].table_count}`);
    console.log(`SERVICES=${serviceResult.recordset[0].service_count}`);
    console.log(`USERS=${userResult.recordset[0].user_count}`);
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
