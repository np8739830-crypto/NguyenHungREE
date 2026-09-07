const express = require('express');
const { query } = require('../config/database');
const { getTechnicianBookings, calculateAvailableSlots, findConflictingBooking, normalizeAppointmentDate, CONFLICT_MESSAGE } = require('../services/schedulingService');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

async function listAvailableTechnicians(req, res, next) {
    try {
        const technicians = (await query(`SELECT id, avatar, full_name, phone, email, specialty, experience, service_area, work_status, employee_type, job_grade, base_salary, uses_company_vehicle, start_date, probation_start_date, probation_end_date, created_at, updated_at
            FROM dbo.technicians WHERE work_status IN ('available', 'busy') ORDER BY full_name`)).recordset.map(formatTechnician);
        return res.json({ success: true, technicians });
    } catch (error) { return next(error); }
}

router.get('/technicians', listAvailableTechnicians);
router.get('/technicians/public', listAvailableTechnicians);
router.get('/technicians/:id', requireAdmin, async (req, res, next) => {
    try {
        const technician = (await query(`SELECT id, avatar, full_name, phone, email, specialty, experience, service_area, work_status, employee_type, job_grade, base_salary, uses_company_vehicle, start_date, probation_start_date, probation_end_date, created_at, updated_at FROM dbo.technicians WHERE id=@id`, { id: req.params.id })).recordset[0];
        if (!technician) return res.status(404).json({ success: false, message: 'Không tìm thấy kỹ thuật viên.' });
        return res.json({ success: true, technician: formatTechnician(technician) });
    } catch (error) { return next(error); }
});

function formatTechnician(t) {
    const statusLabels = { available: 'Đang rảnh', busy: 'Đang làm việc', leave: 'Nghỉ', inactive: 'Nghỉ' };
    return { id: t.id, avatar: t.avatar, fullName: t.full_name, phone: t.phone, email: t.email, specialty: t.specialty, experience: t.experience, workArea: t.service_area, status: statusLabels[t.work_status] || t.work_status, statusCode: t.work_status, employeeType: t.employee_type, jobLevel: t.job_grade, baseSalary: Number(t.base_salary || 0), vehicleUsage: Boolean(t.uses_company_vehicle), startDate: t.start_date, probationStart: t.probation_start_date, probationEnd: t.probation_end_date, createdAt: t.created_at, updatedAt: t.updated_at };
}
function technicianInput(body = {}) {
    const statuses = { 'Đang rảnh': 'available', 'Đang làm việc': 'busy', 'Nghỉ': 'leave', available: 'available', busy: 'busy', leave: 'leave', inactive: 'inactive' };
    return { fullName: body.fullName || body.full_name, phone: body.phone, email: body.email || null, avatar: body.avatar || null, specialty: body.specialty || null, experience: body.experience || null, workArea: body.workArea || body.service_area || null, status: statuses[body.status || body.work_status] || 'available', employeeType: (body.employeeType || body.employee_type) === 'probation' ? 'probation' : 'official', jobGrade: (body.jobLevel || body.job_grade) === 'technician' ? 'technician' : 'assistant', baseSalary: Math.max(0, Number(body.baseSalary ?? body.base_salary) || 5000000), usesVehicle: ['1', 1, true, 'true'].includes(body.vehicleUsage ?? body.uses_company_vehicle) ? 1 : 0, startDate: body.startDate || body.start_date || null, probationStart: body.probationStart || body.probation_start_date || null, probationEnd: body.probationEnd || body.probation_end_date || null };
}
router.post('/technicians', requireAdmin, async (req, res, next) => {
    try { const t = technicianInput(req.body); if (!t.fullName || !t.phone) return res.status(400).json({ success: false, message: 'Họ tên và số điện thoại là bắt buộc.' });
        const result = await query(`INSERT INTO dbo.technicians (full_name,phone,email,avatar,specialty,experience,service_area,work_status,employee_type,job_grade,base_salary,uses_company_vehicle,start_date,probation_start_date,probation_end_date,updated_at) OUTPUT INSERTED.* VALUES (@fullName,@phone,@email,@avatar,@specialty,@experience,@workArea,@status,@employeeType,@jobGrade,@baseSalary,@usesVehicle,@startDate,@probationStart,@probationEnd,GETDATE())`, t);
        return res.status(201).json({ success: true, technician: formatTechnician(result.recordset[0]) });
    } catch (error) { return next(error); }
});
router.put('/technicians/:id', requireAdmin, async (req, res, next) => {
    try { const t = technicianInput(req.body); if (!t.fullName || !t.phone) return res.status(400).json({ success: false, message: 'Họ tên và số điện thoại là bắt buộc.' });
        const result = await query(`UPDATE dbo.technicians SET full_name=@fullName,phone=@phone,email=@email,avatar=COALESCE(@avatar,avatar),specialty=@specialty,experience=@experience,service_area=@workArea,work_status=@status,employee_type=@employeeType,job_grade=@jobGrade,base_salary=@baseSalary,uses_company_vehicle=@usesVehicle,start_date=@startDate,probation_start_date=@probationStart,probation_end_date=@probationEnd,updated_at=GETDATE() OUTPUT INSERTED.* WHERE id=@id`, { ...t, id: req.params.id });
        if (!result.recordset[0]) return res.status(404).json({ success: false, message: 'Không tìm thấy kỹ thuật viên.' }); return res.json({ success: true, technician: formatTechnician(result.recordset[0]) });
    } catch (error) { return next(error); }
});
router.delete('/technicians/:id', requireAdmin, async (req, res, next) => {
    try { const result = await require('../services/technicianDeletionService').removeOrDeactivate(req.params.id); if (result.notFound) return res.status(404).json({ success: false, message: 'Không tìm thấy kỹ thuật viên.' }); return res.json({ success: true, ...result, message: result.deactivated ? 'Kỹ thuật viên có dữ liệu lịch sử nên đã được chuyển sang Ngừng hoạt động.' : 'Đã xóa kỹ thuật viên.' }); } catch (error) { return next(error); }
});

