const express = require('express'); const path = require('path'); const { createResourceController } = require('../controllers/resourceController'); const { detailBySlug, detailPageBySlug } = require('../controllers/newsController');
const router = express.Router(); const controller = createResourceController('news', [], { where: "status = 'published'", orderBy: 'published_at DESC' });
router.get('/', (req, res) => res.sendFile(path.resolve(__dirname, '../../dienlanh- web/tin-tuc.html')));
router.get('/api', controller.list);
router.get('/api/slug/:slug', detailBySlug);
router.get('/api/:id', controller.detail);
router.get('/:slug', detailPageBySlug);
module.exports = router;
