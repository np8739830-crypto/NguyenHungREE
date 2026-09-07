require('dotenv').config();

const bcrypt = require('bcryptjs');
const { getConnection, sql } = require('../config/database');

const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

function isBcryptHash(value) {
    return typeof value === 'string' && BCRYPT_HASH_PATTERN.test(value);
}

async function hashExistingPasswords() {
    const connection = await getConnection();
    const result = await connection.request().query(
        'SELECT id, password_hash FROM dbo.users WHERE password_hash IS NOT NULL'
    );

    const legacyUsers = result.recordset.filter(user => !isBcryptHash(user.password_hash));
    let updated = 0;

    for (const user of legacyUsers) {
        const plainPassword = String(user.password_hash);
        const passwordHash = await bcrypt.hash(plainPassword, 12);
        const update = await connection.request()
            .input('id', sql.Int, user.id)
            .input('oldPassword', sql.NVarChar(255), plainPassword)
            .input('passwordHash', sql.NVarChar(255), passwordHash)
            .query(`UPDATE dbo.users
                    SET password_hash = @passwordHash, updated_at = GETDATE()
                    WHERE id = @id AND password_hash = @oldPassword`);

        updated += update.rowsAffected[0] || 0;
    }

    return { scanned: result.recordset.length, legacy: legacyUsers.length, updated };
}

async function main() {
    try {
        const result = await hashExistingPasswords();
        console.log(`Password migration complete: scanned=${result.scanned}, plaintext=${result.legacy}, hashed=${result.updated}.`);
    } finally {
        await sql.close().catch(() => {});
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('Password migration failed:', error.message);
        process.exitCode = 1;
    });
}

module.exports = { BCRYPT_HASH_PATTERN, isBcryptHash, hashExistingPasswords };
