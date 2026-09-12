const bcrypt = require('bcryptjs');
const database = require('../config/database');
const { query, getConnection, sql } = database;
const { MODULES, ACTIONS } = require('../services/authorizationService');

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,50}$/;
const VALID_STATUSES = ['active', 'inactive'];

function normalizeAccountInput(body) {
    return {
        username: String(body.username || '').trim().toLowerCase(),
        name: String(body.name || '').trim(),
        email: String(body.email || '').trim().toLowerCase(),
        roleId: Number(body.role_id),
        status: VALID_STATUSES.includes(body.status) ? body.status : 'active'
    };
}

async function getRole(roleId) {
    return (await query('SELECT id, name, slug FROM dbo.roles WHERE id = @roleId', { roleId })).recordset[0] || null;
}

function canManageRole(req, role) {
    return role && (role.slug !== 'administrator' || req.adminAuthorization.roleSlug === 'administrator');
}

async function hasAnotherActiveAdministrator(accountId) {
    const result = await query(`SELECT COUNT(*) AS total FROM dbo.users u
        JOIN dbo.roles r ON r.id = u.role_id
        WHERE r.slug = 'administrator' AND u.role = 'admin' AND u.status = 'active' AND u.id <> @accountId`, { accountId });
    return result.recordset[0].total > 0;
}

async function accounts(req, res, next) {
    try {
        const [accountsResult, rolesResult] = await Promise.all([
            query(`SELECT u.id, u.username, u.name, u.email, u.status, u.last_login, u.created_at,
                          r.id AS role_id, r.name AS role_name, r.slug AS role_slug
                   FROM dbo.users u
                   INNER JOIN dbo.roles r ON r.id = u.role_id
                   WHERE u.role = 'admin'
                   ORDER BY CASE WHEN r.slug = 'administrator' THEN 0 ELSE 1 END, u.created_at DESC`),
            query('SELECT id, name, slug, description FROM dbo.roles ORDER BY id')
        ]);

        return res.render('rbac-accounts', {
            title: 'Quản lý tài khoản - NGUYỄN HÙNG',
            activePage: 'accounts',
            accounts: accountsResult.recordset,
            roles: rolesResult.recordset
        });
    } catch (error) {
        return next(error);
    }
}

async function createAccount(req, res, next) {
    try {
        const data = normalizeAccountInput(req.body);
        const password = String(req.body.password || '');
        const passwordConfirmation = String(req.body.password_confirmation || '');

        if (!USERNAME_PATTERN.test(data.username)) {
            req.flash('error', 'Tên đăng nhập phải có 3-50 ký tự, chỉ gồm chữ, số, dấu chấm, gạch ngang hoặc gạch dưới');
            return res.redirect('/admin/access/accounts');
        }
        if (!data.name || !data.email || !data.email.includes('@')) {
            req.flash('error', 'Họ tên và email hợp lệ là bắt buộc');
            return res.redirect('/admin/access/accounts');
        }
        if (password.length < 8 || password !== passwordConfirmation) {
            req.flash('error', 'Mật khẩu phải có ít nhất 8 ký tự và phần nhập lại phải khớp');
            return res.redirect('/admin/access/accounts');
        }

        const role = await getRole(data.roleId);
        if (!canManageRole(req, role)) {
            req.flash('error', 'Bạn không được phép gán vai trò Administrator');
            return res.redirect('/admin/access/accounts');
        }

        const duplicate = (await query(
            'SELECT id FROM dbo.users WHERE username = @username OR email = @email',
            { username: data.username, email: data.email }
        )).recordset[0];
        if (duplicate) {
            req.flash('error', 'Tên đăng nhập hoặc email đã tồn tại');
            return res.redirect('/admin/access/accounts');
        }

        const passwordHash = await bcrypt.hash(password, 12);
        await query(`INSERT dbo.users
            (username, name, email, phone, password_hash, role, role_id, status, email_verified, created_at, updated_at)
            VALUES (@username, @name, @email, @phone, @passwordHash, 'admin', @roleId, @status, 1, GETDATE(), GETDATE())`, {
            ...data,
            phone: `ADMIN-${data.username}`,
            passwordHash
        });

        req.flash('success', `Đã tạo tài khoản ${data.username}`);
        return res.redirect('/admin/access/accounts');
    } catch (error) {
        return next(error);
    }
}

