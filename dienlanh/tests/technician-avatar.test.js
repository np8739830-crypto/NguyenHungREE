const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const express = require('express');
const database = require('../config/database');

function responseDouble() {
    return {
        redirectPath: null,
        redirect(path) { this.redirectPath = path; return this; }
    };
}

test('updating a technician stores a new uploaded avatar path', async () => {
    const originalQuery = database.query;
    let update;
    database.query = async (statement, params) => {
        update = { statement, params };
        return { rowsAffected: [1], recordset: [] };
    };
    delete require.cache[require.resolve('../controllers/adminController')];
    const { updateTechnician } = require('../controllers/adminController');
    const req = {
        params: { id: '2' },
        body: { full_name: 'Nguyễn Công Hào', phone: '0397268860', email: '', specialty: '', experience: '25 năm', service_area: '', work_status: 'available' },
        file: { filename: 'avatar-1-123456.webp' },
        flash() {}
    };
    const res = responseDouble();

    try {
        await updateTechnician(req, res, assert.fail);
        assert.match(update.statement, /avatar=COALESCE\(@avatar, avatar\)/);
        assert.equal(update.params.avatar, '/uploads/avatar-1-123456.webp');
        assert.equal(res.redirectPath, '/admin/technicians');
    } finally {
        database.query = originalQuery;
        delete require.cache[require.resolve('../controllers/adminController')];
    }
});

test('updating without a new file keeps the existing technician avatar', async () => {
    const originalQuery = database.query;
    let update;
    database.query = async (statement, params) => {
        update = { statement, params };
        return { rowsAffected: [1], recordset: [] };
    };
    delete require.cache[require.resolve('../controllers/adminController')];
    const { updateTechnician } = require('../controllers/adminController');
    const req = {
        params: { id: '2' },
        body: { full_name: 'Nguyễn Công Hào', phone: '0397268860', email: '', specialty: '', experience: '', service_area: '', work_status: 'available' },
        flash() {}
    };
    const res = responseDouble();

    try {
        await updateTechnician(req, res, assert.fail);
        assert.match(update.statement, /avatar=COALESCE\(@avatar, avatar\)/);
        assert.equal(update.params.avatar, null);
        assert.equal(res.redirectPath, '/admin/technicians');
    } finally {
        database.query = originalQuery;
        delete require.cache[require.resolve('../controllers/adminController')];
    }
});

test('multipart technician update preserves session and passes CSRF after Multer parses the form', async () => {
    const originalQuery = database.query;
    let update;
    let uploadedFile;
    database.query = async (statement, params) => {
        if (/FROM dbo\.users u\s+LEFT JOIN dbo\.roles/i.test(statement)) {
            return { recordset: [{
                id: 1, username: 'admin', name: 'Admin', email: 'admin@example.com',
                status: 'active', role_id: 1, role_slug: 'administrator', role_name: 'Administrator',
                module_key: 'technicians', action_key: 'update'
            }] };
        }
        if (/UPDATE dbo\.technicians/i.test(statement)) update = { statement, params };
        return { rowsAffected: [1], recordset: [] };
    };
    delete require.cache[require.resolve('../controllers/adminController')];
    delete require.cache[require.resolve('../routes/admin')];
    const adminRouter = require('../routes/admin');
    const app = express();
    app.use((req, res, next) => {
        req.session = {
            admin: { id: 1, role: 'admin', name: 'Admin' },
            csrfToken: 'valid-technician-token'
        };
        req.flash = () => {};
        res.locals = {};
        next();
    });
    app.use('/admin', adminRouter);
    const server = await new Promise(resolve => {
        const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });

    try {
        const form = new FormData();
        form.append('_csrf', 'valid-technician-token');
        form.append('full_name', 'Nguyễn Công Hào cập nhật');
        form.append('phone', '0397268860');
        form.append('email', 'hao@example.com');
        form.append('specialty', 'Điện lạnh');
        form.append('experience', '25 năm');
        form.append('service_area', 'TP.HCM');
        form.append('work_status', 'available');
        const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
        form.append('avatar', new Blob([png], { type: 'image/png' }), 'avatar-test.png');

        const { port } = server.address();
        const response = await fetch(`http://127.0.0.1:${port}/admin/technicians/2`, {
            method: 'POST',
            body: form,
            redirect: 'manual'
        });

        assert.equal(response.status, 302);
        assert.equal(response.headers.get('location'), '/admin/technicians');
        assert.equal(update.params.fullName, 'Nguyễn Công Hào cập nhật');
        assert.equal(update.params.phone, '0397268860');
        assert.match(update.params.avatar, /^\/uploads\/avatar-1-\d+\.png$/);
        uploadedFile = path.resolve(__dirname, '../public', update.params.avatar.replace(/^\//, '').replace(/^uploads[\\/]/, 'uploads/'));
        const stat = await fs.stat(uploadedFile);
        assert.ok(stat.size > 0);
    } finally {
        if (uploadedFile) await fs.unlink(uploadedFile).catch(() => {});
        await new Promise(resolve => server.close(resolve));
        database.query = originalQuery;
        delete require.cache[require.resolve('../controllers/adminController')];
        delete require.cache[require.resolve('../routes/admin')];
    }
});
