const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { getRequestImages } = require('../services/requestImageService');
const { hasBookingConflict, normalizeAppointmentDate, CONFLICT_MESSAGE } = require('../services/schedulingService');
const { syncRevenueForBookingChange } = require('../services/payrollService');

const bookingServiceSlug = `CONCAT(
    CASE
        WHEN b.service_type IN (N'Sửa chữa', 'sua-chua', 'su-chua') THEN 'sua'
        WHEN b.service_type IN (N'Vệ sinh', 've-sinh') THEN 've-sinh'
        WHEN b.service_type IN (N'Lắp đặt', 'lap-dat') THEN 'lap-dat'
    END,
    '-',
    COALESCE(
        (SELECT TOP 1 booking_device.slug
         FROM dbo.devices booking_device
         WHERE booking_device.id = b.device_id
            OR booking_device.slug = b.device_type
            OR booking_device.name = b.device_type),
        b.device_type
    )
)`;
const serviceJoinCondition = `b.service_id = s.id OR b.service_type = s.name OR b.service_type = s.slug
    OR REPLACE(b.service_type, 'su-', 'sua-') = s.slug
    OR ${bookingServiceSlug} = s.slug`;
const deviceJoinCondition = `b.device_id = d.id OR b.device_type = d.name OR b.device_type = d.slug`;

function prepareBookingDisplay(booking) {
    // Older bookings may contain a service/device value that no longer matches
    // a row in the reference tables. Keep that submitted value visible instead
    // of replacing it with NULL and showing "Chưa xác định" in the admin UI.
    const serviceName = booking.service_name || booking.service_type || null;
    const deviceName = booking.device_name || booking.device_type || null;
    return {
        ...booking,
        service_name: serviceName,
        device_name: deviceName,
        service_display_name: [serviceName, deviceName].filter(Boolean).join(' – ') || '—'
    };
}

async function dashboard(req, res, next) {
    try {
        const [summaryResult, servicesResult, bookingsResult] = await Promise.all([
            query(`
            SELECT
                (SELECT COUNT(*) FROM bookings) AS totalBookings,
                (SELECT COUNT(*) FROM bookings WHERE status = 'pending') AS pendingBookings,
                (SELECT COUNT(*) FROM bookings WHERE status = 'in_progress') AS activeBookings,
                (SELECT COUNT(*) FROM bookings WHERE status = 'completed') AS completedBookings,
                (SELECT COUNT(*) FROM users WHERE created_at >= DATEADD(day, -30, GETDATE())) AS newCustomers
            `),
            query(`SELECT s.id, s.name, s.slug, s.image, s.icon, s.price_range, s.status,
                COUNT(b.id) AS booking_count
                FROM services s
                LEFT JOIN bookings b ON ${serviceJoinCondition}
                GROUP BY s.id, s.name, s.slug, s.image, s.icon, s.price_range, s.status
                ORDER BY COUNT(b.id) DESC, s.id ASC`),
            query(`SELECT TOP 5 b.id, b.fullname, b.phone, b.service_type, b.device_type, b.booking_date, b.booking_time, b.created_at, b.status,
                s.name AS service_name, d.name AS device_name
                FROM bookings b
                LEFT JOIN services s ON ${serviceJoinCondition}
                LEFT JOIN devices d ON ${deviceJoinCondition}
                ORDER BY b.created_at DESC`)
        ]);

        return res.render('dashboard', {
            title: 'Bảng điều khiển - NGUYỄN HÙNG',
            dashboard: summaryResult.recordset[0],
            recentServices: servicesResult.recordset,
            recentBookings: bookingsResult.recordset.map(prepareBookingDisplay)
        });
    } catch (error) {
        return next(error);
    }
}

const adminViews = {
    products: { view: 'sanpham.html', title: 'Sản phẩm' },
    orders: { view: 'banhang.html', title: 'Đơn hàng' },
    customers: { view: 'customers.ejs', title: 'Khách hàng' },
    settings: { view: 'cauhinh.html', title: 'Cấu hình' },
    contacts: { view: 'contacts.ejs', title: 'Liên hệ' },
    staff: { view: 'technicians.ejs', title: 'Kỹ thuật viên' }
};

