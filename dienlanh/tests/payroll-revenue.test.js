const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('manual revenue migration is period-unique and auditable', () => {
    const sql = fs.readFileSync(path.join(__dirname, '../migrations/20260827_payroll_revenue.sql'), 'utf8');
    for (const field of ['technician_id','revenue_month','revenue_year','revenue_amount','source','note','created_by','created_at','updated_at']) assert.match(sql, new RegExp(field));
    assert.match(sql, /UNIQUE \(technician_id, revenue_month, revenue_year\)/);
});

test('payroll revenue uses completed bookings, execution date, and actual cost with estimated fallback', () => {
    const source = fs.readFileSync(path.join(__dirname, '../services/payrollService.js'), 'utf8');
    assert.match(source, /b\.status='completed'/);
    assert.doesNotMatch(source, /b\.status='completed' AND b\.payment_status='paid'/);
    assert.match(source, /COALESCE\(b\.actual_cost,b\.estimated_cost,0\) revenue_amount/);
    assert.match(source, /COALESCE\(b\.scheduled_date,b\.booking_date,CAST\(b\.completed_at AS date\)\)>=@start/);
    assert.match(source, /MERGE dbo\.payroll_revenue/);
});

test('automatic revenue counts one completed 200000 service exactly once', async () => {
    const database = require('../config/database');
    const originalQuery = database.query;
    database.query = async statement => {
        assert.match(statement, /b\.technician_id=@employeeId/);
        assert.match(statement, /b\.status='completed'/);
        return { recordset: [{ id: 28, revenue_amount: 200000, status: 'completed' }] };
    };
    delete require.cache[require.resolve('../services/payrollService')];
    const { automaticRevenue } = require('../services/payrollService');
    try {
        const result = await automaticRevenue({ employee_id: 7, period_start: '2026-08-01', period_end: '2026-08-31' });
        assert.equal(result.details.length, 1);
        assert.equal(result.total, 200000);
    } finally {
        database.query = originalQuery;
        delete require.cache[require.resolve('../services/payrollService')];
    }
});

test('all requested revenue and productivity endpoints exist', () => {
    const source = fs.readFileSync(path.join(__dirname, '../routes/admin.js'), 'utf8');
    for (const endpoint of ['revenue','revenue-details','revenue/manual','revenue/sync','productivity']) assert.ok(source.includes(`/api/payroll/:id/${endpoint}`));
});