async function updateAccount(req, res, next) {
    try {
        const accountId = Number(req.params.id);
        const data = normalizeAccountInput(req.body);
        const existing = (await query(`SELECT u.id, u.role_id, r.slug AS role_slug
            FROM dbo.users u JOIN dbo.roles r ON r.id = u.role_id
            WHERE u.id = @accountId AND u.role = 'admin'`, { accountId })).recordset[0];
        if (!existing || !canManageRole(req, { slug: existing.role_slug })) {
            req.flash('error', 'Không thể chỉnh sửa tài khoản này');
            return res.redirect('/admin/access/accounts');
        }
        if (!USERNAME_PATTERN.test(data.username) || !data.name || !data.email.includes('@')) {
            req.flash('error', 'Thông tin tài khoản không hợp lệ');
            return res.redirect('/admin/access/accounts');
        }

        const role = await getRole(data.roleId);
        if (!canManageRole(req, role)) {
            req.flash('error', 'Bạn không được phép gán vai trò Administrator');
            return res.redirect('/admin/access/accounts');
        }
        if (accountId === req.adminAuthorization.id && data.roleId !== existing.role_id) {
            req.flash('error', 'Bạn không thể tự thay đổi vai trò của tài khoản đang đăng nhập');
            return res.redirect('/admin/access/accounts');
        }
        if (accountId === req.adminAuthorization.id && data.status !== 'active') {
            req.flash('error', 'Bạn không thể tự khóa tài khoản đang đăng nhập');
            return res.redirect('/admin/access/accounts');
        }
        if (existing.role_slug === 'administrator' && (role.slug !== 'administrator' || data.status !== 'active') &&
            !await hasAnotherActiveAdministrator(accountId)) {
            req.flash('error', 'Hệ thống phải còn ít nhất một Administrator đang hoạt động');
            return res.redirect('/admin/access/accounts');
        }

        const duplicate = (await query(
            'SELECT id FROM dbo.users WHERE (username = @username OR email = @email) AND id <> @accountId',
            { username: data.username, email: data.email, accountId }
        )).recordset[0];
        if (duplicate) {
            req.flash('error', 'Tên đăng nhập hoặc email đã tồn tại');
            return res.redirect('/admin/access/accounts');
        }

        await query(`UPDATE dbo.users SET username = @username, name = @name, email = @email,
            role_id = @roleId, status = @status, updated_at = GETDATE() WHERE id = @accountId`, {
            ...data,
            accountId
        });
        req.flash('success', 'Đã cập nhật tài khoản');
        return res.redirect('/admin/access/accounts');
    } catch (error) {
        return next(error);
    }
}

