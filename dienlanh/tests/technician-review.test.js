const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');

test('technician reviews are restricted to completed owned bookings and one review per booking', () => {
    const route = fs.readFileSync(path.join(__dirname, '../routes/account.js'), 'utf8');
    const migration = fs.readFileSync(path.join(__dirname, '../migrations/20260817_real_reviews.sql'), 'utf8');
    assert.match(route, /b\.id = @bookingId AND b\.user_id = @userId/);
    assert.match(route, /booking\.status !== 'completed'/);
    assert.match(route, /!booking\.technician_id/);
    assert.match(route, /csrfProtect/);
    assert.match(migration, /CREATE UNIQUE INDEX UX_reviews_booking/);
});

test('technician feedback has quality criteria but no payroll integration', () => {
    const route = fs.readFileSync(path.join(__dirname, '../routes/account.js'), 'utf8');
    const migration = fs.readFileSync(path.join(__dirname, '../migrations/20260817_real_reviews.sql'), 'utf8');
    for (const field of ['attitude_rating', 'punctuality_rating', 'technical_rating', 'explanation_rating', 'cleanliness_rating']) {
        assert.match(route, new RegExp(field));
        assert.match(migration, new RegExp(field));
    }
    assert.doesNotMatch(route, /payrollService|payrolls|salary_history/);
    assert.doesNotMatch(migration, /payrollService|payrolls|salary_history/);
});

test('public reviews API includes approved customer and technician reviews', () => {
    const route = fs.readFileSync(path.join(__dirname, '../routes/reviews.js'), 'utf8');
    assert.match(route, /WHERE r\.status = 'approved'/);
    assert.doesNotMatch(route, /WHERE r\.status = 'approved'\s+AND r\.technician_id IS NULL/);
    assert.match(route, /t\.full_name AS technician_name/);
});

test('customer review browser code and admin template compile', () => {
    const browserCode = fs.readFileSync(path.join(__dirname, '../../dienlanh- web/js/account.js'), 'utf8');
    assert.doesNotThrow(() => new Function(browserCode));
    const filename = path.join(__dirname, '../admin/views/reviews.ejs');
    assert.doesNotThrow(() => ejs.render(fs.readFileSync(filename, 'utf8'), {
        title: 'Reviews', reviews: [], selectedStatus: '', selectedRating: null,
        success_msg: [], error_msg: [], csrfToken: 'test', can: () => true,
        admin: null, account: null
    }, { filename }));
});
