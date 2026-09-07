const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { isBcryptHash } = require('../scripts/hash-existing-passwords');

test('recognizes bcrypt hashes and rejects plaintext passwords', async () => {
    const hash = await bcrypt.hash('a secure password', 4);

    assert.equal(isBcryptHash(hash), true);
    assert.equal(isBcryptHash('a secure password'), false);
    assert.equal(isBcryptHash(''), false);
    assert.equal(isBcryptHash(null), false);
});
