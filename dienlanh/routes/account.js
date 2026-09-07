const express = require('express');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { query } = require('../config/database');
const { getRequestImages } = require('../services/requestImageService');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const site = path.resolve(__dirname, '../../dienlanh- web');

const profileFields = 'id, name, email, phone, address, avatar, created_at';
const avatarStorage = multer.diskStorage({
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

router.put('/api/profile', requireAuth, uploadAvatar.single('avatar'), async (req, res, next) => {
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

router.get('/api/bookings', requireAuth, async (req, res, next) => {
    try {
        const result = await query(
            `SELECT b.id, b.request_code, b.booking_date, b.booking_time, b.device_type, b.service_type, 
                    s.name AS service_name, d.name AS device_name, b.status,
                    b.estimated_cost, b.actual_cost, b.created_at
             FROM bookings b
             LEFT JOIN services s ON b.service_id = s.id OR b.service_type = s.name OR b.service_type = s.slug
                OR REPLACE(b.service_type, 'su-', 'sua-') = s.slug
             LEFT JOIN devices d ON b.device_id = d.id OR b.device_type = d.name OR b.device_type = d.slug
             WHERE b.user_id = @userId ORDER BY b.created_at DESC, b.id DESC`,
            { userId: req.session.customer.id }
        );
        return res.json({ bookings: result.recordset });
    } catch (error) {
        return next(error);
    }
});

router.get('/api/bookings/:id', requireAuth, async (req, res, next) => {
    try {
        const result = await query(
            `SELECT b.id, b.request_code, b.fullname, b.phone, b.email, b.address, b.device_type, b.service_type, 
                    s.name AS service_name, d.name AS device_name, b.booking_date,
                    b.booking_time, b.description, b.status, b.estimated_cost, b.actual_cost, b.created_at
             FROM bookings b
             LEFT JOIN services s ON b.service_id = s.id OR b.service_type = s.name OR b.service_type = s.slug
                OR REPLACE(b.service_type, 'su-', 'sua-') = s.slug
             LEFT JOIN devices d ON b.device_id = d.id OR b.device_type = d.name OR b.device_type = d.slug
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
