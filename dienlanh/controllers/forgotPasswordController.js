const crypto = require('crypto');
const path = require('path');
const bcrypt = require('bcryptjs');
const { query, getConnection, sql } = require('../config/database');
const { sendPasswordResetOtp } = require('../services/emailService');

const forgotPasswordPage = path.resolve(__dirname, '../../dienlanh- web/quen-mat-khau.html');
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const hashToken = value => crypto.createHash('sha256').update(value).digest('hex');
const publicMailError = 'Không thể gửi mã OTP lúc này. Vui lòng thử lại sau.';

function maskEmail(email) {
    const [local, domain] = email.split('@');
    return `${local.charAt(0)}${'*'.repeat(Math.max(3, local.length - 2))}${local.length > 1 ? local.slice(-1) : ''}@${domain}`;
}

function logMailError(error) {
    const technical = error.cause || error;
    console.error('Không thể gửi OTP:', { code: technical.code || error.code, command: technical.command, responseCode: technical.responseCode, message: technical.message });
}

function showPage(req, res) { return res.sendFile(forgotPasswordPage); }

async function sendOtp(req, res, next) {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        if (!EMAIL_PATTERN.test(email) || !email.endsWith('@gmail.com')) return res.status(400).json({ error: 'Vui lòng nhập địa chỉ Gmail hợp lệ.' });
        const user = (await query("SELECT TOP 1 id, name, email FROM users WHERE LOWER(email) = @email AND status = 'active'", { email })).recordset[0];
        if (!user) return res.status(400).json({ error: publicMailError });

        const recent = (await query('SELECT TOP 1 created_at FROM password_resets WHERE user_id = @userId AND created_at > DATEADD(SECOND, -60, SYSUTCDATETIME()) ORDER BY created_at DESC', { userId: user.id })).recordset[0];
        if (recent) return res.status(429).json({ error: 'Vui lòng chờ 60 giây trước khi yêu cầu mã OTP mới.', retryAfter: 60 });

        const otp = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
        const otpHash = await bcrypt.hash(otp, 10);
        await query('UPDATE password_resets SET used = 1, used_at = SYSUTCDATETIME() WHERE user_id = @userId AND used = 0', { userId: user.id });
        const inserted = (await query(`INSERT INTO password_resets (email, token, user_id, token_hash, otp_hash, otp_attempts, expires_at, used)
            OUTPUT INSERTED.id VALUES (@email, @legacyHash, @userId, @legacyHash, @otpHash, 0, DATEADD(MINUTE, 5, SYSUTCDATETIME()), 0)`,
            { email: user.email, legacyHash: hashToken(crypto.randomBytes(32).toString('hex')), userId: user.id, otpHash })).recordset[0];
        try {
            await sendPasswordResetOtp({ recipient: user.email, name: user.name, otp });
        } catch (error) {
            await query('UPDATE password_resets SET used = 1, used_at = SYSUTCDATETIME() WHERE id = @id', { id: inserted.id });
            logMailError(error);
            return res.status(503).json({ error: publicMailError });
        }
        return res.json({ message: 'Mã OTP đã được gửi đến Gmail của bạn.', maskedEmail: maskEmail(user.email), expiresIn: 300, resendAfter: 60 });
    } catch (error) { return next(error); }
}

