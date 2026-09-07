const database = require('../config/database');

const MODULES = [
    { key: 'dashboard', label: 'Bảng điều khiển', icon: 'fa-solid fa-gauge-high' },
    { key: 'services', label: 'Quản lý dịch vụ', icon: 'fa-solid fa-screwdriver-wrench' },
    { key: 'bookings', label: 'Lịch đặt dịch vụ', icon: 'fa-solid fa-calendar-check' },
    { key: 'customers', label: 'Khách hàng', icon: 'fa-solid fa-users' },
    { key: 'technicians', label: 'Kỹ thuật viên', icon: 'fa-solid fa-user-gear' },
    { key: 'attendance', label: 'Chấm công', icon: 'fa-solid fa-clipboard-check' },
    { key: 'payroll', label: 'Bảng lương', icon: 'fa-solid fa-money-check-dollar' },
    { key: 'contacts', label: 'Liên hệ', icon: 'fa-solid fa-address-book' },
    { key: 'reviews', label: 'Đánh giá', icon: 'fa-solid fa-star' },
    { key: 'telegram', label: 'Thông báo Telegram', icon: 'fa-brands fa-telegram' },
    { key: 'accounts', label: 'Tài khoản', icon: 'fa-solid fa-user-lock' },
    { key: 'roles', label: 'Vai trò & Quyền hạn', icon: 'fa-solid fa-shield-halved' }
];

const ACTIONS = [
    { key: 'view', label: 'Xem' },
    { key: 'create', label: 'Thêm' },
    { key: 'update', label: 'Sửa' },
    { key: 'delete', label: 'Xóa' }
];

async function getAuthorization(userId) {
    const result = await database.query(`
        SELECT u.id, u.username, u.name, u.email, u.avatar, u.status,
               r.id AS role_id, r.slug AS role_slug, r.name AS role_name,
               p.module_key, p.action_key
        FROM dbo.users u
        LEFT JOIN dbo.roles r ON r.id = u.role_id
        LEFT JOIN dbo.role_permissions rp ON rp.role_id = r.id
        LEFT JOIN dbo.permissions p ON p.id = rp.permission_id
        WHERE u.id = @userId AND u.role = 'admin'
    `, { userId });

    if (!result.recordset.length) return null;
    const user = result.recordset[0];
    const permissions = [...new Set(result.recordset
        .filter(row => row.module_key && row.action_key)
        .map(row => `${row.module_key}.${row.action_key}`))];

    return {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        status: user.status,
        roleId: user.role_id,
        roleSlug: user.role_slug,
        roleName: user.role_name,
        permissions
    };
}

function can(authorization, moduleKey, actionKey = 'view') {
    return authorization?.roleSlug === 'administrator' ||
        authorization?.permissions?.includes(`${moduleKey}.${actionKey}`) || false;
}

module.exports = { MODULES, ACTIONS, getAuthorization, can };
