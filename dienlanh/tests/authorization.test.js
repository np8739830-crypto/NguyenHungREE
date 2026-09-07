const test = require('node:test');
const assert = require('node:assert/strict');

const { can } = require('../services/authorizationService');
const { requirePermission } = require('../middleware/auth');

test('Administrator has every permission without storing wildcard rows in the session', () => {
    assert.equal(can({ roleSlug: 'administrator', permissions: [] }, 'accounts', 'delete'), true);
    assert.equal(can({ roleSlug: 'administrator', permissions: [] }, 'roles', 'update'), true);
});

test('staff permissions are action-specific', () => {
    const authorization = { roleSlug: 'staff', permissions: ['services.view', 'services.update'] };
    assert.equal(can(authorization, 'services', 'view'), true);
    assert.equal(can(authorization, 'services', 'update'), true);
    assert.equal(can(authorization, 'services', 'delete'), false);
    assert.equal(can(authorization, 'customers', 'view'), false);
});

test('backend middleware returns 403 when a direct URL action is not granted', () => {
    const middleware = requirePermission('customers', 'view');
    const req = { adminAuthorization: { roleSlug: 'staff', permissions: ['services.view'] }, originalUrl: '/admin/customers', headers: {}, get: () => '' };
    const res = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        render(view, data) { this.view = view; this.data = data; return this; }
    };
    middleware(req, res, () => assert.fail('next must not be called'));
    assert.equal(res.statusCode, 403);
    assert.equal(res.view, 'forbidden');
    assert.equal(res.data.requestedPermission, 'customers.view');
});
