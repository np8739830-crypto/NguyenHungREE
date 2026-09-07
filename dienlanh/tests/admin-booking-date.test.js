const test = require('node:test');
const assert = require('node:assert/strict');
const database = require('../config/database');

function makeRequest(body) {
    return {
        params: { id: '11' },
        body: {
            status: 'confirmed',
            technician_id: '',
            scheduled_date: '',
            scheduled_time: '08:00 - 10:00',
            work_note: 'Kiểm tra thiết bị',
            estimated_cost: '250000',
            ...body
        },
        messages: [],
        flash(type, message) { this.messages.push({ type, message }); }
    };
}

function makeResponse() {
    return {
        redirectedTo: null,
        redirect(path) { this.redirectedTo = path; return this; }
    };
}

async function runUpdate({ body, existing }) {
    const originalQuery = database.query;
    let updateParams;
    database.query = async (statement, params) => {
        if (/SELECT[\s\S]+FROM bookings[\s\S]+WHERE id = @id/i.test(statement)) {
            return { recordset: [existing] };
        }
        if (/UPDATE bookings/i.test(statement)) {
            updateParams = params;
            return { recordset: [], rowsAffected: [1] };
        }
        return { recordset: [], rowsAffected: [0] };
    };
    delete require.cache[require.resolve('../controllers/adminController')];
    const { updateBooking } = require('../controllers/adminController');
    const req = makeRequest(body);
    const res = makeResponse();
    let nextError;

    try {
        await updateBooking(req, res, error => { nextError = error; });
        return { req, res, updateParams, nextError };
    } finally {
        database.query = originalQuery;
        delete require.cache[require.resolve('../controllers/adminController')];
    }
}

test('admin booking update sends an input date to SQL Server as YYYY-MM-DD', async () => {
    const result = await runUpdate({
        body: { scheduled_date: '2026-08-09' },
        existing: { id: 11, technician_id: null, booking_date: new Date('2026-08-08T00:00:00.000Z'), booking_time: '08:00 - 10:00', scheduled_date: null, scheduled_time: null }
    });
    assert.equal(result.nextError, undefined);
    assert.equal(result.updateParams.scheduledDate, '2026-08-09');
    assert.equal(result.res.redirectedTo, '/admin/bookings');
});

test('blank date input reuses and normalizes the existing SQL Server Date', async () => {
    const result = await runUpdate({
        body: { scheduled_date: '' },
        existing: { id: 11, technician_id: null, booking_date: new Date('2026-08-08T00:00:00.000Z'), booking_time: '08:00 - 10:00', scheduled_date: new Date('2026-08-10T00:00:00.000Z'), scheduled_time: '08:00 - 10:00' }
    });
    assert.equal(result.nextError, undefined);
    assert.equal(result.updateParams.scheduledDate, '2026-08-10');
    assert.equal(result.res.redirectedTo, '/admin/bookings');
});

test('missing dates remain null instead of generating an incorrect date', async () => {
    const result = await runUpdate({
        body: { scheduled_date: '' },
        existing: { id: 11, technician_id: null, booking_date: null, booking_time: null, scheduled_date: null, scheduled_time: null }
    });
    assert.equal(result.nextError, undefined);
    assert.equal(result.updateParams.scheduledDate, null);
    assert.equal(result.res.redirectedTo, '/admin/bookings');
});

test('completing a booking stores entered service cost as actual revenue when actual cost is blank', async () => {
    const result = await runUpdate({
        body: { status: 'completed', technician_id: '7', scheduled_date: '2026-08-28', estimated_cost: '200000' },
        existing: { id: 11, status: 'in_progress', technician_id: 7, booking_date: new Date('2026-08-28T00:00:00.000Z'), booking_time: '08:00 - 10:00', scheduled_date: new Date('2026-08-28T00:00:00.000Z'), scheduled_time: '08:00 - 10:00', estimated_cost: null, actual_cost: null, completed_at: null }
    });
    assert.equal(result.nextError, undefined);
    assert.equal(result.updateParams.actualCost, 200000);
    assert.equal(result.updateParams.technicianId, 7);
    assert.equal(result.updateParams.scheduledDate, '2026-08-28');
    assert.equal(result.res.redirectedTo, '/admin/bookings');
});

test('changing the price of a completed booking updates stale actual cost when it was not edited separately', async () => {
    const result = await runUpdate({
        body: { status: 'completed', technician_id: '7', scheduled_date: '2026-08-28', estimated_cost: '200000000', actual_cost: '2000000000' },
        existing: { id: 24, status: 'completed', technician_id: 7, booking_date: new Date('2026-08-28T00:00:00.000Z'), booking_time: '13:45 - 15:45', scheduled_date: new Date('2026-08-28T00:00:00.000Z'), scheduled_time: '13:45 - 15:45', estimated_cost: 2000000000, actual_cost: 2000000000, completed_at: new Date('2026-08-28T00:00:00.000Z') }
    });
    assert.equal(result.nextError, undefined);
    assert.equal(result.updateParams.estimatedCost, 200000000);
    assert.equal(result.updateParams.actualCost, 200000000);
});

test('invalid submitted dates are rejected on the bookings page without running UPDATE', async () => {
    const result = await runUpdate({
        body: { scheduled_date: '08-09-2026' },
        existing: { id: 11, technician_id: null, booking_date: new Date('2026-08-08T00:00:00.000Z'), booking_time: '08:00 - 10:00', scheduled_date: null, scheduled_time: null }
    });
    assert.equal(result.nextError, undefined);
    assert.equal(result.updateParams, undefined);
    assert.equal(result.res.redirectedTo, '/admin/bookings');
    assert.match(result.req.messages[0].message, /Ngày thực hiện không hợp lệ/);
});
