'use strict';

const express = require('express');
const crypto = require('crypto');
const database = require('../config/database');
const { runMaintenance } = require('../services/maintenanceService');
const { alertSystem } = require('../services/monitoringService');
const { sendTelegramMessage } = require('../services/telegramService');

const router = express.Router();

function validSecret(req) {
    const expected = Buffer.from(String(process.env.CRON_SECRET || ''));
    const supplied = Buffer.from(String(req.get('authorization') || '').replace(/^Bearer\s+/i, ''));
    return expected.length >= 24 && expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
}

router.get('/health', async (req, res) => {
    const startedAt = Date.now();
    const databaseOk = await database.testConnection();
    return res.status(databaseOk ? 200 : 503).json({
        ok: databaseOk,
        database: databaseOk ? 'up' : 'down',
        provider: database.provider,
        uptimeSeconds: Math.round(process.uptime()),
        responseMs: Date.now() - startedAt,
        timestamp: new Date().toISOString()
    });
});

router.get('/maintenance', async (req, res) => {
    if (!validSecret(req)) return res.sendStatus(404);
    try {
        const result = await runMaintenance();
        await sendTelegramMessage([
            '✅ <b>Bảo trì website thành công</b>',
            `<b>Database:</b> ${result.provider}`,
            `<b>Session đã dọn:</b> ${result.cleanup.sessions}`,
            `<b>OTP đã dọn:</b> ${result.cleanup.passwordResets}`,
            `<b>Khôi phục D1:</b> Time Travel đang hoạt động`,
            `<b>Thời gian:</b> ${result.durationMs} ms`
        ].join('\n'));
        return res.json({ ...result, recovery: { available: Boolean(result.recovery?.bookmark || result.recovery?.mode) } });
    } catch (error) {
        await alertSystem('Bảo trì/backup thất bại', error, { path: req.path, method: req.method, requestId: req.requestId });
        return res.status(500).json({ ok: false, requestId: req.requestId });
    }
});

module.exports = router;