function page(page) {
    return async(req, res, next) => {
        const target = adminViews[page];
        if (!target) return next();

        const base = { title: `${target.title} - NGUYỄN HÙNG`, activePage: page };

        try {
            if (page === 'customers') {
                const customers = (await query("SELECT id, name, email, phone, status, created_at FROM users WHERE role = 'user' ORDER BY created_at DESC")).recordset;
                return res.render(target.view, {...base, customers });
            }
            if (page === 'contacts') {
                const contacts = (await query('SELECT id, request_code, name, phone, email, subject, status, created_at FROM contacts ORDER BY created_at DESC')).recordset;
                const images = await getRequestImages('contact');
                const imagesByContact = new Map();
                images.forEach(image => imagesByContact.set(image.request_id, [...(imagesByContact.get(image.request_id) || []), image]));
                contacts.forEach(contact => { contact.images = imagesByContact.get(contact.id) || []; });
                return res.render(target.view, {...base, contacts });
            }
            return res.render(target.view, base);
        } catch (error) {
            return next(error);
        }
    };
}

async function technicians(req, res, next) {
    try {
        const technicians = (await query("SELECT * FROM dbo.technicians WHERE work_status <> 'inactive' ORDER BY work_status ASC, full_name ASC")).recordset;
        return res.render('technicians', { title: 'Kỹ thuật viên - NGUYỄN HÙNG', activePage: 'technicians', technicians });
    } catch (error) {
        return next(error);
    }
}

async function createTechnician(req, res, next) {
    try {
        const {
            full_name,
            phone,
            email,
            avatar,
            specialty,
            experience,
            service_area,
            work_status,
            employee_type, job_grade, base_salary, uses_company_vehicle,
            start_date, probation_start_date, probation_end_date
        } = req.body;

        // Kiểm tra dữ liệu bắt buộc
        if (!full_name?.trim() || !phone?.trim()) {
            req.flash('error', 'Họ tên và số điện thoại là bắt buộc');
            return res.redirect('/admin/technicians');
        }

        // Chuẩn hóa trạng thái làm việc
        const validStatuses = ['available', 'busy', 'leave', 'inactive'];

        const finalWorkStatus = validStatuses.includes(work_status) ?
            work_status :
            'available';

        // Thêm kỹ thuật viên vào cơ sở dữ liệu
        await query(
            `INSERT INTO dbo.technicians
        (
            full_name,
            phone,
            email,
            avatar,
            specialty,
            experience,
            service_area,
            work_status, employee_type, job_grade, base_salary, uses_company_vehicle,
            start_date, probation_start_date, probation_end_date
        )
        VALUES
        (
            @fullName,
            @phone,
            @email,
            @avatar,
            @specialty,
            @experience,
            @serviceArea,
            @workStatus, @employeeType, @jobGrade, @baseSalary, @usesVehicle,
            @startDate, @probationStart, @probationEnd
        )`, {
                fullName: full_name.trim(),
                phone: phone.trim(),
                email: email ?.trim() || null,
                avatar: avatar ?.trim() || null,
                specialty: specialty ?.trim() || null,
                experience: experience ?.trim() || null,
                serviceArea: service_area ?.trim() || null,
                workStatus: finalWorkStatus,
                employeeType: employee_type === 'probation' ? 'probation' : 'official',
                jobGrade: job_grade === 'technician' ? 'technician' : 'assistant',
                baseSalary: Math.max(0, Number(base_salary) || 5000000),
                usesVehicle: uses_company_vehicle === '1' ? 1 : 0,
                startDate: start_date || null,
                probationStart: probation_start_date || null,
                probationEnd: probation_end_date || null
            }
        );

        req.flash('success', 'Đã thêm kỹ thuật viên');
        return res.redirect('/admin/technicians');

    } catch (error) {
        return next(error);
    }
}

async function deleteTechnician(req, res, next) {
    try {
        const result = await require('../services/technicianDeletionService').removeOrDeactivate(req.params.id);
        if (result.notFound) req.flash('error', 'Không tìm thấy kỹ thuật viên');
        else if (result.deactivated) req.flash('success', 'Kỹ thuật viên có dữ liệu chấm công/lương liên quan nên đã được chuyển sang Ngừng hoạt động. Dữ liệu lịch sử vẫn được giữ nguyên.');
        else req.flash('success', 'Đã xóa kỹ thuật viên chưa phát sinh dữ liệu');
        return res.redirect('/admin/technicians');
    } catch (error) {
        console.error('Delete technician:', error);
        req.flash('error', 'Không thể xóa kỹ thuật viên lúc này. Dữ liệu liên quan vẫn được giữ nguyên.');
        return res.redirect('/admin/technicians');
    }
}

