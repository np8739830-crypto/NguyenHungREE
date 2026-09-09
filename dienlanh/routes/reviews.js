const express = require('express');
const { query } = require('../config/database');
const { csrfProtect } = require('../middleware/auth');

const router = express.Router();
const clean = (value, maxLength) => String(value || '').trim().slice(0, maxLength);

router.get('/meta', csrfProtect, async (req, res, next) => {
    try {
        const services = await query("SELECT id, name FROM services WHERE status = 'active' ORDER BY sort_order, name");
        return res.json({ csrfToken: res.locals.csrfToken, services: services.recordset });
    } catch (error) { return next(error); }
});

router.get('/', async (req, res, next) => {
    try {
        const result = await query(`SELECT r.id, r.name, r.rating, r.content, r.service_name, r.created_at,
                r.booking_id, u.avatar, t.full_name AS technician_name
            FROM reviews r LEFT JOIN users u ON u.id = r.user_id
            LEFT JOIN technicians t ON t.id = r.technician_id
            WHERE r.status = 'approved'
              AND r.technician_id IS NULL
              AND r.booking_id IS NULL
            ORDER BY r.created_at DESC, r.id DESC`);
        return res.json({ reviews: result.recordset });
    } catch (error) { return next(error); }
});

router.post('/', csrfProtect, async (req, res, next) => {
    try {
        const name = clean(req.body.name, 100);
        const contact = clean(req.body.contact, 150);
        const content = clean(req.body.content, 2000);
        const rating = Number.parseInt(req.body.rating, 10);
        const serviceId = req.body.service_id ? Number.parseInt(req.body.service_id, 10) : null;
        const validContact = /^(?:0(?:3|5|7|8|9)\d{8}|[^\s@]+@[^\s@]+\.[^\s@]+)$/i.test(contact);

        if (!name || !validContact || !content || !Number.isInteger(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Vui lòng nhập đầy đủ và đúng thông tin đánh giá.' });
        }
        if (req.session.lastReviewAt && Date.now() - req.session.lastReviewAt < 60_000) {
            return res.status(429).json({ error: 'Vui lòng đợi một phút trước khi gửi đánh giá tiếp theo.' });
        }

        let serviceName = null;
        let verifiedServiceId = null;
        if (Number.isInteger(serviceId) && serviceId > 0) {
            const service = (await query("SELECT id, name FROM services WHERE id = @id AND status = 'active'", { id: serviceId })).recordset[0];
            if (!service) return res.status(400).json({ error: 'Dịch vụ đã chọn không hợp lệ.' });
            verifiedServiceId = service.id;
            serviceName = service.name;
        }

        await query(`INSERT INTO reviews (user_id, name, contact, service_id, service_name, rating, content, status)
            VALUES (@userId, @name, @contact, @serviceId, @serviceName, @rating, @content, 'pending')`, {
            userId: req.session.customer?.id || null, name, contact, serviceId: verifiedServiceId,
            serviceName, rating, content
        });
        req.session.lastReviewAt = Date.now();
        return res.status(201).json({ message: 'Cảm ơn bạn! Đánh giá đã được gửi và đang chờ duyệt.' });
    } catch (error) { return next(error); }
});

module.exports = router;
