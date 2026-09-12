'use strict';

require('dotenv').config({ override: true });
process.env.DATABASE_PROVIDER = 'd1';

const bcrypt = require('bcryptjs');
const { query, requestD1 } = require('../config/database');

const origin = 'https://linhkienchinhhang.com.vn';
const email = 'admin-smoke-20260912@example.invalid';
const username = 'admin_smoke_20260912';
const password = 'Admin-Smoke-2026!';

const paths = [
    '/admin', '/admin/products', '/admin/bookings', '/admin/customers',
    '/admin/contacts', '/admin/reviews', '/admin/telegram', '/admin/technicians',
    '/admin/payroll', '/admin/attendance', '/admin/access/accounts',
    '/admin/access/roles', '/admin/account', '/admin/api/attendance',
    '/admin/api/payroll', '/admin/api/payroll-statistics', '/admin/api/payroll-policy'
];

async function main() {
    let userId;
    try {
        await query('DELETE FROM users WHERE email = @email', { email });
        const role = (await query("SELECT id FROM roles WHERE slug = 'administrator'")).recordset[0];
        if (!role) throw new Error('Không tìm thấy vai trò administrator.');
        const passwordHash = await bcrypt.hash(password, 10);
        const created = await query(`INSERT INTO users
            (name,email,phone,password_hash,role,status,email_verified,username,role_id,created_at,updated_at)
            VALUES (@name,@email,@phone,@passwordHash,'admin','active',1,@username,@roleId,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
            RETURNING id`, {
            name: 'Admin Smoke Test', email, phone: '0977770912', passwordHash, username, roleId: role.id
        });
        userId = created.recordset[0].id;

        const login = await fetch(`${origin}/admin/login`, {
            method: 'POST', redirect: 'manual',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ username, password })
        });
        const cookie = login.headers.get('set-cookie')?.split(';')[0];
        console.log(`LOGIN=${login.status} LOCATION=${login.headers.get('location') || ''} COOKIE=${Boolean(cookie)}`);
        if (!cookie || ![302, 303].includes(login.status)) throw new Error('Không đăng nhập được admin kiểm thử.');

        for (const pathname of paths) {
            const response = await fetch(`${origin}${pathname}`, { headers: { cookie }, redirect: 'manual' });
            const type = response.headers.get('content-type') || '';
            const body = await response.text();
            const failed = response.status >= 500 || /Đã xảy ra lỗi|FUNCTION_INVOCATION_FAILED/i.test(body);
            console.log(`${failed ? 'FAIL' : 'PASS'} HTTP=${response.status} PATH=${pathname} TYPE=${type.split(';')[0]}`);
            if (failed) console.log(`  ERROR=${body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220)}`);
        }
    } finally {
        await requestD1('DELETE FROM app_sessions WHERE data LIKE ?', [`%${email}%`]).catch(() => {});
        if (userId) await query('DELETE FROM users WHERE id = @id', { id: userId }).catch(() => {});
    }
}

main().catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
});
