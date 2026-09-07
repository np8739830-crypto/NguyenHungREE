const express = require('express');
const path = require('path');
const { createResourceController } = require('../controllers/resourceController');
const { requireAuth } = require('../middleware/auth');
const { sendBookingNotification } = require('../services/telegramService');
const { query } = require('../config/database');
const { uploadRequestImages } = require('../services/requestImageService');
const { assertAvailableTechnician, createBookingAtomically } = require('../services/schedulingService');
const router = express.Router();
const controller = createResourceController(
    'bookings',
    ['user_id', 'technician_id', 'fullname', 'phone', 'email', 'address', 'device_type', 'service_type', 'service_id', 'device_id', 'booking_date', 'booking_time', 'description'],
    {
        requiredFields: ['fullname', 'phone', 'address', 'device_type', 'service_type', 'technician_id', 'booking_date', 'booking_time', 'description'],
        afterCreate: sendBookingNotification,
        includeRequestCode: true,
        imageRequestType: 'booking',
        createItem: createBookingAtomically
    }
);

async function createBooking(req, res, next) {
    const body = req.body || {};

    // A booking is always owned by the authenticated account. Never trust a
    // user_id submitted by the browser.
    req.body.user_id = req.session.customer.id;
    try {
        await assertAvailableTechnician({
            technicianId: req.body.technician_id,
            appointmentDate: req.body.booking_date,
            appointmentTime: req.body.booking_time
        });
        const [serviceResult, deviceResult] = await Promise.all([
            query(`SELECT TOP 1 id FROM dbo.services
                WHERE slug = @serviceType OR name = @serviceType
                    OR slug = REPLACE(@serviceType, 'su-', 'sua-')`, { serviceType: req.body.service_type }),
            query('SELECT TOP 1 id FROM dbo.devices WHERE slug = @deviceType OR name = @deviceType', { deviceType: req.body.device_type })
        ]);
        req.body.service_id = serviceResult.recordset[0]?.id || null;
        req.body.device_id = deviceResult.recordset[0]?.id || null;
    } catch (error) {
        if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
        return next(error);
    }
    return controller.create(req, res, next);
}

router.get('/', (req, res) => res.sendFile(path.resolve(__dirname, '../../dienlanh- web/dat-lich.html')));
router.post('/', requireAuth, (req, res, next) => uploadRequestImages(req, res, error => {
    if (error) return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Mỗi ảnh tối đa 5MB.' : error.message });
    return createBooking(req, res, next);
}));
// This endpoint is customer-facing, therefore it must never return another
// account's bookings. Administrative listing uses the separate admin routes.
router.get('/api', requireAuth, async (req, res, next) => {
    try {
        const result = await query(
            'SELECT * FROM bookings WHERE user_id = @userId ORDER BY created_at DESC, id DESC',
            { userId: req.session.customer.id }
        );
        return res.json(result.recordset);
    } catch (error) {
        return next(error);
    }
});
module.exports = router;
