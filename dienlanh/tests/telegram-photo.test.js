const test = require('node:test');
const assert = require('node:assert/strict');
const { sendTelegramPhoto } = require('../services/telegramService');

test('Telegram photo upload accepts an in-memory serverless upload', async t => {
    const previousToken = process.env.TELEGRAM_BOT_TOKEN;
    const previousChatId = process.env.TELEGRAM_CHAT_ID;
    const previousFetch = global.fetch;

    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    process.env.TELEGRAM_CHAT_ID = 'test-chat';

    global.fetch = async (url, options) => {
        assert.match(url, /\/sendPhoto$/);
        assert.equal(options.method, 'POST');
        assert.equal(options.body.get('chat_id'), 'test-chat');

        const photo = options.body.get('photo');
        assert.equal(photo.name, 'booking-1-test.png');
        assert.equal(photo.type, 'image/png');
        assert.deepEqual(Buffer.from(await photo.arrayBuffer()), Buffer.from('image-bytes'));
        return { ok: true, json: async () => ({ ok: true }) };
    };

    t.after(() => {
        global.fetch = previousFetch;
        if (previousToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
        else process.env.TELEGRAM_BOT_TOKEN = previousToken;
        if (previousChatId === undefined) delete process.env.TELEGRAM_CHAT_ID;
        else process.env.TELEGRAM_CHAT_ID = previousChatId;
    });

    const sent = await sendTelegramPhoto({
        filename: 'booking-1-test.png',
        mime_type: 'image/png',
        buffer: Buffer.from('image-bytes')
    }, 'Ảnh kiểm thử');

    assert.equal(sent, true);
});
