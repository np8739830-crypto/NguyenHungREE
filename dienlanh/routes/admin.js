const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const {
    requireAdmin,
    loadAdminAuthorization,
    requirePermission,
    requireAdministrator,
    csrfProtect
} = require('../middleware/auth');
const { query } = require('../config/database');
const adminController = require('../controllers/adminController');
const telegramController = require('../controllers/telegramController');
const rbacController = require('../controllers/rbacController');
const reviewAdminController = require('../controllers/reviewAdminController');
const payrollController = require('../controllers/payrollController');
const attendanceController = require('../controllers/attendanceController');
const { getAuthorization, can } = require('../services/authorizationService');
const router = express.Router();

const upload = multer({
    storage: multer.diskStorage({
        destination: path.join(__dirname, '../public/uploads'),
        filename: (req, file, callback) => callback(null, `avatar-${req.session.admin.id}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`)
    }),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const extension = path.extname(file.originalname).toLowerCase();
        if (!allowedMimeTypes.includes(file.mimetype) || !allowedExtensions.includes(extension)) {
            return callback(new Error('Chi chap nhan anh JPG, PNG, GIF hoac WebP'));
        }
        return callback(null, true);
    }
});

const serviceImageUpload = multer({
    storage: multer.diskStorage({
        destination: path.join(__dirname, '../public/uploads'),
        filename: (req, file, callback) => callback(null, `service-${req.session.admin.id}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`)
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
        const extension = path.extname(file.originalname).toLowerCase();
        if (!allowedMimeTypes.includes(file.mimetype) || !allowedExtensions.includes(extension)) {
            return callback(new Error('Chỉ chấp nhận ảnh JPG, PNG hoặc WebP'));
        }
        return callback(null, true);
    }
});

function uploadServiceImage(req, res, next) {
    serviceImageUpload.single('service_image')(req, res, error => {
        if (!error) return next();
        req.flash('error', error.code === 'LIMIT_FILE_SIZE' ? 'Ảnh dịch vụ tối đa 5 MB' : error.message);
        return res.redirect('/admin/products');
    });
}

function uploadAvatar(redirectPath) {
    return (req, res, next) => {
        upload.single('avatar')(req, res, error => {
            if (error) {
                const message = error.code === 'LIMIT_FILE_SIZE'
                    ? 'Anh dai dien toi da 2 MB'
                    : error.message;
                req.flash('error', message);
                return res.redirect(redirectPath);
            }
            return next();
        });
    };
}

router.get('/login', (req, res) => {
    if (req.session.admin?.id) {
        return res.redirect('/admin');
    }

    return res.render('login', {
        title: 'Đăng nhập quản trị'
    });
});

router.post('/login', async(req, res, next) => {
    try {
        const login = String(req.body.username || req.body.email || '').trim().toLowerCase();
        const user = (await query(`SELECT u.*, r.slug AS role_slug, r.name AS role_name
            FROM dbo.users u LEFT JOIN dbo.roles r ON r.id = u.role_id
            WHERE (LOWER(u.username) = @login OR LOWER(u.email) = @login)
              AND u.status = 'active' AND u.role = 'admin'`, {
            login
        })).recordset[0];

        if (!user || !user.role_id || !await bcrypt.compare(req.body.password || '', user.password_hash)) {
            req.flash('error', 'Tên đăng nhập hoặc mật khẩu không đúng');
            return res.redirect('/admin/login');
        }

        req.session.admin = {
            id: user.id,
            username: user.username,
            name: user.name,
            email: user.email,
            role: 'admin',
            roleId: user.role_id,
            roleSlug: user.role_slug,
            roleName: user.role_name
        };
        await query('UPDATE dbo.users SET last_login = GETDATE() WHERE id = @id', { id: user.id });
        const authorization = await getAuthorization(user.id);
        const landingPages = [
            ['dashboard', '/admin'],
            ['services', '/admin/products'],
            ['bookings', '/admin/bookings'],
            ['customers', '/admin/customers'],
            ['technicians', '/admin/technicians'],
            ['contacts', '/admin/contacts'],
            ['telegram', '/admin/telegram'],
            ['accounts', '/admin/access/accounts'],
            ['roles', '/admin/access/roles']
        ];
        const landing = landingPages.find(([moduleKey]) => can(authorization, moduleKey, 'view'));
        return res.redirect(landing?.[1] || '/admin/account');
    } catch (error) {
        return next(error);
    }
});

router.use(requireAdmin, loadAdminAuthorization);

router.post('/logout', (req, res, next) => {
    delete req.session.admin;
    return req.session.save(error => {
        if (error) return next(error);
        return res.redirect('/admin/login');
    });
});

router.get('/', requirePermission('dashboard', 'view'), adminController.dashboard);
router.get('/products', requirePermission('services', 'view'), csrfProtect, adminController.services);
router.post('/products', requirePermission('services', 'create'), uploadServiceImage, csrfProtect, adminController.createService);
router.post('/products/:id', requirePermission('services', 'update'), uploadServiceImage, csrfProtect, adminController.updateService);
router.post('/products/:id/delete', requirePermission('services', 'delete'), csrfProtect, adminController.deleteService);
router.get('/orders', requirePermission('bookings', 'view'), (req, res) => res.redirect('/admin/bookings'));
router.get('/bookings', requirePermission('bookings', 'view'), csrfProtect, adminController.bookings);
router.post('/bookings/:id', requirePermission('bookings', 'update'), csrfProtect, adminController.updateBooking);
router.get('/customers', requirePermission('customers', 'view'), csrfProtect, adminController.page('customers'));
router.get('/settings', requireAdministrator, adminController.page('settings'));
router.get('/contacts', requirePermission('contacts', 'view'), csrfProtect, adminController.page('contacts'));
router.get('/reviews', requirePermission('reviews', 'view'), csrfProtect, reviewAdminController.page);
router.post('/reviews/:id/status', requirePermission('reviews', 'update'), csrfProtect, reviewAdminController.update);
router.post('/reviews/:id/delete', requirePermission('reviews', 'delete'), csrfProtect, reviewAdminController.remove);
router.get('/telegram', requirePermission('telegram', 'view'), csrfProtect, telegramController.page);
router.post('/telegram/send', requirePermission('telegram', 'create'), csrfProtect, telegramController.send);
router.get('/technicians', requirePermission('technicians', 'view'), csrfProtect, adminController.technicians);
router.post('/technicians', requirePermission('technicians', 'create'), csrfProtect, adminController.createTechnician);
router.post('/technicians/:id', requirePermission('technicians', 'update'), uploadAvatar('/admin/technicians'), csrfProtect, adminController.updateTechnician);
router.post('/technicians/:id/delete', requirePermission('technicians', 'delete'), csrfProtect, adminController.deleteTechnician);
router.get('/staff', requirePermission('technicians', 'view'), (req, res) => res.redirect('/admin/technicians'));
router.get('/tracking', requirePermission('bookings', 'view'), (req, res) => res.redirect('/admin/orders'));

router.get('/payroll', requirePermission('payroll', 'view'), csrfProtect, payrollController.page);
router.get('/attendance',requirePermission('attendance','view'),csrfProtect,attendanceController.page);
router.get('/api/attendance/export',requirePermission('attendance','view'),csrfProtect,attendanceController.excel);
router.get('/api/attendance',requirePermission('attendance','view'),csrfProtect,attendanceController.list);
router.post('/api/attendance',requirePermission('attendance','create'),csrfProtect,attendanceController.save);
router.put('/api/attendance/:id',requirePermission('attendance','update'),csrfProtect,attendanceController.save);
router.post('/api/attendance/bulk',requirePermission('attendance','create'),csrfProtect,attendanceController.bulk);
router.post('/api/attendance/close-month',requirePermission('attendance','update'),csrfProtect,attendanceController.close);
router.post('/api/attendance/reopen-month',requirePermission('attendance','update'),requireAdministrator,csrfProtect,attendanceController.reopen);
router.delete('/api/attendance/month',requirePermission('attendance','delete'),requireAdministrator,csrfProtect,attendanceController.removePeriod);
router.get('/api/payroll/export', requirePermission('payroll', 'view'), csrfProtect, payrollController.exportExcel);
router.get('/api/payroll', requirePermission('payroll', 'view'), csrfProtect, payrollController.list);
router.get('/api/payroll-statistics', requirePermission('payroll', 'view'), csrfProtect, payrollController.statistics);
router.get('/api/payroll-policy', requirePermission('payroll', 'view'), csrfProtect, payrollController.configuration);
router.put('/api/payroll-policy', requirePermission('payroll', 'update'), requireAdministrator, csrfProtect, payrollController.updateConfiguration);
router.post('/api/payroll/employees/:employeeId/salary-increase', requirePermission('payroll', 'update'), requireAdministrator, csrfProtect, payrollController.salaryIncrease);
router.get('/api/payroll/:id', requirePermission('payroll', 'view'), csrfProtect, payrollController.detail);
router.get('/api/payroll/:id/revenue', requirePermission('payroll', 'view'), csrfProtect, payrollController.revenue);
router.get('/api/payroll/:id/revenue-details', requirePermission('payroll', 'view'), csrfProtect, payrollController.revenueDetails);
router.get('/api/payroll/:id/productivity', requirePermission('payroll', 'view'), csrfProtect, payrollController.productivity);
router.post('/api/payroll/:id/revenue/manual', requirePermission('payroll', 'update'), csrfProtect, payrollController.manualRevenue);
router.post('/api/payroll/:id/revenue/sync', requirePermission('payroll', 'update'), csrfProtect, payrollController.syncRevenue);
router.post('/api/payroll/generate', requirePermission('payroll', 'create'), csrfProtect, payrollController.generate);
router.put('/api/payroll/:id', requirePermission('payroll', 'update'), csrfProtect, payrollController.update);
router.delete('/api/payroll/:id', requirePermission('payroll', 'delete'), csrfProtect, payrollController.remove);
router.post('/api/payroll/:id/advance', requirePermission('payroll', 'update'), csrfProtect, payrollController.advance);
router.post('/api/payroll/:id/payment', requirePermission('payroll', 'update'), csrfProtect, payrollController.payment);
router.post('/api/payroll/:id/deduction', requirePermission('payroll', 'update'), csrfProtect, payrollController.deduction);
router.post('/api/payroll/:id/penalty', requirePermission('payroll', 'update'), csrfProtect, payrollController.penalty);
router.post('/api/payroll/:id/bonus', requirePermission('payroll', 'update'), csrfProtect, payrollController.bonus);
router.post('/api/payroll/:id/year-end-bonus', requirePermission('payroll', 'update'), csrfProtect, payrollController.yearEndBonus);
router.post('/api/payroll/:id/lock', requirePermission('payroll', 'update'), csrfProtect, payrollController.lock);
router.post('/api/payroll/:id/unlock', requirePermission('payroll', 'update'), requireAdministrator, csrfProtect, payrollController.unlock);

router.get('/access/accounts', requirePermission('accounts', 'view'), csrfProtect, rbacController.accounts);
router.post('/access/accounts', requirePermission('accounts', 'create'), csrfProtect, rbacController.createAccount);
router.post('/access/accounts/:id', requirePermission('accounts', 'update'), csrfProtect, rbacController.updateAccount);
router.post('/access/accounts/:id/status', requirePermission('accounts', 'update'), csrfProtect, rbacController.toggleAccount);
router.post('/access/accounts/:id/password', requirePermission('accounts', 'update'), csrfProtect, rbacController.resetPassword);
router.post('/access/accounts/:id/delete', requirePermission('accounts', 'delete'), csrfProtect, rbacController.deleteAccount);
router.get('/access/roles', requirePermission('roles', 'view'), requireAdministrator, csrfProtect, rbacController.roles);
router.post('/access/roles/:id', requirePermission('roles', 'update'), requireAdministrator, csrfProtect, rbacController.updateRolePermissions);

// Prevent old relative links from ever exposing a raw HTML file.
router.get('/bangdieukhien.html', requirePermission('dashboard', 'view'), (req, res) => res.redirect('/admin'));
router.get('/sanpham.html', requirePermission('services', 'view'), (req, res) => res.redirect('/admin/products'));
router.get('/banhang.html', requirePermission('bookings', 'view'), (req, res) => res.redirect('/admin/orders'));
router.get('/khachhang.html', requirePermission('customers', 'view'), (req, res) => res.redirect('/admin/customers'));
router.get('/cauhinh.html', requireAdministrator, (req, res) => res.redirect('/admin/settings'));
router.get('/lienhe.html', requirePermission('contacts', 'view'), (req, res) => res.redirect('/admin/contacts'));
router.get('/nhanvien.html', requirePermission('technicians', 'view'), (req, res) => res.redirect('/admin/staff'));
router.get('/account', csrfProtect, adminController.account);
router.post('/account', uploadAvatar('/admin/account'), csrfProtect, adminController.updateAccount);

module.exports = router;