async function updateTechnician(req, res, next) {
    try {
        const status = ['available', 'busy', 'leave', 'inactive'].includes(req.body.work_status) ? req.body.work_status : 'available';
        await query(`UPDATE dbo.technicians SET full_name=@fullName, phone=@phone, email=@email, avatar=COALESCE(@avatar, avatar), specialty=@specialty, experience=@experience, service_area=@serviceArea, work_status=@workStatus, employee_type=@employeeType,job_grade=@jobGrade,base_salary=@baseSalary,uses_company_vehicle=@usesVehicle,start_date=@startDate,probation_start_date=@probationStart,probation_end_date=@probationEnd, updated_at=GETDATE() WHERE id=@id`, {
            id: req.params.id,
            fullName: req.body.full_name ?.trim(),
            phone: req.body.phone ?.trim(),
            email: req.body.email ?.trim() || null,
            avatar: req.file ? `/uploads/${req.file.filename}` : null,
            specialty: req.body.specialty ?.trim() || null,
            experience: req.body.experience ?.trim() || null,
            serviceArea: req.body.service_area ?.trim() || null,
            workStatus: status,
            employeeType: req.body.employee_type === 'probation' ? 'probation' : 'official',
            jobGrade: req.body.job_grade === 'technician' ? 'technician' : 'assistant',
            baseSalary: Math.max(0, Number(req.body.base_salary) || 5000000),
            usesVehicle: req.body.uses_company_vehicle === '1' ? 1 : 0,
            startDate: req.body.start_date || null,
            probationStart: req.body.probation_start_date || null,
            probationEnd: req.body.probation_end_date || null
        });
        req.flash('success', 'Đã cập nhật kỹ thuật viên');
        return res.redirect('/admin/technicians');
    } catch (error) { return next(error); }
}

async function bookings(req, res, next) {
    try {
        const status = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'].includes(req.query.status) ? req.query.status : null;
        const search = String(req.query.search || '').trim().slice(0, 100);
        const period = ['today', '7days', '30days'].includes(req.query.period) ? req.query.period : null;
        const params = { status, search: search ? `%${search}%` : null, period };
        const [bookingsResult, techniciansResult, servicesResult, summaryResult] = await Promise.all([
            query(`SELECT b.*, t.full_name AS technician_name, s.name AS service_name, d.name AS device_name,
                    CASE WHEN b.created_at >= DATEADD(HOUR, -24, GETDATE()) THEN 1 ELSE 0 END AS is_new
                FROM bookings b
                LEFT JOIN dbo.technicians t ON t.id = b.technician_id
                LEFT JOIN services s ON ${serviceJoinCondition}
                LEFT JOIN devices d ON ${deviceJoinCondition}
                WHERE (@status IS NULL OR b.status = @status)
                  AND (@search IS NULL OR b.request_code LIKE @search OR b.fullname LIKE @search OR b.phone LIKE @search OR b.email LIKE @search OR b.address LIKE @search)
                  AND (@period IS NULL
                    OR (@period = 'today' AND CAST(b.created_at AS date) = CAST(GETDATE() AS date))
                    OR (@period = '7days' AND b.created_at >= DATEADD(DAY, -7, GETDATE()))
                    OR (@period = '30days' AND b.created_at >= DATEADD(DAY, -30, GETDATE())))
                ORDER BY b.created_at DESC, b.id DESC`, params),
            query("SELECT id, full_name, specialty, work_status FROM dbo.technicians WHERE work_status IN ('available', 'busy') ORDER BY full_name"),
            query("SELECT name FROM services WHERE status = 'active' ORDER BY sort_order, name"),
            query(`SELECT COUNT(*) AS total,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
                    SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
                FROM dbo.bookings`)
        ]);
        const images = await getRequestImages('booking');
        const imagesByBooking = new Map();
        images.forEach(image => imagesByBooking.set(image.request_id, [...(imagesByBooking.get(image.request_id) || []), image]));
        bookingsResult.recordset.forEach(booking => {
            const display = prepareBookingDisplay(booking);
            Object.assign(booking, display, {
                service_type: display.service_name,
                device_type: display.device_name,
                scheduled_date_input: normalizeAppointmentDate(booking.scheduled_date || booking.booking_date) || ''
            });
            booking.images = imagesByBooking.get(booking.id) || [];
        });
        return res.render('bookings', {
            title: 'Lịch đặt dịch vụ - NGUYỄN HÙNG',
            bookings: bookingsResult.recordset,
            technicians: techniciansResult.recordset,
            services: servicesResult.recordset,
            bookingSummary: summaryResult.recordset[0],
            selectedStatus: status,
            selectedPeriod: period,
            searchTerm: search
        });
    } catch (error) { return next(error); }
}

