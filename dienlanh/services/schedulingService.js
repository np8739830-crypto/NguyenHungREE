const { query, getConnection, sql } = require('../config/database');

const WORKING_SLOTS = Object.freeze([
    '07:45 - 09:45',
    '09:45 - 11:30',
    '13:45 - 15:45',
    '15:45 - 17:30'
]);
const CONFLICT_MESSAGE = 'Kỹ thuật viên đã có lịch trùng với khung giờ này.';

function parseTimeRange(value) {
    const match = String(value || '').match(/^(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const [, startHour, startMinute, endHour, endMinute] = match.map(Number);
    if (startHour > 23 || endHour > 23 || startMinute > 59 || endMinute > 59) return null;
    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;
    return start < end ? { start, end } : null;
}

function rangesOverlap(first, second) {
    return Boolean(first && second && first.start < second.end && second.start < first.end);
}

function normalizeAppointmentDate(value) {
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return null;
        const year = value.getUTCFullYear();
        const month = value.getUTCMonth() + 1;
        const day = value.getUTCDate();
        return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    const input = String(value || '').trim();
    let year;
    let month;
    let day;
    let match = input.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
    if (match) {
        [, year, month, day] = match.map(Number);
    } else {
        match = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (!match) return null;
        [, day, month, year] = match.map(Number);
    }
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function findConflictingBooking(rows, appointmentTime) {
    const requestedRange = parseTimeRange(appointmentTime);
    if (!requestedRange) return null;
    return rows.find(row => rangesOverlap(requestedRange, parseTimeRange(row.appointment_time || row.booking_time || row.scheduled_time))) || null;
}

async function getTechnicianBookings({ technicianId, appointmentDate, excludeBookingId = null, queryFn = query, lock = false }) {
    if (!technicianId || !appointmentDate) return [];
    const normalizedDate = normalizeAppointmentDate(appointmentDate);
    if (!normalizedDate) {
        const error = new Error('Ngày hẹn không hợp lệ. Vui lòng dùng định dạng YYYY-MM-DD.');
        error.statusCode = 400;
        throw error;
    }
    const lockHint = lock ? ' WITH (UPDLOCK, HOLDLOCK)' : '';
    const result = await queryFn(`
        SELECT id, COALESCE(NULLIF(scheduled_time, ''), booking_time) AS appointment_time
        FROM dbo.bookings${lockHint}
        WHERE technician_id = @technicianId
          AND COALESCE(status, 'pending') <> 'cancelled'
          AND id <> COALESCE(@excludeBookingId, -1)
          AND (
                (scheduled_date IS NOT NULL AND CAST(scheduled_date AS date) = CONVERT(date, @appointmentDate, 23))
             OR (scheduled_date IS NULL AND CAST(booking_date AS date) = CONVERT(date, @appointmentDate, 23))
          )`, { technicianId, appointmentDate: normalizedDate, excludeBookingId });
    return result.recordset || [];
}

function calculateAvailableSlots(bookings) {
    return WORKING_SLOTS.filter(slot => !findConflictingBooking(bookings, slot));
}

async function listAvailableSlots({ technicianId, appointmentDate, excludeBookingId = null, queryFn = query }) {
    const bookings = await getTechnicianBookings({ technicianId, appointmentDate, excludeBookingId, queryFn });
    return calculateAvailableSlots(bookings);
}

async function hasBookingConflict({ technicianId, appointmentDate, appointmentTime, excludeBookingId = null, queryFn = query }) {
    if (!technicianId || !appointmentDate || !appointmentTime) return false;
    const bookings = await getTechnicianBookings({ technicianId, appointmentDate, excludeBookingId, queryFn });
    return Boolean(findConflictingBooking(bookings, appointmentTime));
}

async function assertAvailableTechnician({ technicianId, appointmentDate, appointmentTime, excludeBookingId, queryFn = query }) {
    if (!parseTimeRange(appointmentTime)) {
        const error = new Error('Khung giờ hẹn không hợp lệ.');
        error.statusCode = 400;
        throw error;
    }
    const technician = (await queryFn(
        "SELECT id FROM dbo.technicians WHERE id = @id AND work_status IN ('available', 'busy')", { id: technicianId }
    )).recordset[0];
    if (!technician) {
        const error = new Error('Kỹ thuật viên không còn ở trạng thái đang làm việc.');
        error.statusCode = 400;
        throw error;
    }
    if (await hasBookingConflict({ technicianId, appointmentDate, appointmentTime, excludeBookingId, queryFn })) {
        const error = new Error(CONFLICT_MESSAGE);
        error.statusCode = 409;
        throw error;
    }
}

async function createBookingAtomically(data) {
    const requestedRange = parseTimeRange(data.booking_time);
    if (!requestedRange) {
        const error = new Error('Khung giờ hẹn không hợp lệ.');
        error.statusCode = 400;
        throw error;
    }

    const pool = await getConnection();
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
        const run = async (statement, params = {}) => {
            const request = new sql.Request(transaction);
            Object.entries(params).forEach(([key, value]) => request.input(key, value));
            return request.query(statement);
        };
        const technician = (await run(
            "SELECT id FROM dbo.technicians WITH (UPDLOCK, HOLDLOCK) WHERE id = @id AND work_status IN ('available', 'busy')",
            { id: data.technician_id }
        )).recordset[0];
        if (!technician) {
            const error = new Error('Kỹ thuật viên không còn ở trạng thái đang làm việc.');
            error.statusCode = 400;
            throw error;
        }

        const bookings = await getTechnicianBookings({
            technicianId: data.technician_id,
            appointmentDate: data.booking_date,
            queryFn: run,
            lock: true
        });
        if (findConflictingBooking(bookings, data.booking_time)) {
            const error = new Error(CONFLICT_MESSAGE);
            error.statusCode = 409;
            throw error;
        }

        const keys = Object.keys(data).filter(key => data[key] !== undefined && data[key] !== null && data[key] !== '');
        const result = await run(
            `INSERT INTO dbo.bookings (${keys.join(', ')}) OUTPUT INSERTED.id VALUES (${keys.map(key => `@${key}`).join(', ')})`,
            data
        );
        await transaction.commit();
        return result.recordset[0].id;
    } catch (error) {
        try { await transaction.rollback(); } catch (_) { /* transaction may already be closed */ }
        throw error;
    }
}

module.exports = {
    WORKING_SLOTS,
    CONFLICT_MESSAGE,
    parseTimeRange,
    rangesOverlap,
    normalizeAppointmentDate,
    findConflictingBooking,
    getTechnicianBookings,
    calculateAvailableSlots,
    listAvailableSlots,
    hasBookingConflict,
    assertAvailableTechnician,
    createBookingAtomically
};
