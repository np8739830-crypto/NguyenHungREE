const test = require('node:test');
const assert = require('node:assert/strict');
const {
    formatBookingNotification,
    formatContactNotification,
    formatContactSubject,
    formatDeviceLabel,
    formatServiceLabel
} = require('../services/telegramService');

test('Telegram booking notification shows friendly Vietnamese device and service labels', () => {
    const message = formatBookingNotification({
        device_type: 'may-giat',
        service_type: 'su-may-giat'
    });

    assert.match(message, /- Loại thiết bị: Máy giặt/);
    assert.match(message, /- Dịch vụ: Sửa chữa/);
    assert.doesNotMatch(message, /may-giat|su-may-giat/);
});

test('booking notification is grouped, formats dates, and omits empty fields', () => {
    const message = formatBookingNotification({
        fullname: 'Nguyễn Văn A',
        phone: '0904098307',
        booking_date: '2026-08-26',
        booking_time: '07:45 - 09:45',
        technician_name: 'Trần Văn B',
        technician_specialty: 'null',
        request_code: 'DL-20260826-0001',
        image_count: 2
    });

    assert.match(message, /<b>🔔 YÊU CẦU ĐẶT LỊCH MỚI<\/b>/);
    assert.match(message, /<b>👤 KHÁCH HÀNG<\/b>/);
    assert.match(message, /- Ngày hẹn: 26\/08\/2026/);
    assert.match(message, /- Thời gian: 07:45 – 09:45/);
    assert.match(message, /- 2 ảnh đính kèm/);
    assert.match(message, /Mã yêu cầu:<\/b> <code>DL-20260826-0001<\/code>/);
    assert.match(message, /TRẠNG THÁI: ĐẶT LỊCH THÀNH CÔNG/);
    assert.doesNotMatch(message, /Chuyên môn|Không cung cấp|undefined|null|N\/A/i);
});

test('contact notification safely escapes customer text and preserves new lines', () => {
    const message = formatContactNotification({
        name: 'A & B <C>',
        phone: '0904098307',
        email: 'hello@example.com',
        subject: '',
        message: 'Dòng 1\nDòng 2 & <kiểm tra>',
        request_code: 'LH-20260826-0001',
        _storedImages: []
    });

    assert.match(message, /A &amp; B &lt;C&gt;/);
    assert.match(message, /Dòng 1\nDòng 2 &amp; &lt;kiểm tra&gt;/);
    assert.match(message, /Không có ảnh đính kèm/);
    assert.match(message, /Mã yêu cầu:<\/b> <code>LH-20260826-0001<\/code>/);
    assert.match(message, /TRẠNG THÁI: LIÊN HỆ THÀNH CÔNG/);
    assert.doesNotMatch(message, /Chủ đề:/);
    assert.doesNotMatch(message, /<kiểm tra>/);
});

test('legacy service slugs map to their generic service names', () => {
    assert.equal(formatServiceLabel('su-may-lanh'), 'Sửa chữa');
    assert.equal(formatServiceLabel('sua-tu-lanh'), 'Sửa chữa');
    assert.equal(formatServiceLabel('ve-sinh-tu-lanh'), 'Vệ sinh');
    assert.equal(formatServiceLabel('lap-dat-may-lanh'), 'Lắp đặt');
});

test('contact service subjects use readable Vietnamese labels', () => {
    assert.equal(formatContactSubject('su-tu-lanh'), 'Sửa tủ lạnh');
    assert.equal(formatContactSubject('sua-may-lanh'), 'Sửa máy lạnh');
    assert.equal(formatContactSubject('ve-sinh-may-giat'), 'Vệ sinh máy giặt');
    assert.equal(formatContactSubject('lap-dat-may-nuoc-nong'), 'Lắp đặt máy nước nóng');

    const message = formatContactNotification({ subject: 'su-tu-lanh' });
    assert.match(message, /- Chủ đề: Sửa tủ lạnh/);
    assert.doesNotMatch(message, /su-tu-lanh/);
});

test('unknown slugs use readable title case fallback', () => {
    assert.equal(formatDeviceLabel('may-loc-khong-khi'), 'Máy Lọc Không Khí');
    assert.equal(formatServiceLabel('bao-tri-dinh-ky'), 'Bao Tri Dinh Ky');
});
