const express = require('express');
const path = require('path');
const { query } = require('../config/database');
const { getRequestImageById } = require('../services/requestImageService');
const { isBlobEnabled, pipeBlob } = require('../services/blobStorageService');
const router = express.Router();

router.get('/:id', async (req, res, next) => {
    try {
        const image = await getRequestImageById(req.params.id);
        if (!image) return res.sendStatus(404);
        const isAdmin = req.session?.admin?.role === 'admin';
        const ownsBooking = image.request_type === 'booking' && req.session?.customer && (await query('SELECT id FROM bookings WHERE id = @requestId AND user_id = @userId', { requestId: image.request_id, userId: req.session.customer.id })).recordset.length;
        const ownsContact = image.request_type === 'contact' && req.session?.customer && (await query('SELECT id FROM contacts WHERE id = @requestId AND user_id = @userId', { requestId: image.request_id, userId: req.session.customer.id })).recordset.length;
        if (!isAdmin && !ownsBooking && !ownsContact) return res.sendStatus(403);
        if (isBlobEnabled()) {
            if (!await pipeBlob(`request-images/${image.filename}`, res)) return res.sendStatus(404);
            return;
        }
        res.type(image.mime_type);
        const directory = process.env.VERCEL ? path.join('/tmp', 'request-images') : path.resolve(__dirname, '../private/request-images');
        return res.sendFile(path.join(directory, image.filename));
    } catch (error) { return next(error); }
});
module.exports = router;