async function toggleAccount(req, res, next) {
    try {
        const accountId = Number(req.params.id);
        const status = req.body.status === 'active' ? 'active' : 'inactive';
        const target = (await query(`SELECT u.id, r.slug AS role_slug FROM dbo.users u
            JOIN dbo.roles r ON r.id = u.role_id WHERE u.id = @accountId AND u.role = 'admin'`, { accountId })).recordset[0];
        if (!target || !canManageRole(req, { slug: target.role_slug }) || accountId === req.adminAuthorization.id) {
            req.flash('error', 'Không thể thay đổi trạng thái tài khoản này');
            return res.redirect('/admin/access/accounts');
        }
        if (target.role_slug === 'administrator' && status !== 'active' && !await hasAnotherActiveAdministrator(accountId)) {
            req.flash('error', 'Hệ thống phải còn ít nhất một Administrator đang hoạt động');
            return res.redirect('/admin/access/accounts');
        }

        await query('UPDATE dbo.users SET status = @status, updated_at = GETDATE() WHERE id = @accountId', { status, accountId });
        req.flash('success', status === 'active' ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản');
        return res.redirect('/admin/access/accounts');
    } catch (error) {
        return next(error);
    }
}

async function resetPassword(req, res, next) {
    try {
        const accountId = Number(req.params.id);
        const password = String(req.body.password || '');
        const confirmation = String(req.body.password_confirmation || '');
        if (password.length < 8 || password !== confirmation) {
            req.flash('error', 'Mật khẩu mới phải có ít nhất 8 ký tự và phần nhập lại phải khớp');
            return res.redirect('/admin/access/accounts');
        }

        const target = (await query(`SELECT u.id, r.slug AS role_slug FROM dbo.users u
            JOIN dbo.roles r ON r.id = u.role_id WHERE u.id = @accountId AND u.role = 'admin'`, { accountId })).recordset[0];
        if (!target || !canManageRole(req, { slug: target.role_slug })) {
            req.flash('error', 'Không thể đổi mật khẩu tài khoản này');
            return res.redirect('/admin/access/accounts');
        }

        const passwordHash = await bcrypt.hash(password, 12);
        await query('UPDATE dbo.users SET password_hash = @passwordHash, updated_at = GETDATE() WHERE id = @accountId', { passwordHash, accountId });
        req.flash('success', 'Đã đổi mật khẩu tài khoản');
        return res.redirect('/admin/access/accounts');
    } catch (error) {
        return next(error);
    }
}

async function deleteAccount(req, res, next) {
    try {
        const accountId = Number(req.params.id);
        if (accountId === req.adminAuthorization.id) {
            req.flash('error', 'Bạn không thể tự xóa tài khoản đang đăng nhập');
            return res.redirect('/admin/access/accounts');
        }

        const target = (await query(`SELECT u.id, r.slug AS role_slug FROM dbo.users u
            JOIN dbo.roles r ON r.id = u.role_id WHERE u.id = @accountId AND u.role = 'admin'`, { accountId })).recordset[0];
        if (!target || !canManageRole(req, { slug: target.role_slug })) {
            req.flash('error', 'Không thể xóa tài khoản này');
            return res.redirect('/admin/access/accounts');
        }
        if (target.role_slug === 'administrator') {
            if (!await hasAnotherActiveAdministrator(accountId)) {
                req.flash('error', 'Hệ thống phải còn ít nhất một Administrator đang hoạt động');
                return res.redirect('/admin/access/accounts');
            }
        }

        await query('DELETE FROM dbo.users WHERE id = @accountId', { accountId });
        req.flash('success', 'Đã xóa tài khoản');
        return res.redirect('/admin/access/accounts');
    } catch (error) {
        if (error.number === 547) {
            req.flash('error', 'Tài khoản đang có dữ liệu liên quan và không thể xóa; hãy khóa tài khoản thay thế');
            return res.redirect('/admin/access/accounts');
        }
        return next(error);
    }
}

async function roles(req, res, next) {
    try {
        const [rolesResult, permissionsResult, assignmentsResult] = await Promise.all([
            query('SELECT id, name, slug, description, is_system FROM dbo.roles ORDER BY id'),
            query('SELECT id, module_key, action_key, name FROM dbo.permissions ORDER BY id'),
            query('SELECT role_id, permission_id FROM dbo.role_permissions')
        ]);
        const assigned = {};
        assignmentsResult.recordset.forEach(item => {
            assigned[item.role_id] ||= [];
            assigned[item.role_id].push(item.permission_id);
        });

        return res.render('rbac-roles', {
            title: 'Vai trò & Quyền hạn - NGUYỄN HÙNG',
            activePage: 'roles',
            roles: rolesResult.recordset,
            permissions: permissionsResult.recordset,
            assigned,
            modules: MODULES,
            actions: ACTIONS
        });
    } catch (error) {
        return next(error);
    }
}

async function updateRolePermissions(req, res, next) {
    let transaction;
    try {
        const roleId = Number(req.params.id);
        const role = await getRole(roleId);
        if (!role || role.slug === 'administrator') {
            req.flash('error', 'Quyền Administrator là cố định và không thể chỉnh sửa');
            return res.redirect('/admin/access/roles');
        }

        const allPermissions = (await query('SELECT id, module_key, action_key FROM dbo.permissions')).recordset;
        const requested = new Set([].concat(req.body.permissions || []).map(Number).filter(Number.isInteger));
        const selectedModules = new Set(allPermissions.filter(item => requested.has(item.id)).map(item => item.module_key));
        allPermissions.filter(item => item.action_key === 'view' && selectedModules.has(item.module_key))
            .forEach(item => requested.add(item.id));
        const validIds = allPermissions.filter(item => requested.has(item.id)).map(item => item.id);

        if (database.provider === 'd1') {
            await query('DELETE FROM dbo.role_permissions WHERE role_id=@roleId', { roleId });
            for (const permissionId of validIds) {
                await query('INSERT dbo.role_permissions(role_id,permission_id) VALUES(@roleId,@permissionId)', { roleId, permissionId });
            }
            req.flash('success', `Da cap nhat quyen cho vai tro ${role.name}`);
            return res.redirect(`/admin/access/roles?role=${roleId}`);
        }

        const pool = await getConnection();
        transaction = new sql.Transaction(pool);
        await transaction.begin();
        await new sql.Request(transaction).input('roleId', sql.Int, roleId)
            .query('DELETE FROM dbo.role_permissions WHERE role_id = @roleId');
        for (const permissionId of validIds) {
            await new sql.Request(transaction)
                .input('roleId', sql.Int, roleId)
                .input('permissionId', sql.Int, permissionId)
                .query('INSERT dbo.role_permissions (role_id, permission_id) VALUES (@roleId, @permissionId)');
        }
        await transaction.commit();

        req.flash('success', `Đã cập nhật quyền cho vai trò ${role.name}`);
        return res.redirect(`/admin/access/roles?role=${roleId}`);
    } catch (error) {
        if (transaction) await transaction.rollback().catch(() => {});
        return next(error);
    }
}

module.exports = {
    accounts,
    createAccount,
    updateAccount,
    toggleAccount,
    resetPassword,
    deleteAccount,
    roles,
    updateRolePermissions
};
