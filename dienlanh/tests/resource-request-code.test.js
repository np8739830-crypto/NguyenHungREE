const test = require('node:test');
const assert = require('node:assert/strict');

let createCalls = 0;
let afterCreateCalls = 0;

class FakeCrudModel {
    async create() {
        createCalls += 1;
        return 42;
    }

    async find(id) {
        return { id, request_code: 'LH-20260826-0042' };
    }
}

const modelPath = require.resolve('../models/CrudModel');
const databasePath = require.resolve('../config/database');
const imageServicePath = require.resolve('../services/requestImageService');
const controllerPath = require.resolve('../controllers/resourceController');

require.cache[modelPath] = { id: modelPath, filename: modelPath, loaded: true, exports: FakeCrudModel };
require.cache[databasePath] = {
    id: databasePath,
    filename: databasePath,
    loaded: true,
    exports: { query: async () => ({ recordset: [] }) }
};
require.cache[imageServicePath] = {
    id: imageServicePath,
    filename: imageServicePath,
    loaded: true,
    exports: {
        validateImages() {},
        storeImages: async () => [],
        removeStoredImages: async () => {},
        createRequestImage: async () => true
    }
};
delete require.cache[controllerPath];

const { createResourceController } = require('../controllers/resourceController');

function responseRecorder() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
}

test.beforeEach(() => {
    createCalls = 0;
    afterCreateCalls = 0;
});

test('successful request returns the persisted code and sends one notification', async () => {
    const controller = createResourceController('contacts', ['name', 'phone', 'message'], {
        requiredFields: ['name', 'phone', 'message'],
        includeRequestCode: true,
        afterCreate: async (data, id) => {
            afterCreateCalls += 1;
            assert.equal(id, 42);
            assert.equal(data.request_code, 'LH-20260826-0042');
            return true;
        }
    });
    const response = responseRecorder();

    await controller.create({
        body: { name: 'Khách hàng', phone: '0904098307', message: 'Cần tư vấn' },
        files: []
    }, response, error => { throw error; });

    assert.equal(createCalls, 1);
    assert.equal(afterCreateCalls, 1);
    assert.equal(response.statusCode, 201);
    assert.equal(response.body.requestCode, 'LH-20260826-0042');
    assert.equal(response.body.telegramStatus, 'sent');
});

test('Telegram failure keeps the saved request code and returns pending', async () => {
    const controller = createResourceController('contacts', ['name', 'phone', 'message'], {
        requiredFields: ['name', 'phone', 'message'],
        includeRequestCode: true,
        afterCreate: async data => {
            afterCreateCalls += 1;
            assert.equal(data.request_code, 'LH-20260826-0042');
            return false;
        }
    });
    const response = responseRecorder();

    await controller.create({
        body: { name: 'Khách hàng', phone: '0904098307', message: 'Cần tư vấn' },
        files: []
    }, response, error => { throw error; });

    assert.equal(createCalls, 1);
    assert.equal(afterCreateCalls, 1);
    assert.equal(response.statusCode, 201);
    assert.equal(response.body.requestCode, 'LH-20260826-0042');
    assert.equal(response.body.telegramStatus, 'pending');
    assert.match(response.body.message, /đã được tiếp nhận/i);
});

test('validation failure creates no record, code, or Telegram notification', async () => {
    const controller = createResourceController('contacts', ['name', 'phone', 'message'], {
        requiredFields: ['name', 'phone', 'message'],
        includeRequestCode: true,
        afterCreate: async () => { afterCreateCalls += 1; return true; }
    });
    const response = responseRecorder();

    await controller.create({ body: { name: '', phone: '', message: '' }, files: [] }, response, error => { throw error; });

    assert.equal(response.statusCode, 400);
    assert.equal(createCalls, 0);
    assert.equal(afterCreateCalls, 0);
    assert.equal(response.body.requestCode, undefined);
});
