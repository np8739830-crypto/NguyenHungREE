require('dotenv').config();
process.env.DATABASE_PROVIDER = 'd1';

const database = require('../config/database');
const attendance = require('../services/attendanceService');
const rbac = require('../controllers/rbacController');

async function main() {
    const query = database.query;
    const tag = `codex-${Date.now()}`;
    let roleId;
    const actor = (await query("SELECT id FROM users WHERE role='admin' OR role='administrator' ORDER BY id LIMIT 1")).recordset[0];
    const technician = (await query("SELECT id FROM technicians WHERE COALESCE(work_status,'active')<>'inactive' ORDER BY id LIMIT 1")).recordset[0];
    if (!actor || !technician) throw new Error('Can actor admin va ky thuat vien de chay smoke test.');

    try {
        const saved = await attendance.save({
            technician_id: technician.id,
            attendance_date: '2099-12-30',
            status: 'present',
            check_in: '08:00',
            check_out: '17:00',
            overtime_hours: 0,
            note: tag
        }, actor.id);
        if (saved.errors || !saved.attendance?.id) throw new Error(`Attendance save failed: ${JSON.stringify(saved)}`);
        console.log('PASS attendance save/update');

        await attendance.period(12, 2099, true, actor.id);
        await attendance.period(12, 2099, false, actor.id);
        const removed = await attendance.removePeriod(12, 2099, actor.id);
        if (removed.errors || removed.deleted < 1) throw new Error(`Attendance remove failed: ${JSON.stringify(removed)}`);
        console.log('PASS attendance close/reopen/remove period');

        roleId = (await query("INSERT INTO roles(name,slug,description,is_system) VALUES(@name,@slug,@description,0) RETURNING id", {
            name: tag, slug: tag, description: 'Temporary admin smoke test'
        })).recordset[0].id;
        const permissions = (await query('SELECT id FROM permissions ORDER BY id LIMIT 2')).recordset.map(item => String(item.id));
        let redirected = '';
        let nextError;
        await rbac.updateRolePermissions({ params: { id: roleId }, body: { permissions }, flash() {} }, {
            redirect(location) { redirected = location; return location; }
        }, error => { nextError = error; });
        if (nextError || redirected !== `/admin/access/roles?role=${roleId}`) throw nextError || new Error('RBAC redirect failed');
        const count = Number((await query('SELECT COUNT(*) total FROM role_permissions WHERE role_id=@roleId', { roleId })).recordset[0].total);
        if (!count) throw new Error('RBAC permissions were not saved');
        console.log('PASS role permission update');
    } finally {
        await query('DELETE FROM attendance_audit_logs WHERE reason=@tag OR attendance_date=@date', { tag, date: '2099-12-30' }).catch(() => {});
        await query('DELETE FROM attendance WHERE attendance_date=@date', { date: '2099-12-30' }).catch(() => {});
        await query('DELETE FROM attendance_periods WHERE attendance_month=12 AND attendance_year=2099').catch(() => {});
        if (roleId) {
            await query('DELETE FROM role_permissions WHERE role_id=@roleId', { roleId }).catch(() => {});
            await query('DELETE FROM roles WHERE id=@roleId', { roleId }).catch(() => {});
        }
    }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
