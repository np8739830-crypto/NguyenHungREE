'use strict';

require('dotenv').config({ override: true });
const { restoreToPoint } = require('../services/d1RecoveryService');

async function main() {
    const value = process.argv[2];
    const mode = process.argv[3] === '--bookmark' ? 'bookmark' : 'timestamp';
    if (!value) throw new Error('Usage: npm run db:restore -- <ISO timestamp|bookmark> [--bookmark]');
    if (process.env.RESTORE_CONFIRM !== 'RESTORE_D1_PRODUCTION') {
        throw new Error('Set RESTORE_CONFIRM=RESTORE_D1_PRODUCTION only after verifying the restore point.');
    }
    const result = await restoreToPoint({ [mode]: value, confirmation: process.env.RESTORE_CONFIRM });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});
