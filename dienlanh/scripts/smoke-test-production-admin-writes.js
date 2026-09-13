'use strict';

require('dotenv').config({ override: true });
process.env.DATABASE_PROVIDER = 'd1';

const bcrypt = require('bcryptjs');
const { query, requestD1 } = require('../config/database');

const origin = 'https://linhkienchinhhang.com.vn';
const stamp = Date.now();
const email = `admin-write-${stamp}@example.invalid`;
const username = `admin_write_${String(stamp).slice(-8)}`;
const password = 'Admin-Write-2026!';
const testDate = '2099-12-30';

async function main() {
    let userId;
    let roleId;
    try {
        const administrator = (await query("SELECT id FROM roles WHERE slug='administrator'")).recordset[0];
        const technician = (await query("SELECT id FROM technicians WHERE COALESCE(work_status,'active')<>'inactive' ORDER BY id LIMIT 1")).recordset[0];
        if (!administrator || !technician) throw new Error('Missing administrator role or active technician');
        userId = (await query(`INSERT INTO users(name,email,phone,password_hash,role,status,email_verified,username,role_id,created_at,updated_at)
            VALUES(@name,@email,@phone,@hash,'admin','active',1,@username,@roleId,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING id`, {
            name: 'Admin Write Smoke', email, phone: `09${String(stamp).slice(-8)}`,
            hash: await bcrypt.hash(password, 10), username, roleId: administrator.id
        })).recordset[0].id;

        const login = await fetch(`${origin}/admin/login`, { method: 'POST', redirect: 'manual',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ username, password }) });
        const cookie = login.headers.get('set-cookie')?.split(';')[0];
        if (!cookie) throw new Error(`Admin login failed (${login.status})`);
        const page = await fetch(`${origin}/admin/attendance`, { headers: { cookie } });
        const html = await page.text();
        const csrf = html.match(/name=["']_csrf["'][^>]*value=["']([^"']+)/i)?.[1]
            || html.match(/(?:const\s+csrf|csrfToken)\s*[:=]\s*["']([a-f0-9]{32,})/i)?.[1];
        if (!csrf) throw new Error('CSRF token not found');

        async function api(path, method, body) {
            const response = await fetch(`${origin}${path}`, { method, headers: { cookie, 'content-type': 'application/json', 'x-csrf-token': csrf }, body: JSON.stringify(body) });
            const text = await response.text();
            if (response.status >= 400) throw new Error(`${method} ${path}: HTTP ${response.status} ${text.slice(0, 300)}`);
            return text ? JSON.parse(text) : {};
        }

        await api('/admin/api/attendance', 'POST', { technician_id: technician.id, attendance_date: testDate,
            status: 'present', check_in: '08:00', check_out: '17:00', overtime_hours: 0, note: `prod-${stamp}` });
        console.log('PASS production attendance save');
        await api('/admin/api/attendance/close-month', 'POST', { month: 12, year: 2099 });
        await api('/admin/api/attendance/reopen-month', 'POST', { month: 12, year: 2099 });
        await api('/admin/api/attendance/month', 'DELETE', { month: 12, year: 2099 });
        console.log('PASS production attendance close/reopen/remove');

        roleId = (await query("INSERT INTO roles(name,slug,description,is_system) VALUES(@name,@slug,'production smoke',0) RETURNING id", {
            name: `Prod smoke ${stamp}`, slug: `prod-smoke-${stamp}`
        })).recordset[0].id;
        const permission = (await query('SELECT id FROM permissions ORDER BY id LIMIT 1')).recordset[0];
        const roleResponse = await fetch(`${origin}/admin/access/roles/${roleId}`, { method: 'POST', redirect: 'manual',
            headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ _csrf: csrf, permissions: String(permission.id) }) });
        if (![302, 303].includes(roleResponse.status)) throw new Error(`Role update failed (${roleResponse.status}): ${(await roleResponse.text()).slice(0, 300)}`);
        const saved = Number((await query('SELECT COUNT(*) total FROM role_permissions WHERE role_id=@roleId', { roleId })).recordset[0].total);
        if (!saved) throw new Error('Role permission not persisted');
        console.log('PASS production role permission update');
    } finally {
        await query('DELETE FROM attendance_audit_logs WHERE attendance_date=@date', { date: testDate }).catch(() => {});
        await query('DELETE FROM attendance WHERE attendance_date=@date', { date: testDate }).catch(() => {});
        await query('DELETE FROM attendance_periods WHERE attendance_month=12 AND attendance_year=2099').catch(() => {});
        if (roleId) {
            await query('DELETE FROM role_permissions WHERE role_id=@roleId', { roleId }).catch(() => {});
            await query('DELETE FROM roles WHERE id=@roleId', { roleId }).catch(() => {});
        }
        await requestD1('DELETE FROM app_sessions WHERE data LIKE ?', [`%${email}%`]).catch(() => {});
        if (userId) await query('DELETE FROM users WHERE id=@id', { id: userId }).catch(() => {});
    }
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
