require('dotenv').config({ path: require('path').join(__dirname, '../.env'), override: true });
const { runRbacMigration } = require('../services/rbacMigrationService');
const { runPayrollMigration } = require('../services/payrollMigrationService');
const { query } = require('../config/database');

(async() => {
    await runRbacMigration();
    await runPayrollMigration();
    const result = await query(`SELECT OBJECT_ID('dbo.payrolls') AS table_id,
        (SELECT COUNT(*) FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.payrolls') AND is_unique=1) AS unique_indexes,
        (SELECT COUNT(*) FROM sys.foreign_keys WHERE parent_object_id=OBJECT_ID('dbo.payrolls')) AS foreign_keys`);
    console.log('Payroll migration complete:', result.recordset[0]);
    process.exit(0);
})().catch(error => {
    console.error('Payroll migration failed:', error.message);
    process.exit(1);
});