async function updateBooking(req, res, next) {
    try {
        const validStatuses = [
            'pending',
            'confirmed',
            'in_progress',
            'completed',
            'cancelled'
        ];

        const status = String(req.body.status || '').trim();
        console.log('[admin booking update] req.body date values:', {
            bookingId: req.params.id,
            scheduled_date: req.body.scheduled_date,
            scheduled_time: req.body.scheduled_time
        });

        // Kiểm tra trạng thái
        if (!validStatuses.includes(status)) {
            req.flash('error', 'Trạng thái lịch không hợp lệ');
            return res.redirect('/admin/bookings');
        }

        // Lấy thông tin lịch hiện tại
        const existingResult = await query(`
            SELECT
                id,
                technician_id,
                booking_date,
                booking_time,
                scheduled_date,
                scheduled_time,
                status,
                estimated_cost,
                actual_cost,
                completed_at
            FROM bookings
            WHERE id = @id
        `, {
            id: req.params.id
        });

        const existing = existingResult.recordset[0];

        if (!existing) {
            req.flash('error', 'Không tìm thấy lịch đặt');
            return res.redirect('/admin/bookings');
        }

        // Kỹ thuật viên
        const technicianId =
            req.body.technician_id !== undefined &&
            req.body.technician_id !== ''
                ? Number(req.body.technician_id)
                : existing.technician_id || null;

        // Ngày thực hiện
        const submittedDate = String(req.body.scheduled_date || '').trim();
        const scheduledDateSource = submittedDate || existing.scheduled_date || existing.booking_date || null;
        const scheduledDate = scheduledDateSource ? normalizeAppointmentDate(scheduledDateSource) : null;
        if (scheduledDateSource && !scheduledDate) {
            req.flash('error', 'Ngày thực hiện không hợp lệ. Vui lòng chọn lại ngày.');
            return res.redirect('/admin/bookings');
        }

        // Giờ thực hiện
        const scheduledTime =
            req.body.scheduled_time?.trim()
                ? req.body.scheduled_time.trim()
                : existing.scheduled_time ||
                  existing.booking_time ||
                  null;

        const workNote =
            req.body.work_note?.trim()
                ? req.body.work_note.trim()
                : null;

        const estimatedCost =
            req.body.estimated_cost !== undefined &&
            req.body.estimated_cost !== ''
                ? Number(req.body.estimated_cost)
                : null;

        const hasActualCost = req.body.actual_cost !== undefined && req.body.actual_cost !== '';
        const submittedActualCost = hasActualCost ? Number(req.body.actual_cost) : null;
        const estimatedCostChanged = estimatedCost !== null && Number(existing.estimated_cost) !== estimatedCost;
        const actualCostChanged = hasActualCost && Number(existing.actual_cost) !== submittedActualCost;
        const actualCost = status === 'completed'
            ? actualCostChanged
                ? submittedActualCost
                : estimatedCostChanged
                    ? estimatedCost
                    : existing.actual_cost ?? estimatedCost ?? existing.estimated_cost ?? null
            : hasActualCost
                ? submittedActualCost
                : existing.actual_cost ?? null;

        if ((estimatedCost !== null && (!Number.isFinite(estimatedCost) || estimatedCost < 0)) ||
            (actualCost !== null && (!Number.isFinite(actualCost) || actualCost < 0))) {
            req.flash('error', 'Chi phí dịch vụ không hợp lệ.');
            return res.redirect('/admin/bookings');
        }

        // Kiểm tra trùng lịch kỹ thuật viên
        if (
            technicianId &&
            scheduledDate &&
            scheduledTime &&
            status !== 'cancelled'
        ) {
            const conflict = await hasBookingConflict({
                technicianId,
                appointmentDate: scheduledDate,
                appointmentTime: scheduledTime,
                excludeBookingId: req.params.id
            });

            if (conflict) {
                req.flash('error', CONFLICT_MESSAGE);
                return res.redirect('/admin/bookings');
            }
        }

        // CẬP NHẬT DATABASE
        const result = await query(`
            UPDATE bookings
            SET
                status = @status,
                technician_id = @technicianId,
                scheduled_date = @scheduledDate,
                scheduled_time = @scheduledTime,

                booking_date =
                    COALESCE(@scheduledDate, booking_date),

                booking_time =
                    COALESCE(@scheduledTime, booking_time),

                work_note = @workNote,
                estimated_cost = @estimatedCost,
                actual_cost = @actualCost,

                assigned_at =
                    CASE
                        WHEN @technicianId IS NOT NULL
                        THEN GETDATE()
                        ELSE assigned_at
                    END,

                completed_at =
                    CASE
                        WHEN @status = 'completed' AND status <> 'completed'
                        THEN GETDATE()
                        ELSE completed_at
                    END,

                updated_at = GETDATE()

            OUTPUT INSERTED.id,INSERTED.status,INSERTED.technician_id,
                INSERTED.scheduled_date,INSERTED.booking_date,INSERTED.completed_at,
                INSERTED.estimated_cost,INSERTED.actual_cost
            WHERE id = @id
        `, {
            id: req.params.id,
            status,
            technicianId,
            scheduledDate,
            scheduledTime,
            workNote,
            estimatedCost,
            actualCost
        });

        if (!result.rowsAffected || result.rowsAffected[0] === 0) {
            req.flash('error', 'Không cập nhật được lịch đặt');
            return res.redirect('/admin/bookings');
        }

        const updatedBooking = result.recordset?.[0] || {
            ...existing,
            status,
            technician_id: technicianId,
            scheduled_date: scheduledDate,
            booking_date: scheduledDate || existing.booking_date,
            estimated_cost: estimatedCost,
            actual_cost: actualCost
        };
        await syncRevenueForBookingChange(existing, updatedBooking, req.adminAuthorization?.id);

        req.flash(
            'success',
            `Đã cập nhật trạng thái lịch LD-${req.params.id}`
        );

        return res.redirect('/admin/bookings');

    } catch (error) {
        console.error('Lỗi cập nhật booking:', error);
        return next(error);
    }
}

