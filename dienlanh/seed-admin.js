require('dotenv').config();

const bcrypt = require('bcryptjs');
const { query } = require('./db');

const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

async function seedAdmin() {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
        throw new Error('ADMIN_EMAIL và ADMIN_PASSWORD phải được thiết lập trong .env');
    }

    const existing = (await query('SELECT id FROM users WHERE email = @email', { email })).recordset[0];
    if (existing) {
        console.log(`Tài khoản quản trị ${email} đã tồn tại (id: ${existing.id}).`);
        return existing.id;
    }

    // ADMIN_PASSWORD may already be a bcrypt hash so production environments
    // do not need to keep the administrator's plaintext password.
    const passwordHash = BCRYPT_HASH_PATTERN.test(password)
        ? password
        : await bcrypt.hash(password, 12);
    const result = await query(
        `INSERT INTO users (name, email, phone, password_hash, role, status)
         OUTPUT INSERTED.id
         VALUES (@name, @email, @phone, @passwordHash, 'admin', 'active')`,
        {
            name: 'Quản trị viên',
            email,
            phone: process.env.ADMIN_PHONE || '0000000000',
            passwordHash
        }
    );

    const id = result.recordset[0].id;
    console.log(`Đã tạo tài khoản quản trị ${email} (id: ${id}).`);
    return id;
}

if (require.main === module) {
    seedAdmin().catch(error => {
        console.error('Không thể tạo tài khoản quản trị:', error.message);
        process.exitCode = 1;
    });
}

module.exports = { seedAdmin };
