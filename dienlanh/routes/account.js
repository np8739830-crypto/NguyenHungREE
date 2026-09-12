const express = require('express');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { query } = require('../config/database');
const { getRequestImages } = require('../services/requestImageService');
const { persistMulterFile } = require('../services/blobStorageService');
const { requireAuth, csrfProtect } = require('../middleware/auth');

const router = express.Router();
const site = path.resolve(__dirname, '../../dienlanh- web');

const profileFields = 'id, name, email, phone, address, avatar, created_at';
const avatarStorage = process.env.VERCEL ? multer.memoryStorage() : multer.diskStorage({
    destination: path.resolve(__dirname, '../public/uploads'),
    filename: (req, file, callback) => callback(null, `avatar-${req.session.customer.id}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase()}`)
});
const uploadAvatar = multer({
    storage: avatarStorage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ok = /^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype);
        if (!ok) {
            return cb(new Error('Chỉ chấp nhận ảnh JPG, PNG, GIF hoặc WebP'));
        }
        cb(null, true);
    }
});

router.get('/profile', requireAuth, (req, res) => res.sendFile(path.join(site, 'ho-so.html')));
router.get('/bookings', requireAuth, (req, res) => res.sendFile(path.join(site, 'lich-su-dat-lich.html')));

router.get('/api/profile', requireAuth, async (req, res, next) => {
    try {
        const result = await query(`SELECT ${profileFields} FROM users WHERE id = @userId`, { userId: req.session.customer.id });
        const user = result.recordset[0];
        if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
        return res.json({ user });
    } catch (error) {
        return next(error);
    }
});

async function persistCustomerAvatar(req, res, next) {
    if (!req.file || !process.env.VERCEL) return next();
    const filename = `avatar-${req.session.customer.id}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(req.file.originalname).toLowerCase()}`;
    try {
        await persistMulterFile(req.file, filename);
        return next();
    } catch (error) {
        return next(error);
    }
}

router.put('/api/profile', requireAuth, uploadAvatar.single('avatar'), persistCustomerAvatar, async (req, res, next) => {
    try {
        const name = String(req.body.name || '').trim();
        const phone = String(req.body.phone || '').trim();
        const address = String(req.body.address || '').trim();

        if (!name) return res.status(400).json({ error: 'Vui lòng nhập họ và tên.' });
        if (!/^0(?:3|5|7|8|9)\d{8}$/.test(phone)) {
            return res.status(400).json({ error: 'Số điện thoại không hợp lệ.' });
        }
        if (name.length > 100 || address.length > 300) {
            return res.status(400).json({ error: 'Thông tin nhập vào vượt quá độ dài cho phép.' });
        }

        const result = await query(
            `UPDATE users
             SET name = @name, phone = @phone, address = @address,
                 avatar = COALESCE(@avatar, avatar), updated_at = GETDATE()
             OUTPUT INSERTED.id, INSERTED.name, INSERTED.email, INSERTED.phone,
                    INSERTED.address, INSERTED.avatar, INSERTED.created_at
             WHERE id = @userId`,
            { name, phone, address: address || null, avatar: req.file ? `/uploads/${req.file.filename}` : null, userId: req.session.customer.id }
        );
        const user = result.recordset[0];
        if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });

        req.session.customer.name = user.name;
        req.session.customer.avatar = user.avatar;
        return res.json({ message: 'Cập nhật thông tin thành công.', user });
    } catch (error) {
        return next(error);
    }
});

router.get('/api/bookings', requireAuth, csrfProtect, async (req, res, next) => {
    try {
        const result = await query(
            `SELECT b.id, b.request_code, b.booking_date, b.booking_time, b.device_type, b.service_type, 
                    s.name AS service_name, d.name AS device_name, b.status,
                    b.estimated_cost, b.actual_cost, b.created_at, b.technician_id,
                    t.full_name AS technician_name, r.id AS technician_review_id,
                    r.rating AS technician_review_rating, r.status AS technician_review_status
             FROM bookings b
             LEFT JOIN services s ON b.service_id = s.id OR b.service_type = s.name OR b.service_type = s.slug
                OR REPLACE(b.service_type, 'su-', 'sua-') = s.slug
             LEFT JOIN devices d ON b.device_id = d.id OR b.device_type = d.name OR b.device_type = d.slug
             LEFT JOIN technicians t ON t.id = b.technician_id
             LEFT JOIN reviews r ON r.booking_id = b.id
             WHERE b.user_id = @userId ORDER BY b.created_at DESC, b.id DESC`,
            { userId: req.session.customer.id }
        );
        return res.json({ bookings: result.recordset, csrfToken: res.locals.csrfToken });
    } catch (error) {
        return next(error);
    }
});

