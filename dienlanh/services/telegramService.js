const fs = require('fs/promises');
const path = require('path');
const { query } = require('../config/database');

const TELEGRAM_API_BASE = 'https://api.telegram.org';

function valueOrFallback(value, fallback = 'Không cung cấp') {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function escapeTelegramHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function displayValue(value) {
    if (value === undefined || value === null) return '';
    const normalized = String(value).trim();
    if (!normalized || /^(undefined|null|n\/a|không cung cấp)$/i.test(normalized)) return '';
    return normalized;
}

function formatNotificationDate(value) {
    const normalized = displayValue(value);
    if (!normalized) return '';

    const isoDate = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|\s|$)/);
    if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;
    return normalized;
}

function formatNotificationTime(value) {
    return displayValue(value).replace(
        /^(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})$/,
        '$1 – $2'
    );
}

function detailLine(label, value) {
    const normalized = displayValue(value);
    return normalized ? `- ${label}: ${escapeTelegramHtml(normalized)}` : '';
}

function notificationSection(title, lines) {
    const visibleLines = lines.filter(Boolean);
    return visibleLines.length ? `<b>${title}</b>\n${visibleLines.join('\n')}` : '';
}

function imageSummary(count) {
    const normalizedCount = Math.max(0, Number.parseInt(count, 10) || 0);
    return normalizedCount ? `${normalizedCount} ảnh đính kèm` : 'Không có ảnh đính kèm';
}

const DEVICE_LABELS = Object.freeze({
    'may-lanh': 'Máy lạnh',
    'tu-lanh': 'Tủ lạnh',
    'may-giat': 'Máy giặt',
    'may-nuoc-nong': 'Máy nước nóng',
    'he-thong-dien-lanh': 'Hệ thống điện lạnh',
    'quat-dieu-hoa': 'Quạt điều hòa'
});
const SERVICE_LABELS = Object.freeze({
    've-sinh-may-giat': 'Vệ sinh máy giặt',
    'vệ sinh máy giặt': 'Vệ sinh máy giặt',
    'trien-khai-he-thong-dien-lanh': 'Triển khai hệ thống điện lạnh',
    'triển khai hệ thống điện lạnh': 'Triển khai hệ thống điện lạnh',
    'bao-tri-he-thong-dien-lanh': 'Bảo trì hệ thống điện lạnh',
    'bảo trì hệ thống điện lạnh': 'Bảo trì hệ thống điện lạnh'
});
const SLUG_WORD_LABELS = Object.freeze({
    may: 'Máy',
    loc: 'Lọc',
    khong: 'Không',
    khi: 'Khí'
});