async function services(req, res, next) {
    try {
        const result = await query('SELECT * FROM services ORDER BY sort_order ASC, id ASC');
        return res.render('services', { title: 'Quản lý dịch vụ - NGUYỄN HÙNG', services: result.recordset });
    } catch (error) {
        return next(error);
    }
}

function normalizeServiceInput(body) {
    return {
        name: String(body.name || '').trim(),
        slug: String(body.slug || '').trim().toLowerCase(),
        icon: String(body.icon || '').trim() || null,
        description: String(body.description || '').trim(),
        fullDescription: String(body.full_description || '').trim() || null,
        image: null,
        priceRange: String(body.price_range || '').trim() || null,
        sortOrder: Math.max(0, Number.parseInt(body.sort_order, 10) || 0),
        status: body.status === 'inactive' ? 'inactive' : 'active'
    };
}

function validateService(data) {
    if (!data.name || !data.slug || !data.description) return 'Vui lòng nhập đầy đủ các trường bắt buộc';
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)) return 'Slug chỉ được dùng chữ thường, số và dấu gạch ngang';
    return null;
}

async function createService(req, res, next) {
    try {
        const data = normalizeServiceInput(req.body);
        data.image = req.file ? `/uploads/${req.file.filename}` : null;
        const validationError = validateService(data);
        if (validationError) {
            req.flash('error', validationError);
            return res.redirect('/admin/products');
        }
        const duplicate = (await query('SELECT id FROM services WHERE slug = @slug', { slug: data.slug })).recordset[0];
        if (duplicate) {
            req.flash('error', 'Slug này đã tồn tại');
            return res.redirect('/admin/products');
        }
        await query(`INSERT INTO services (name, slug, icon, description, full_description, image, price_range, sort_order, status)
            VALUES (@name, @slug, @icon, @description, @fullDescription, @image, @priceRange, @sortOrder, @status)`, data);
        req.flash('success', 'Đã thêm dịch vụ');
        return res.redirect('/admin/products');
    } catch (error) {
        return next(error);
    }
}

