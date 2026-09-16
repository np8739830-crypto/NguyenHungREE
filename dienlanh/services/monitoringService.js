'use strict';

const os = require('os');
const { sendTelegramAlert } = require('./telegramService');

const recentAlerts = new Map();
const ALERT_COOLDOWN_MS = 5 * 60 * 1000;

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function safeError(error) {
    const message = String(error?.message || error || 'Unknown error')
        .replace(/(token|secret|password|authorization)=?\s*[^\s,;]+/gi, '$1=[REDACTED]')
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
        .replace(/\b0(?:3|5|7|8|9)\d{8}\b/g, '[REDACTED_PHONE]');
    return message.slice(0, 800);
}

async function alertSystem(type, error, context = {}) {
    if (process.env.NODE_ENV === 'test') return false;
    const fingerprint = `${type}:${safeError(error).slice(0, 180)}:${context.path || ''}`;
    const now = Date.now();
    if ((recentAlerts.get(fingerprint) || 0) > now - ALERT_COOLDOWN_MS) return false;
    recentAlerts.set(fingerprint, now);

    const text = [
        `🚨 <b>${escapeHtml(type)}</b>`,
        `<b>Lỗi:</b> ${escapeHtml(safeError(error))}`,
        context.path ? `<b>URL:</b> ${escapeHtml(context.method || '')} ${escapeHtml(context.path)}` : '',
        context.requestId ? `<b>Request:</b> <code>${escapeHtml(context.requestId)}</code>` : '',
        `<b>Môi trường:</b> ${escapeHtml(process.env.VERCEL_ENV || process.env.NODE_ENV || 'development')}`,
        `<b>Host:</b> ${escapeHtml(os.hostname())}`,
        `<b>Thời gian:</b> ${escapeHtml(new Date().toISOString())}`
    ].filter(Boolean).join('\n');
    return sendTelegramAlert(text);
}

function clearAlertCache(now = Date.now()) {
    let removed = 0;
    for (const [key, timestamp] of recentAlerts) {
        if (timestamp < now - 24 * 60 * 60 * 1000) {
            recentAlerts.delete(key);
            removed += 1;
        }
    }
    return removed;
}

module.exports = { alertSystem, clearAlertCache, safeError };
