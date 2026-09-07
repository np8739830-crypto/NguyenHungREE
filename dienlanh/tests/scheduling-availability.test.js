const test = require('node:test');
const assert = require('node:assert/strict');
const {
    WORKING_SLOTS,
    parseTimeRange,
    rangesOverlap,
    normalizeAppointmentDate,
    listAvailableSlots,
    hasBookingConflict
} = require('../services/schedulingService');

test('appointment dates are normalized before querying SQL Server', () => {
    assert.equal(normalizeAppointmentDate('2026-08-08'), '2026-08-08');
    assert.equal(normalizeAppointmentDate('2026-08-08T00:00:00.000Z'), '2026-08-08');
    assert.equal(normalizeAppointmentDate(new Date('2026-08-08T00:00:00.000Z')), '2026-08-08');
    assert.equal(normalizeAppointmentDate('08/08/2026'), '2026-08-08');
    assert.equal(normalizeAppointmentDate('31/02/2026'), null);
});

test('time overlap accepts adjacent ranges and rejects every intersecting range', () => {
    const existing = parseTimeRange('09:00 - 11:00');
    assert.equal(rangesOverlap(parseTimeRange('07:45 - 09:45'), existing), true);
    assert.equal(rangesOverlap(parseTimeRange('09:45 - 11:30'), existing), true);
    assert.equal(rangesOverlap(parseTimeRange('09:30 - 10:30'), existing), true);
    assert.equal(rangesOverlap(parseTimeRange('11:00 - 13:00'), existing), false);
});

test('07:45 - 09:45 disappears when the selected technician already has that booking', async () => {
    const queryFn = async (statement, params) => {
        assert.match(statement, /technician_id = @technicianId/);
        assert.match(statement, /<> 'cancelled'/);
        assert.equal(params.technicianId, 12);
        assert.equal(params.appointmentDate, '2026-08-05');
        return { recordset: [{ id: 91, appointment_time: '07:45 - 09:45' }] };
    };

    const slots = await listAvailableSlots({
        technicianId: 12,
        appointmentDate: '2026-08-05',
        queryFn
    });

    assert.equal(slots.includes('07:45 - 09:45'), false);
    assert.deepEqual(slots, WORKING_SLOTS.slice(1));
});

test('zero bookings returns every working slot and a full day returns none', async () => {
    const noBookings = async () => ({ recordset: [] });
    const fullDay = async () => ({ recordset: WORKING_SLOTS.map((appointment_time, index) => ({ id: index + 1, appointment_time })) });

    assert.deepEqual(await listAvailableSlots({ technicianId: 2, appointmentDate: '2026-08-08', queryFn: noBookings }), WORKING_SLOTS);
    assert.deepEqual(await listAvailableSlots({ technicianId: 2, appointmentDate: '2026-08-08', queryFn: fullDay }), []);
});

test('database availability check detects partial overlap, not only equal strings', async () => {
    const queryFn = async () => ({ recordset: [{ id: 92, appointment_time: '09:00 - 11:00' }] });
    assert.equal(await hasBookingConflict({ technicianId: 12, appointmentDate: '2026-08-05', appointmentTime: '09:45 - 11:30', queryFn }), true);
    assert.equal(await hasBookingConflict({ technicianId: 12, appointmentDate: '2026-08-05', appointmentTime: '11:00 - 13:00', queryFn }), false);
});
