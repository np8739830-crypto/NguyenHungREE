const express = require('express'); const path = require('path'); const { createResourceController } = require('../controllers/resourceController'); const { requireAuth } = require('../middleware/auth'); const { sendContactNotification } = require('../services/telegramService'); const { uploadRequestImages } = require('../services/requestImageService');
const router = express.Router(); const controller = createResourceController('contacts', ['user_id', 'name', 'phone', 'email', 'subject', 'message'], { requiredFields: ['name', 'phone', 'message'], afterCreate: sendContactNotification, includeRequestCode: true, imageRequestType: 'contact' });
router.get('/', (req, res) => res.sendFile(path.resolve(__dirname, '../../dienlanh- web/lien-he.html'))); router.post('/', requireAuth, (req, res, next) => uploadRequestImages(req, res, error => {
    if (error) return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Mỗi ảnh tối đa 5MB.' : error.message });
    req.body.user_id = req.session.customer.id;
    return controller.create(req, res, next);
})); router.get('/api', requireAuth, (req, res) => res.redirect(307, '/account/api/contacts'));
module.exports = router;
