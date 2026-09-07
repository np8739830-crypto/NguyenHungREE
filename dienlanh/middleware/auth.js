/**
 * Authentication & Authorization Middleware
 */

const { getAuthorization, can } = require('../services/authorizationService');

function expectsJson(req) {
    return req.originalUrl?.startsWith('/api/') ||
        req.xhr ||
        req.headers['content-type']?.includes('json') ||
        req.get('accept')?.includes('application/json');
}

// Require login - redirect browser page requests, return JSON for API requests.
function requireAuth(req, res, next) {
    if (req.session && req.session.customer) {
        return next();
    }

    if (expectsJson(req)) {
        return res.status(401).json({
            success: false,
            message: 'Vui lòng đăng nhập để gửi yêu cầu.'
        });
    }

    req.flash('error', 'Vui lòng đăng nhập để tiếp tục');
    return res.redirect('/');
}

// Require admin role
function requireAdmin(req, res, next) {
    if (req.session?.admin?.id) {
        return next();
    }

    if (expectsJson(req)) {
        return res.status(403).json({ error: 'Bạn không có quyền truy cập' });
    }

    req.flash('error', 'Bạn không có quyền truy cập trang này');
    return res.redirect('/admin/login');
}

async function loadAdminAuthorization(req, res, next) {
    if (!req.session?.admin?.id) return requireAdmin(req, res, next);

    try {
        const authorization = await getAuthorization(req.session.admin.id);
        if (!authorization || authorization.status !== 'active' || !authorization.roleId) {
            delete req.session.admin;
            req.flash('error', 'Tài khoản đã bị khóa hoặc chưa được cấp vai trò');
            return res.redirect('/admin/login');
        }

        req.adminAuthorization = authorization;
        req.session.admin = {
            id: authorization.id,
            username: authorization.username,
            name: authorization.name,
            email: authorization.email,
            avatar: authorization.avatar,
            role: 'admin',
            roleId: authorization.roleId,
            roleSlug: authorization.roleSlug,
            roleName: authorization.roleName
        };
        res.locals.admin = req.session.admin;
        res.locals.adminAuthorization = authorization;
        res.locals.adminPermissions = authorization.permissions;
        res.locals.can = (moduleKey, actionKey = 'view') => can(authorization, moduleKey, actionKey);
        return next();
    } catch (error) {
        return next(error);
    }
}

function requirePermission(moduleKey, actionKey = 'view') {
    return (req, res, next) => {
        if (can(req.adminAuthorization, moduleKey, actionKey)) return next();

        if (expectsJson(req)) {
            return res.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này' });
        }

        return res.status(403).render('forbidden', {
            title: '403 - Không có quyền truy cập',
            activePage: null,
            requestedPermission: `${moduleKey}.${actionKey}`
        });
    };
}

function requireAdministrator(req, res, next) {
    if (req.adminAuthorization?.roleSlug === 'administrator') return next();
    return res.status(403).render('forbidden', {
        title: '403 - Không có quyền truy cập',
        activePage: null,
        requestedPermission: 'administrator'
    });
}

// Check if logged in (set locals for views)
function setUserLocals(req, res, next) {
    res.locals.customer = req.session?.customer || null;
    res.locals.admin = req.session?.admin || null;
    // `user` remains a customer alias for public EJS templates that may use it.
    res.locals.user = res.locals.customer;
    res.locals.isLoggedIn = !!res.locals.customer;
    res.locals.isCustomerLoggedIn = !!res.locals.customer;
    res.locals.isAdmin = !!res.locals.admin?.id;
    res.locals.adminAuthorization = null;
    res.locals.adminPermissions = [];
    res.locals.can = () => false;
    next();
}

// CSRF token generation and validation
function csrfProtect(req, res, next) {
    if (!req.session.csrfToken) {
        req.session.csrfToken = require('crypto').randomBytes(32).toString('hex');
    }

    res.locals.csrfToken = req.session.csrfToken;

    // Skip CSRF check for GET, HEAD, OPTIONS
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }

    const token = req.body._csrf || req.headers['x-csrf-token'];

    if (!token || token !== req.session.csrfToken) {
        if (expectsJson(req)) {
            return res.status(403).json({ error: 'CSRF token không hợp lệ' });
        }
        req.flash('error', 'Phiên làm việc hết hạn, vui lòng thử lại');
        return res.redirect('back');
    }

    next();
}

module.exports = {
    requireAuth,
    requireAdmin,
    loadAdminAuthorization,
    requirePermission,
    requireAdministrator,
    setUserLocals,
    csrfProtect
};
