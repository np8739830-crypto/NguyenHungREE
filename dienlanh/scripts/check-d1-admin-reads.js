'use strict';

require('dotenv').config({ override: true });
process.env.DATABASE_PROVIDER = 'd1';

const payroll = require('../services/payrollService');
const attendance = require('../services/attendanceService');

async function main() {
    const [employees, payrolls, attendanceRows] = await Promise.all([
        payroll.employees(),
        payroll.list({ page: 1, limit: 10 }),
        attendance.list({ month: 9, year: 2026, search: '', job_grade: '' })
    ]);
    console.log(`PAYROLL_EMPLOYEES=${employees.length}`);
    console.log(`PAYROLL_ROWS=${payrolls.data.length}`);
    console.log(`ATTENDANCE_ROWS=${attendanceRows.rows?.length ?? attendanceRows.data?.length ?? 0}`);
}

main().catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
});
