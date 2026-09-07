const nodemailer = require('nodemailer');

function mailConfig() {
    const host = process.env.SMTP_HOST || process.env.MAIL_HOST;
    const port = Number(process.env.SMTP_PORT || process.env.MAIL_PORT || 587);
    const user = process.env.SMTP_USER || process.env.MAIL_USER;
    // Google displays App Passwords in four groups separated by spaces.
    // Normalize copied values before authenticating with SMTP.
    const pass = String(process.env.SMTP_PASS || process.env.MAIL_PASS || '').replace(/\s/g, '');
    if (!host || !user || !pass || /your-|example/i.test(`${user} ${pass}`)) return null;
    return { host, port, secure: port === 465, auth: { user, pass } };
}

function smtpError(error) {
    const wrapped = new Error('Không thể gửi email lúc này. Vui lòng thử lại sau.');
    wrapped.code = 'PASSWORD_RESET_EMAIL_FAILED';
    wrapped.cause = error;
    return wrapped;
}

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

async function sendPasswordResetEmail({ recipient, name, resetUrl }) {
    const config = mailConfig();
    if (!config) {
        const error = new Error('SMTP chưa được cấu hình. Hãy đặt SMTP_USER và Google App Password hợp lệ trong SMTP_PASS.');
        error.code = 'SMTP_NOT_CONFIGURED';
        throw smtpError(error);
    }
    const transporter = nodemailer.createTransport(config);
    const safeName = escapeHtml(name || 'Quý khách');
    const safeUrl = escapeHtml(resetUrl);
    try {
        const info = await transporter.sendMail({
        from: process.env.MAIL_FROM || `Điện máy Nguyên Hùng <${config.auth.user}>`,
        to: recipient,
        subject: 'Đặt lại mật khẩu - Điện máy Nguyên Hùng',
        text: `Xin chào ${name || 'Quý khách'},\n\nMở liên kết sau để đặt lại mật khẩu (có hiệu lực 15 phút):\n${resetUrl}\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.`,
        html: `<!doctype html><html><body style="margin:0;background:#eef4fb;font-family:Arial,sans-serif;color:#26364d"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 8px 28px rgba(20,48,86,.12)"><tr><td style="background:#18345e;padding:24px;text-align:center;color:#fff"><h1 style="margin:0;font-size:23px">ĐIỆN MÁY NGUYÊN HÙNG</h1></td></tr><tr><td style="padding:34px"><h2 style="margin-top:0;color:#18345e">Đặt lại mật khẩu</h2><p>Xin chào ${safeName},</p><p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu. Nút bên dưới có hiệu lực trong <strong>15 phút</strong> và chỉ sử dụng được một lần.</p><p style="text-align:center;margin:30px 0"><a href="${safeUrl}" style="display:inline-block;background:#e53935;color:#fff;text-decoration:none;font-weight:bold;padding:14px 24px;border-radius:8px">ĐẶT LẠI MẬT KHẨU</a></p><p style="font-size:13px;color:#64748b">Nếu bạn không gửi yêu cầu này, hãy bỏ qua email. Mật khẩu hiện tại của bạn vẫn an toàn.</p></td></tr></table></td></tr></table></body></html>`
        });
        const accepted = (info.accepted || []).map(value => String(value).toLowerCase());
        if (!accepted.includes(String(recipient).toLowerCase())) {
            throw new Error(`SMTP không chấp nhận người nhận; rejected=${(info.rejected || []).join(',') || 'unknown'}`);
        }
        return { messageId: info.messageId, accepted: info.accepted };
    } catch (error) {
        if (error.code === 'PASSWORD_RESET_EMAIL_FAILED') throw error;
        throw smtpError(error);
    }
}

async function sendPasswordResetOtp({ recipient, name, otp }) {
    const config = mailConfig();
    if (!config) {
        const error = new Error('SMTP chưa được cấu hình hoặc thông tin đăng nhập không hợp lệ.');
        error.code = 'SMTP_NOT_CONFIGURED';
        throw smtpError(error);
    }
    const transporter = nodemailer.createTransport(config);
    const safeName = escapeHtml(name || 'Quý khách');
    const safeOtp = escapeHtml(otp);
    try {
        const info = await transporter.sendMail({
            from: process.env.MAIL_FROM || `Điện máy Nguyên Hùng <${config.auth.user}>`,
            to: recipient,
            subject: 'Mã OTP đặt lại mật khẩu - Điện máy Nguyên Hùng',
            text: `Xin chào ${name || 'Quý khách'},\n\nMã OTP đặt lại mật khẩu của bạn là: ${otp}\nMã có hiệu lực trong 5 phút. Không chia sẻ mã này với bất kỳ ai.`,
            html: `<!doctype html><html><body style="margin:0;background:#eef4fb;font-family:Arial,sans-serif;color:#26364d"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 8px 28px rgba(20,48,86,.12)"><tr><td style="background:#18345e;padding:24px;text-align:center;color:#fff"><h1 style="margin:0;font-size:23px">ĐIỆN MÁY NGUYÊN HÙNG</h1></td></tr><tr><td style="padding:34px"><h2 style="margin-top:0;color:#18345e">Xác thực đặt lại mật khẩu</h2><p>Xin chào ${safeName},</p><p>Bạn vừa yêu cầu đặt lại mật khẩu. Mã OTP của bạn là:</p><div style="margin:28px 0;text-align:center;font-size:34px;font-weight:700;letter-spacing:10px;color:#18345e;background:#eef4fb;padding:18px;border-radius:10px">${safeOtp}</div><p>Mã OTP có hiệu lực trong <strong>5 phút</strong>.</p><p style="font-size:13px;color:#64748b">Không chia sẻ mã này với bất kỳ ai. Nếu bạn không thực hiện yêu cầu, vui lòng bỏ qua email.</p></td></tr></table></td></tr></table></body></html>`
        });
        const accepted = (info.accepted || []).map(value => String(value).toLowerCase());
        if (!accepted.includes(String(recipient).toLowerCase())) throw new Error('SMTP không chấp nhận người nhận OTP.');
        return { messageId: info.messageId };
    } catch (error) { throw smtpError(error); }
}

module.exports = { sendPasswordResetEmail, sendPasswordResetOtp };
