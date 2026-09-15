'use strict';
require('dotenv').config({ override: true });
process.env.DATABASE_PROVIDER = 'd1';
const { query } = require('../config/database');

(async () => {
    const checks = [
        ['bookings', 'SELECT COUNT(*) total FROM bookings'],
        ['booking_images', "SELECT COUNT(*) total FROM request_images WHERE request_type='booking' OR booking_id IS NOT NULL"],
        ['booking_reviews', 'SELECT COUNT(*) total FROM reviews WHERE booking_id IS NOT NULL']
    ];
    for (const [name, statement] of checks) {
        try {
            const result = await query(statement);
            console.log(`${name}=${Number(result.recordset[0].total || 0)}`);
        } catch (error) {
            console.log(`${name}=UNAVAILABLE ${error.message}`);
        }
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
