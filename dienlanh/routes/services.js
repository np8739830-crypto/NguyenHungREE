const express = require('express');
const path = require('path');
const { createResourceController } = require('../controllers/resourceController');
const { query } = require('../config/database');

const router = express.Router();
const controller = createResourceController('services', [], { where: "status = 'active'", orderBy: 'sort_order ASC' });

router.get('/', (req, res) => res.sendFile(path.resolve(__dirname, '../../dienlanh- web/dich-vu.html')));
router.get('/api', controller.list);
router.get('/api/slug/:slug', async (req, res, next) => {
    try {
        const service = (await query("SELECT * FROM services WHERE slug = @slug AND status = 'active'", { slug: req.params.slug })).recordset[0];
        if (!service) return res.status(404).json({ error: 'Không tìm thấy dịch vụ.' });

        const [issues, process] = await Promise.all([
            query('SELECT issue_text FROM service_issues WHERE service_id = @serviceId ORDER BY sort_order ASC', { serviceId: service.id }),
            query('SELECT step_text FROM service_processes WHERE service_id = @serviceId ORDER BY step_order ASC', { serviceId: service.id })
        ]);

        return res.json({
            ...service,
            issues: issues.recordset.map(row => row.issue_text),
            process: process.recordset.map(row => row.step_text)
        });
    } catch (error) {
        return next(error);
    }
});
router.get('/api/:id', controller.detail);

module.exports = router;
