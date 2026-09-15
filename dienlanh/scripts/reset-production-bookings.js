'use strict';

require('dotenv').config({ override: true });
process.env.DATABASE_PROVIDER = 'd1';

const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');

async function main() {
    const bookings = (await query('SELECT * FROM bookings ORDER BY id')).recordset;
    const reviews = (await query('SELECT * FROM reviews WHERE booking_id IS NOT NULL ORDER BY id')).recordset;
    const images = (await query("SELECT * FROM request_images WHERE request_type='booking' OR booking_id IS NOT NULL ORDER BY id")).recordset;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.resolve(__dirname, `../../tmp/bookings-backup-${stamp}.json`);
    fs.writeFileSync(backupPath, JSON.stringify({ exported_at: new Date().toISOString(), bookings, reviews, images }, null, 2));

    await query('DELETE FROM reviews WHERE booking_id IS NOT NULL');
    await query("DELETE FROM request_images WHERE request_type='booking' OR booking_id IS NOT NULL");
    await query('DELETE FROM bookings');
    await query("DELETE FROM sqlite_sequence WHERE name='bookings'").catch(() => {});

    const remaining = Number((await query('SELECT COUNT(*) total FROM bookings')).recordset[0].total || 0);
    const remainingReviews = Number((await query('SELECT COUNT(*) total FROM reviews WHERE booking_id IS NOT NULL')).recordset[0].total || 0);
    console.log(`BACKUP=${backupPath}`);
    console.log(`DELETED_BOOKINGS=${bookings.length}`);
    console.log(`DELETED_REVIEWS=${reviews.length}`);
    console.log(`DELETED_IMAGES=${images.length}`);
    console.log(`REMAINING_BOOKINGS=${remaining}`);
    console.log(`REMAINING_BOOKING_REVIEWS=${remainingReviews}`);
    if (remaining !== 0 || remainingReviews !== 0) throw new Error('Booking reset verification failed');
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
