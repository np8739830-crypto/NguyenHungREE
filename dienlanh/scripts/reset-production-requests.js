'use strict';

require('dotenv').config({ override: true });
process.env.DATABASE_PROVIDER = 'd1';

const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');
const { removeStoredImages } = require('../services/requestImageService');

async function rows(table) {
    return (await query(`SELECT * FROM ${table} ORDER BY id`)).recordset;
}

async function main() {
    const [bookings, contacts, reviews, images] = await Promise.all([
        rows('bookings'), rows('contacts'), rows('reviews'), rows('request_images')
    ]);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.resolve(__dirname, '../../tmp');
    const backupPath = path.join(backupDir, `customer-requests-backup-${stamp}.json`);
    fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(backupPath, JSON.stringify({
        exported_at: new Date().toISOString(), bookings, contacts, reviews, request_images: images
    }, null, 2));

    await query('DELETE FROM request_images');
    await query('DELETE FROM reviews');
    await query('DELETE FROM bookings');
    await query('DELETE FROM contacts');
    for (const table of ['request_images', 'reviews', 'bookings', 'contacts']) {
        await query(`DELETE FROM sqlite_sequence WHERE name='${table}'`).catch(() => {});
    }
    await removeStoredImages(images.map(image => image.filename).filter(Boolean));

    const remaining = {};
    for (const table of ['bookings', 'contacts', 'reviews', 'request_images']) {
        remaining[table] = Number((await query(`SELECT COUNT(*) total FROM ${table}`)).recordset[0]?.total || 0);
    }
    console.log(`BACKUP=${backupPath}`);
    console.log(`DELETED_BOOKINGS=${bookings.length}`);
    console.log(`DELETED_CONTACTS=${contacts.length}`);
    console.log(`DELETED_REVIEWS=${reviews.length}`);
    console.log(`DELETED_IMAGES=${images.length}`);
    console.log(`REMAINING=${JSON.stringify(remaining)}`);
    if (Object.values(remaining).some(Boolean)) throw new Error('Customer request reset verification failed');
}

main().catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
});
