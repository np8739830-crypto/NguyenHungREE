require('dotenv').config({ override: true });

async function checkSqlServer() {
    if (process.argv[2]) process.env.DB_SERVER = process.argv[2];
    if (process.argv[3] === '--no-port') process.env.DB_PORT = '';

    const { getConnection } = require('../config/database');
    const connection = await getConnection();
    const result = await connection.request().query(
        "SELECT @@SERVERNAME AS server_name, DB_ID('DienLanhNguyenHung') AS database_id"
    );
    const row = result.recordset[0];
    console.log(`SQL_CONNECTED=true SERVER=${row.server_name} DATABASE_FOUND=${Boolean(row.database_id)}`);
    if (!row.database_id) process.exitCode = 2;

    if (row.database_id) {
        const inventory = await connection.request().query(`
            USE DienLanhNguyenHung;
            SELECT t.name AS table_name, SUM(p.rows) AS row_count
            FROM sys.tables t
            JOIN sys.schemas s ON s.schema_id = t.schema_id
            JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
            WHERE s.name = 'dbo'
            GROUP BY t.name
            ORDER BY t.name;
        `);
        console.log(`SQL_TABLE_COUNT=${inventory.recordset.length}`);
        console.log(`SQL_ROW_COUNT=${inventory.recordset.reduce((sum, item) => sum + Number(item.row_count), 0)}`);
    }
}

checkSqlServer().catch(error => {
    console.error(`SQL_CONNECTED=false ERROR=${error.message}`);
    process.exitCode = 1;
});
