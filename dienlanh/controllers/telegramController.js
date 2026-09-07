const { sendTelegramMessage } = require('../services/telegramService');
const MAX_TITLE_LENGTH = 150;
const MAX_MESSAGE_LENGTH = 3500;

function normalizeInput(value, maxLength) {
    if (typeof value !== 'string') return '';
    return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, maxLength);
}

function escapeHtml(value) {
    return value.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatTelegramMessage(title, message) {
    const sentAt = new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'short',
        timeStyle: 'medium',
        timeZone: 'Asia/Ho_Chi_Minh'
    }).format(new Date());

    return `<b>🔔 THÔNG BÁO TỪ ĐIỆN LẠNH NGUYÊN HÙNG</b>\n\n<b>Tiêu đề:</b> ${escapeHtml(title)}\n\n<b>Nội dung:</b>\n${escapeHtml(message).replace(/\n/g, '\n')}\n\n<b>Thời gian gửi:</b> ${sentAt}`;
}

function page(req, res) {
    return res.render('telegram', {
        title: 'Gửi thông báo Telegram - NGUYỄN HÙNG',
        activePage: 'telegram'
    });
}

async function send(req, res) {
    const title = normalizeInput(req.body?.title, MAX_TITLE_LENGTH);
    const message = normalizeInput(req.body?.message, MAX_MESSAGE_LENGTH);

    if (!title || !message) {
        return res.status(400).json({ error: 'Tiêu đề và nội dung thông báo là bắt buộc.' });
    }

    try {
        const sent = await sendTelegramMessage(formatTelegramMessage(title, message), 'HTML');
        if (!sent) {
            return res.status(502).json({ error: 'Không thể gửi thông báo. Vui lòng kiểm tra cấu hình Telegram.' });
        }

        return res.json({ message: 'Đã gửi thông báo đến Telegram thành công.' });
    } catch (error) {
        return res.status(502).json({ error: 'Không thể gửi thông báo. Vui lòng kiểm tra cấu hình Telegram.' });
    }
}

module.exports = { page, send, formatTelegramMessage, normalizeInput };