async function verifyOtp(req, res, next) {
    const email = String(req.body.email || '').trim().toLowerCase();
    const otp = String(req.body.otp || '').trim();
    if (!EMAIL_PATTERN.test(email) || !/^\d{6}$/.test(otp)) return res.status(400).json({ error: 'Vui lòng nhập đầy đủ mã OTP gồm 6 chữ số.' });
    let transaction;
    try {
        transaction = new sql.Transaction(await getConnection());
        await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
        const request = new sql.Request(transaction);
        request.input('email', sql.NVarChar(100), email);
        const reset = (await request.query(`SELECT TOP 1 id, otp_hash, otp_attempts, expires_at FROM password_resets WITH (UPDLOCK, HOLDLOCK)
            WHERE LOWER(email) = @email AND used = 0 ORDER BY created_at DESC`)).recordset[0];
        if (!reset) { await transaction.rollback(); transaction = null; return res.status(400).json({ error: 'Mã OTP không hợp lệ. Vui lòng yêu cầu mã mới.' }); }
        if (new Date(reset.expires_at) <= new Date()) {
            const expire = new sql.Request(transaction); expire.input('id', sql.Int, reset.id); await expire.query('UPDATE password_resets SET used=1, used_at=SYSUTCDATETIME() WHERE id=@id');
            await transaction.commit(); transaction = null; return res.status(400).json({ error: 'Mã OTP đã hết hạn. Vui lòng yêu cầu mã OTP mới.' });
        }
        if (reset.otp_attempts >= 5) { await transaction.rollback(); transaction = null; return res.status(429).json({ error: 'Mã OTP đã bị vô hiệu hóa. Vui lòng yêu cầu mã OTP mới.' }); }
        if (!await bcrypt.compare(otp, reset.otp_hash || '')) {
            const attempts = reset.otp_attempts + 1;
            const fail = new sql.Request(transaction); fail.input('id', sql.Int, reset.id); fail.input('attempts', sql.Int, attempts);
            await fail.query('UPDATE password_resets SET otp_attempts=@attempts, used=CASE WHEN @attempts>=5 THEN 1 ELSE used END, used_at=CASE WHEN @attempts>=5 THEN SYSUTCDATETIME() ELSE used_at END WHERE id=@id');
            await transaction.commit(); transaction = null;
            return res.status(attempts >= 5 ? 429 : 400).json({ error: attempts >= 5 ? 'Mã OTP đã bị vô hiệu hóa. Vui lòng yêu cầu mã OTP mới.' : 'Mã OTP không chính xác. Vui lòng kiểm tra lại.', attemptsRemaining: Math.max(0, 5 - attempts) });
        }
        const resetToken = crypto.randomBytes(32).toString('hex');
        const success = new sql.Request(transaction); success.input('id', sql.Int, reset.id); success.input('verificationHash', sql.Char(64), hashToken(resetToken));
        await success.query('UPDATE password_resets SET verified_at=SYSUTCDATETIME(), verification_hash=@verificationHash, expires_at=DATEADD(MINUTE,10,SYSUTCDATETIME()) WHERE id=@id');
        await transaction.commit(); transaction = null;
        return res.json({ message: 'Xác thực OTP thành công.', resetToken });
    } catch (error) { if (transaction) await transaction.rollback().catch(() => {}); return next(error); }
}

async function resetPassword(req, res, next) {
    const resetToken = String(req.body.resetToken || '');
    const password = String(req.body.password || '');
    const confirmation = String(req.body.passwordConfirmation || '');
    if (!/^[a-f0-9]{64}$/i.test(resetToken)) return res.status(400).json({ error: 'Phiên đặt lại mật khẩu không hợp lệ.' });
    if (password.length < 8 || password.length > 72) return res.status(400).json({ error: 'Mật khẩu phải có từ 8 đến 72 ký tự.' });
    if (password !== confirmation) return res.status(400).json({ error: 'Hai mật khẩu không khớp.' });
    let transaction;
    try {
        const passwordHash = await bcrypt.hash(password, 12);
        transaction = new sql.Transaction(await getConnection()); await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
        const lookup = new sql.Request(transaction); lookup.input('hash', sql.Char(64), hashToken(resetToken));
        const reset = (await lookup.query('SELECT TOP 1 id,user_id FROM password_resets WITH (UPDLOCK,HOLDLOCK) WHERE verification_hash=@hash AND verified_at IS NOT NULL AND used=0 AND expires_at>SYSUTCDATETIME()')).recordset[0];
        if (!reset) { await transaction.rollback(); transaction=null; return res.status(400).json({ error: 'Phiên đặt lại mật khẩu đã hết hạn hoặc đã được sử dụng.' }); }
        const update = new sql.Request(transaction); update.input('userId',sql.Int,reset.user_id); update.input('id',sql.Int,reset.id); update.input('passwordHash',sql.NVarChar(255),passwordHash);
        await update.query('UPDATE users SET password_hash=@passwordHash,updated_at=GETDATE() WHERE id=@userId; UPDATE password_resets SET used=1,used_at=SYSUTCDATETIME(),verification_hash=NULL WHERE id=@id;');
        await transaction.commit(); transaction=null; return res.json({ message: 'Đặt lại mật khẩu thành công!' });
    } catch(error) { if(transaction) await transaction.rollback().catch(()=>{}); return next(error); }
}

module.exports = { showPage, sendOtp, verifyOtp, resetPassword };
