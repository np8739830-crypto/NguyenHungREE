const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

async function register(req, res, next) {
    try {
        const { name, email, phone, password } = req.body;
        if (!name || !phone || !password) return res.status(400).json({ error: 'Vui lòng nhập họ tên, số điện thoại và mật khẩu.' });

        const existingUser = (await query(
            'SELECT id FROM users WHERE email = @email OR phone = @phone',
            { email: email || null, phone }
        )).recordset[0];
        if (existingUser) return res.status(409).json({ error: 'Email hoặc số điện thoại đã được sử dụng.' });

        const passwordHash = await bcrypt.hash(password, 10);
        const result = await query(
            'INSERT INTO users (name, email, phone, password_hash) OUTPUT INSERTED.id VALUES (@name, @email, @phone, @passwordHash)',
            { name, email: email || null, phone, passwordHash }
        );
        return res.status(201).json({ id: result.recordset[0].id, message: 'Đăng ký tài khoản thành công.' });
    } catch (error) {
        return next(error);
    }
}

async function login(req, res, next) {
    try {
        const identity = req.body.email || req.body.identity;
        const user = (await query(
            "SELECT * FROM users WHERE (email = @identity OR phone = @identity) AND status = 'active' AND role = 'user'",
            { identity }
        )).recordset[0];
        // This endpoint creates a customer session. Administrator accounts must
        // authenticate through /admin/login and must never become customers.
        if (!user || user.role !== 'user' || !await bcrypt.compare(req.body.password || '', user.password_hash)) {
            return res.status(401).json({ error: 'Email, số điện thoại hoặc mật khẩu không chính xác.' });
        }

        const customer = { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar };
        // Regenerate the identifier after authentication so an anonymous session
        // cannot be fixed and reused as an authenticated one.
        // Regeneration prevents session fixation. Preserve the independent
        // administrator identity so a customer login cannot log out an admin.
        const existingAdmin = req.session.admin;
        const csrfToken = req.session.csrfToken;
        return req.session.regenerate(error => {
            if (error) return next(error);
            if (existingAdmin) req.session.admin = existingAdmin;
            if (csrfToken) req.session.csrfToken = csrfToken;
            req.session.customer = customer;
            return req.session.save(saveError => {
                if (saveError) return next(saveError);
                return res.json({ user: customer });
            });
        });
    } catch (error) {
        return next(error);
    }
}

function logout(req, res, next) {
    delete req.session.customer;
    return req.session.save(error => {
        if (error) return next(error);
        return res.json({ message: 'Đăng xuất thành công.' });
    });
}

module.exports = { register, login, logout };