router.get('/bookings/availability', async (req, res, next) => {
    try {
        const technicianId = req.query.technician_id || req.query.technicianId;
        const rawDate = req.query.appointment_date || req.query.appointmentDate;
        const appointmentTime = req.query.appointment_time || req.query.appointmentTime;
        const excludeBookingId = req.query.exclude_booking_id || req.query.excludeBookingId;
        const appointmentDate = normalizeAppointmentDate(rawDate);
        if (!technicianId || !rawDate) {
            return res.status(400).json({ success: false, message: 'Thiếu technician_id hoặc appointment_date.' });
        }
        if (!appointmentDate) {
            return res.status(400).json({ success: false, message: 'Ngày hẹn không hợp lệ. Vui lòng dùng định dạng YYYY-MM-DD.' });
        }

        const bookings = await getTechnicianBookings({ technicianId, appointmentDate, excludeBookingId });
        const availableSlots = calculateAvailableSlots(bookings);
        const publicBookings = bookings.map(booking => ({ id: booking.id, appointment_time: booking.appointment_time }));
        console.log('[booking availability] technician_id:', technicianId);
        console.log('[booking availability] appointment_date:', appointmentDate);
        console.log('[booking availability] booking count:', bookings.length);
        console.log('[booking availability] bookings:', publicBookings);
        console.log('[booking availability] available slot count:', availableSlots.length);

        const payload = {
            success: true,
            available: Boolean(availableSlots.length),
            bookings: publicBookings,
            availableSlots,
            slots: availableSlots
        };
        if (!appointmentTime) return res.json(payload);
        if (findConflictingBooking(bookings, appointmentTime)) {
            return res.status(409).json({ ...payload, success: false, available: false, message: CONFLICT_MESSAGE });
        }
        return res.json(payload);
    } catch (error) { return next(error); }
});

module.exports = router;