router.post('/api/bookings/:id/technician-review', requireAuth, csrfProtect, async (req, res, next) => {
    try {
        const ratings = ['rating', 'attitude_rating', 'punctuality_rating', 'technical_rating', 'explanation_rating', 'cleanliness_rating']
            .reduce((values, key) => ({ ...values, [key]: Number.parseInt(req.body[key], 10) }), {});
        const content = String(req.body.content || '').trim().slice(0, 2000);
        const invalidRating = Object.values(ratings).some(value => !Number.isInteger(value) || value < 1 || value > 5);
        if (invalidRating || content.length < 10) {
            return res.status(400).json({ error: 'Vui lòng chấm đủ các tiêu chí và nhập nhận xét ít nhất 10 ký tự.' });
        }

        const bookingResult = await query(`SELECT b.id, b.user_id, b.technician_id, b.status,
                b.service_id, COALESCE(s.name, b.service_type) AS service_name,
                u.name, COALESCE(u.email, u.phone) AS contact
            FROM bookings b
            JOIN users u ON u.id = b.user_id
            LEFT JOIN services s ON s.id = b.service_id
            WHERE b.id = @bookingId AND b.user_id = @userId`, {
            bookingId: req.params.id,
            userId: req.session.customer.id
        });
        const booking = bookingResult.recordset[0];
        if (!booking) return res.status(404).json({ error: 'Không tìm thấy lịch đặt thuộc tài khoản của bạn.' });
        if (booking.status !== 'completed') return res.status(400).json({ error: 'Chỉ có thể đánh giá đơn đã hoàn thành.' });
        if (!booking.technician_id) return res.status(400).json({ error: 'Đơn này chưa có kỹ thuật viên phụ trách.' });

        const duplicate = await query('SELECT id FROM reviews WHERE booking_id = @bookingId', { bookingId: booking.id });
        if (duplicate.recordset[0]) return res.status(409).json({ error: 'Bạn đã đánh giá kỹ thuật viên cho đơn này.' });

        await query(`INSERT INTO reviews
            (user_id, booking_id, technician_id, name, contact, service_id, service_name, rating,
             attitude_rating, punctuality_rating, technical_rating, explanation_rating,
             cleanliness_rating, is_recommended, content, status)
            VALUES (@userId, @bookingId, @technicianId, @name, @contact, @serviceId, @serviceName, @rating,
             @attitude, @punctuality, @technical, @explanation, @cleanliness, @recommended, @content, 'pending')`, {
            userId: req.session.customer.id,
            bookingId: booking.id,
            technicianId: booking.technician_id,
            name: booking.name,
            contact: booking.contact,
            serviceId: booking.service_id,
            serviceName: booking.service_name,
            rating: ratings.rating,
            attitude: ratings.attitude_rating,
            punctuality: ratings.punctuality_rating,
            technical: ratings.technical_rating,
            explanation: ratings.explanation_rating,
            cleanliness: ratings.cleanliness_rating,
            recommended: req.body.is_recommended === true || req.body.is_recommended === 'true' ? 1 : 0,
            content
        });
        return res.status(201).json({ message: 'Cảm ơn bạn. Đánh giá kỹ thuật viên đang chờ quản trị viên duyệt.' });
    } catch (error) {
        if (error.number === 2601 || error.number === 2627) {
            return res.status(409).json({ error: 'Bạn đã đánh giá kỹ thuật viên cho đơn này.' });
        }
        return next(error);
    }
});

router.get('/api/bookings/:id', requireAuth, async (req, res, next) => {
    try {
        const result = await query(
            `SELECT b.id, b.request_code, b.fullname, b.phone, b.email, b.address, b.device_type, b.service_type, 
                    s.name AS service_name, d.name AS device_name, b.booking_date,
                    b.booking_time, b.description, b.status, b.estimated_cost, b.actual_cost, b.created_at,
                    b.technician_id, t.full_name AS technician_name, t.specialty AS technician_specialty,
                    r.id AS technician_review_id, r.rating AS technician_review_rating, r.status AS technician_review_status
             FROM bookings b
             LEFT JOIN services s ON b.service_id = s.id OR b.service_type = s.name OR b.service_type = s.slug
                OR REPLACE(b.service_type, 'su-', 'sua-') = s.slug
             LEFT JOIN devices d ON b.device_id = d.id OR b.device_type = d.name OR b.device_type = d.slug
             LEFT JOIN technicians t ON t.id = b.technician_id
             LEFT JOIN reviews r ON r.booking_id = b.id
             WHERE b.id = @id AND b.user_id = @userId`,
            { id: req.params.id, userId: req.session.customer.id }
        );
        const booking = result.recordset[0];
        if (!booking) return res.status(404).json({ error: 'Không tìm thấy lịch đặt.' });
        booking.images = await getRequestImages('booking', booking.id);
        return res.json({ booking });
    } catch (error) {
        return next(error);
    }
});

router.get('/api/contacts', requireAuth, async (req, res, next) => {
    try {
        const result = await query(
            `SELECT id, request_code, name, phone, email, subject, message, status, created_at
             FROM dbo.contacts
             WHERE user_id = @userId
             ORDER BY created_at DESC, id DESC`,
            { userId: req.session.customer.id }
        );
        return res.json({ contacts: result.recordset });
    } catch (error) {
        return next(error);
    }
});

router.get('/api/contacts/:id', requireAuth, async (req, res, next) => {
    try {
        const result = await query(
            `SELECT id, request_code, name, phone, email, subject, message, status, created_at
             FROM dbo.contacts
             WHERE id = @id AND user_id = @userId`,
            { id: req.params.id, userId: req.session.customer.id }
        );
        const contact = result.recordset[0];
        if (!contact) return res.status(404).json({ error: 'Không tìm thấy liên hệ.' });
        contact.images = await getRequestImages('contact', contact.id);
        return res.json({ contact });
    } catch (error) {
        return next(error);
    }
});

router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                error: 'Ảnh đại diện không được vượt quá 2 MB.'
            });
        }
    }

    if (err) {
        return res.status(400).json({
            error: err.message
        });
    }

    next();
});

module.exports = router;
