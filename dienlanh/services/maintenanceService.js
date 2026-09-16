'use strict';

const database = require('../config/database');
const { cleanupRateLimits } = require('../middleware/security');
const { clearAlertCache } = require('./monitoringService');
const { getCurrentBookmark } = require('./d1RecoveryService');

async function cleanupDatabase() {
    const result = { sessions: 0, passwordResets: 0 };
    if (database.provider === 'd1') {
        const sessions = await database.requestD1('DELETE FROM app_sessions WHERE expires_at <= ?', [Date.now()]);
        result.sessions = Number(sessions.meta?.changes || 0);
    }
    try {
        const resets = await database.query(`DELETE FROM password_resets
            WHERE expires_at < DATEADD(DAY, -7, SYSUTCDATETIME())
               OR (used = 1 AND used_at < DATEADD(DAY, -7, SYSUTCDATETIME()))`);
        result.passwordResets = (resets.rowsAffected || []).reduce((sum, count) => sum + Number(count || 0), 0);
    } catch (error) {
        if (!/password_resets|Invalid object|no such table/i.test(error.message || '')) throw error;
    }
    return result;
}

async function runMaintenance() {
    const startedAt = Date.now();
    const dbHealthy = await database.testConnection();
    if (!dbHealthy) throw new Error('Database health check failed.');
    const cleanup = await cleanupDatabase();
    cleanup.rateLimits = cleanupRateLimits();
    cleanup.alertCache = clearAlertCache();
    const recovery = database.provider === 'd1' ? await getCurrentBookmark() : { mode: 'sql-server-external-backup-required' };
    return { ok: true, provider: database.provider, cleanup, recovery, durationMs: Date.now() - startedAt };
}

module.exports = { cleanupDatabase, runMaintenance };