function titleCaseSlug(value) {
    return String(value || '')
        .trim()
        .replace(/-+/g, ' ')
        .replace(/\s+/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map(word => SLUG_WORD_LABELS[word.toLowerCase()] || (word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
        .join(' ');
}

function formatDeviceLabel(value) {
    const raw = valueOrFallback(value);
    if (raw === valueOrFallback()) return raw;
    const normalized = raw.toLowerCase();
    return DEVICE_LABELS[normalized] || titleCaseSlug(raw);
}

function formatServiceLabel(value) {
    const raw = valueOrFallback(value);
    if (raw === valueOrFallback()) return raw;
    const normalized = raw.toLowerCase();
    if (SERVICE_LABELS[normalized]) return SERVICE_LABELS[normalized];
    if (normalized === 'sửa chữa' || normalized === 'sua-chua' || /^(su|sua)(-|$)/.test(normalized)) return 'Sửa chữa';
    if (normalized === 'vệ sinh' || normalized === 've-sinh' || /^ve-sinh(-|$)/.test(normalized)) return 'Vệ sinh';
    if (normalized === 'lắp đặt' || normalized === 'lap-dat' || /^lap-dat(-|$)/.test(normalized)) return 'Lắp đặt';
    return titleCaseSlug(raw);
}

function formatContactSubject(value) {
    const raw = displayValue(value);
    if (!raw) return '';

    const normalized = raw.toLowerCase();
    const servicePatterns = [
        { pattern: /^(?:su|sua)-(.+)$/, label: 'Sửa' },
        { pattern: /^ve-sinh-(.+)$/, label: 'Vệ sinh' },
        { pattern: /^lap-dat-(.+)$/, label: 'Lắp đặt' },
        { pattern: /^trien-khai-(.+)$/, label: 'Triển khai' },
        { pattern: /^bao-tri-(.+)$/, label: 'Bảo trì' }
    ];

    for (const { pattern, label } of servicePatterns) {
        const match = normalized.match(pattern);
        if (match) {
            const device = formatDeviceLabel(match[1]);
            return `${label} ${device.toLocaleLowerCase('vi-VN')}`;
        }
    }

    return raw;
}

function telegramConfig() {
    return {
        token: process.env.TELEGRAM_BOT_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID
    };
}

async function sendTelegramMessage(text, parseMode = 'HTML') {
    const { token, chatId } = telegramConfig();

    if (!token || !chatId) {
        console.warn('Telegram notification skipped: configuration is missing.');
        return false;
    }

    const requestBody = {
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true
    };

    try {
        const response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(15000)
        });
        const result = await response.json().catch(() => null);

        if (!response.ok || !result?.ok) {
            console.error('Telegram notification failed.', {
                status: response.status,
                statusText: response.statusText,
                responseBody: result
            });
            return false;
        }

        return true;
    } catch (error) {
        console.error('Telegram notification failed:', error);
        return false;
    }
}

/**
 * Send a local image file to Telegram.
 * Node 18+ provides the global FormData/Blob APIs used here.
 */
async function sendTelegramPhoto(filePath, caption = '') {
    const { token, chatId } = telegramConfig();
    if (!token || !chatId) return false;

    try {
        const buffer = await fs.readFile(filePath);
        const filename = path.basename(filePath);
        const form = new FormData();
        form.append('chat_id', String(chatId));
        form.append('photo', new Blob([buffer]), filename);
        if (caption) {
            form.append('caption', caption.slice(0, 1024));
            form.append('parse_mode', 'HTML');
        }

        const response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendPhoto`, {
            method: 'POST',
            body: form,
            signal: AbortSignal.timeout(30000)
        });
        const result = await response.json().catch(() => null);

        if (!response.ok || !result?.ok) {
            console.error('Telegram photo upload failed.', {
                status: response.status,
                statusText: response.statusText,
                responseBody: result,
                filename
            });
            return false;
        }
        return true;
    } catch (error) {
        console.error('Telegram photo upload failed:', error);
        return false;
    }
}

function formatTechnician(data = {}) {
    return notificationSection('👨‍🔧 KỸ THUẬT VIÊN', [
        detailLine('Họ tên', data.technician_name),
        detailLine('SĐT', data.technician_phone),
        detailLine('Chuyên môn', data.technician_specialty),
        detailLine('Kinh nghiệm', data.technician_experience)
    ]);
}

function formatBookingNotification(data = {}) {
    const requestCode = displayValue(data.request_code);
    const sections = [
        notificationSection('👤 KHÁCH HÀNG', [
            detailLine('Họ tên', data.fullname || data.name),
            detailLine('Số điện thoại', data.phone),
            detailLine('Địa chỉ', data.address)
        ]),
        notificationSection('🔧 THIẾT BỊ &amp; DỊCH VỤ', [
            detailLine('Loại thiết bị', displayValue(data.device_type) ? formatDeviceLabel(data.device_type) : ''),
            detailLine('Dịch vụ', displayValue(data.service_type) ? formatServiceLabel(data.service_type) : ''),
            detailLine('Mô tả', data.description)
        ]),
        notificationSection('📅 LỊCH HẸN', [
            detailLine('Ngày hẹn', formatNotificationDate(data.booking_date || data.date)),
            detailLine('Thời gian', formatNotificationTime(data.booking_time || data.time))
        ]),
        formatTechnician(data),
        notificationSection('📷 HÌNH ẢNH', [
            `- ${imageSummary(data.image_count)}`
        ])
    ].filter(Boolean);

    return `<b>🔔 YÊU CẦU ĐẶT LỊCH MỚI</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
        `${requestCode ? `🆔 <b>Mã yêu cầu:</b> <code>${escapeTelegramHtml(requestCode)}</code>\n\n` : ''}` +
        `${sections.join('\n\n')}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `<b>🟠 TRẠNG THÁI: ĐẶT LỊCH THÀNH CÔNG</b>\n\n` +
        `🌐 Gửi từ <b>Website Điện Lạnh Nguyễn Hùng</b>`;
}

async function getBookingNotificationData(data = {}, bookingId) {
    const result = { ...data, image_count: 0, images: [] };

    try {
        if (data.technician_id) {
            const technicianResult = await query(
                `SELECT TOP 1 id, full_name, phone, specialty, experience, avatar
                 FROM dbo.technicians WHERE id = @technicianId`,
                { technicianId: data.technician_id }
            );
            const technician = technicianResult.recordset[0];
            if (technician) {
                result.technician_name = technician.full_name;
                result.technician_phone = technician.phone;
                result.technician_specialty = technician.specialty;
                result.technician_experience = technician.experience;
                result.technician_avatar = technician.avatar;
            }
        }
    } catch (error) {
        console.error('Could not load technician for Telegram notification:', error);
    }

    // Prefer the files that were just saved by the request handler.
    // This is the most reliable source for the current booking.
    if (Array.isArray(data._storedImages) && data._storedImages.length) {
        result.images = data._storedImages;
        result.image_count = result.images.length;
    } else if (bookingId) {
        try {
            const imageResult = await query(
                `SELECT filename, mime_type
                 FROM dbo.request_images
                 WHERE request_type = 'booking' AND request_id = @bookingId
                 ORDER BY id`,
                { bookingId }
            );
            result.images = imageResult.recordset || [];
            result.image_count = result.images.length;
        } catch (error) {
            // The booking itself should still be sent when the optional image table is unavailable.
            if (error?.number !== 208 && !/Invalid object name/i.test(error?.message || '')) {
                console.error('Could not load booking images for Telegram:', error);
            }
        }
    }

    return result;
}

async function sendBookingNotification(data, bookingId) {
    const notification = await getBookingNotificationData(data, bookingId);
    let success = await sendTelegramMessage(formatBookingNotification(notification));

    const imageDirectory = path.join(__dirname, '../private/request-images');
    for (const image of notification.images || []) {
        const imagePath = path.join(imageDirectory, image.filename);
        const reference = notification.request_code || `#${bookingId}`;
        const sent = await sendTelegramPhoto(imagePath, `🖼 Ảnh thiết bị của yêu cầu ${escapeTelegramHtml(reference)}`);
        if (!sent) success = false;
    }

    return success;
}

function formatContactNotification(data = {}) {
    const requestCode = displayValue(data.request_code);
    const imageCount = Array.isArray(data._storedImages)
        ? data._storedImages.length
        : (data.image_count || 0);
    const sections = [
        notificationSection('👤 KHÁCH HÀNG', [
            detailLine('Họ tên', data.fullname || data.name),
            detailLine('Điện thoại', data.phone),
            detailLine('Email', data.email)
        ]),
        notificationSection('📂 NỘI DUNG LIÊN HỆ', [
            detailLine('Chủ đề', formatContactSubject(data.subject)),
            detailLine('Nội dung', data.message)
        ]),
        notificationSection('📷 HÌNH ẢNH', [
            `- ${imageSummary(imageCount)}`
        ])
    ].filter(Boolean);

    return `<b>📩 LIÊN HỆ MỚI</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
        `${requestCode ? `🆔 <b>Mã yêu cầu:</b> <code>${escapeTelegramHtml(requestCode)}</code>\n\n` : ''}` +
        `${sections.join('\n\n')}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `<b>🟢 TRẠNG THÁI: LIÊN HỆ THÀNH CÔNG</b>\n\n` +
        `🌐 Gửi từ <b>Website Điện Lạnh Nguyễn Hùng</b>`;
}

async function sendContactNotification(data, contactId) {
    // Gửi thông tin liên hệ trước
    let success = await sendTelegramMessage(
        formatContactNotification(data)
    );

    // Thư mục chứa ảnh đã upload
    const imageDirectory = path.join(
        __dirname,
        '../private/request-images'
    );

    // Lấy danh sách ảnh vừa upload
    const images = Array.isArray(data._storedImages)
        ? data._storedImages
        : [];

    console.log('📷 Ảnh liên hệ cần gửi Telegram:', images);

    // Gửi từng ảnh lên Telegram
    for (const image of images) {
        if (!image?.filename) {
            console.warn('Ảnh không có filename:', image);
            continue;
        }

        const imagePath = path.join(
            imageDirectory,
            image.filename
        );

        try {
            await fs.access(imagePath);

            const sent = await sendTelegramPhoto(
                imagePath,
                `🖼 Ảnh thiết bị của liên hệ ${escapeTelegramHtml(data.request_code || `#${contactId || ''}`)}`
            );

            if (!sent) {
                success = false;
            }
        } catch (error) {
            console.error(
                '❌ Không tìm thấy ảnh để gửi Telegram:',
                imagePath,
                error
            );

            success = false;
        }
    }

    return success;
}

module.exports = {
    sendTelegramMessage,
    sendTelegramPhoto,
    sendBookingNotification,
    sendContactNotification,
    formatBookingNotification,
    formatContactNotification,
    formatDeviceLabel,
    formatServiceLabel,
    formatContactSubject
};
