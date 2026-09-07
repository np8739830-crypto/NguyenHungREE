const fs = require('fs');
const path = require('path');
const { getConnection } = require('../config/database');

async function runReviewMigration() {
    const sql = fs.readFileSync(path.join(__dirname, '../migrations/20260817_real_reviews.sql'), 'utf8');
    const connection = await getConnection();
    for (const batch of sql.split(/^\s*GO\s*$/gim).map(value => value.trim()).filter(Boolean)) {
        await connection.request().batch(batch);
    }
}

module.exports = { runReviewMigration };

