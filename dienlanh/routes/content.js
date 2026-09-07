const express = require('express');
const { query } = require('../config/database');

const router = express.Router();

// Public website content only. Customer, booking and account data deliberately
// remain behind their respective authenticated/admin routes.
router.get('/bootstrap', async (req, res, next) => {
    try {
        const [settings, pricing, faqs, timeline, brands, banners] = await Promise.all([
            query('SELECT [key], [value], group_name FROM settings ORDER BY group_name, [key]'),
            query(`SELECT p.id, p.category, p.item_name, p.description, p.price, p.sort_order,
                          s.id AS service_id, s.name AS service_name, s.slug AS service_slug, s.icon AS service_icon
                   FROM pricing p JOIN services s ON s.id = p.service_id
                   WHERE p.status = 'active' AND s.status = 'active'
                   ORDER BY s.sort_order, p.sort_order, p.id`),
            query("SELECT id, question, answer, sort_order FROM faqs WHERE status = 'active' ORDER BY sort_order, id"),
            query("SELECT id, year, title, description, icon, sort_order FROM timeline_events WHERE status = 'active' ORDER BY sort_order, id"),
            query("SELECT id, name, icon, image, sort_order FROM brands WHERE status = 'active' ORDER BY sort_order, id"),
            query("SELECT id, title, subtitle, image, link, sort_order FROM banners WHERE status = 'active' ORDER BY sort_order, id")
        ]);

        const siteSettings = Object.fromEntries(settings.recordset.map(item => [item.key, item.value]));
        return res.json({
            settings: siteSettings,
            pricing: pricing.recordset,
            faqs: faqs.recordset,
            timeline: timeline.recordset,
            brands: brands.recordset,
            banners: banners.recordset
        });
    } catch (error) {
        return next(error);
    }
});

module.exports = router;