async function updateService(req, res, next) {
    try {
        const data = normalizeServiceInput(req.body);
        const validationError = validateService(data);
        if (validationError) {
            req.flash('error', validationError);
            return res.redirect('/admin/products');
        }
        const existing = (await query('SELECT id, image FROM services WHERE id = @id', { id: req.params.id })).recordset[0];
        if (!existing) {
            req.flash('error', 'Không tìm thấy dịch vụ');
            return res.redirect('/admin/products');
        }
        data.image = req.file ? `/uploads/${req.file.filename}` : existing.image;
        const duplicate = (await query('SELECT id FROM services WHERE slug = @slug AND id <> @id', { slug: data.slug, id: req.params.id })).recordset[0];
        if (duplicate) {
            req.flash('error', 'Slug này đã tồn tại');
            return res.redirect('/admin/products');
        }
        await query(`UPDATE services SET name = @name, slug = @slug, icon = @icon, description = @description,
            full_description = @fullDescription, image = @image, price_range = @priceRange, sort_order = @sortOrder,
            status = @status, updated_at = GETDATE() WHERE id = @id`, {...data, id: req.params.id });
        req.flash('success', 'Đã cập nhật dịch vụ');
        return res.redirect('/admin/products');
    } catch (error) {
        return next(error);
    }
}

async function deleteService(req, res, next) {
    try {
        const result = await query('DELETE FROM services WHERE id = @id', { id: req.params.id });
        req.flash(result.rowsAffected[0] ? 'success' : 'error', result.rowsAffected[0] ? 'Đã xóa dịch vụ' : 'Không tìm thấy dịch vụ');
        return res.redirect('/admin/products');
    } catch (error) {
        return next(error);
    }
}

async function account(req, res, next) {
    try {
        const user = (await query(
            'SELECT id, name, email, phone, avatar FROM users WHERE id = @id', { id: req.session.admin.id }
        )).recordset[0];

        if (!user) {
            delete req.session.admin;
            return res.redirect('/admin/login');
        }

        return res.render('account', { title: 'Thông tin tài khoản', account: user });
    } catch (error) {
        return next(error);
    }
}

async function updateAccount(req, res, next) {
    try {
        const userId = req.session.admin.id;
        const { name, email, phone, currentPassword, newPassword, confirmPassword } = req.body;
        if (!name ?.trim() || !email ?.trim() || !phone ?.trim()) {
            req.flash('error', 'Họ tên, email và số điện thoại là bắt buộc');
            return res.redirect('/admin/account');
        }

        const user = (await query('SELECT * FROM users WHERE id = @id', { id: userId })).recordset[0];
        if (!user) {
            delete req.session.admin;
            req.flash('error', 'Tài khoản không còn tồn tại. Vui lòng đăng nhập lại');
            return res.redirect('/admin/login');
        }

        const duplicate = (await query(
            'SELECT id FROM users WHERE (email = @email OR phone = @phone) AND id <> @id', { email: email.trim(), phone: phone.trim(), id: userId }
        )).recordset[0];
        if (duplicate) {
            req.flash('error', 'Email hoặc số điện thoại đã được sử dụng');
            return res.redirect('/admin/account');
        }

        let passwordHash = null;
        if (currentPassword || newPassword || confirmPassword) {
            if (!currentPassword || !newPassword || !confirmPassword) {
                req.flash('error', 'Vui lòng nhập đầy đủ thông tin đổi mật khẩu');
                return res.redirect('/admin/account');
            }
            if (!await bcrypt.compare(currentPassword, user.password_hash)) {
                req.flash('error', 'Mật khẩu hiện tại không đúng');
                return res.redirect('/admin/account');
            }
            if (newPassword.length < 6) {
                req.flash('error', 'Mật khẩu mới phải có ít nhất 6 ký tự');
                return res.redirect('/admin/account');
            }
            if (newPassword !== confirmPassword) {
                req.flash('error', 'Xác nhận mật khẩu mới không khớp');
                return res.redirect('/admin/account');
            }
            passwordHash = await bcrypt.hash(newPassword, 10);
        }

        const avatar = req.file ? `/uploads/${req.file.filename}` : null;
        await query(`
            UPDATE users
            SET name = @name,
                email = @email,
                phone = @phone,
                avatar = COALESCE(@avatar, avatar),
                password_hash = COALESCE(@passwordHash, password_hash),
                updated_at = GETDATE()
            WHERE id = @id
        `, {
            id: userId,
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim(),
            avatar,
            passwordHash
        });

        req.session.admin = {...req.session.admin, name: name.trim(), email: email.trim() };
        req.flash('success', 'Cập nhật thông tin tài khoản thành công');
        return res.redirect('/admin/account');
    } catch (error) {
        return next(error);
    }
}

module.exports = { dashboard, page, bookings, updateBooking, services, createService, updateService, deleteService, account, updateAccount, technicians, createTechnician, updateTechnician, deleteTechnician };
