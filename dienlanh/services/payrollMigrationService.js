const fs = require('fs');
const path = require('path');
const { getConnection } = require('../config/database');

async function runPayrollMigration() {
    const connection = await getConnection();
    for (const filename of ['20260827_payroll.sql', '20260827_payroll_revenue.sql']) {
        const sql = fs.readFileSync(path.join(__dirname, '../migrations', filename), 'utf8');
        const batches = sql.split(/^\s*GO\s*$/gim).map(item => item.trim()).filter(Boolean);
        for (const batch of batches) await connection.request().batch(batch);
    }
}

module.exports = { runPayrollMigration };
