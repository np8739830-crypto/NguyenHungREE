'use strict';

const session = require('express-session');
const { query } = require('../config/database');

class SqlSessionStore extends session.Store {
    constructor(options = {}) {
        super();
        this.ttl = Number(options.ttl) || 24 * 60 * 60 * 1000;
        this.ready = query(`IF OBJECT_ID(N'dbo.app_sessions', N'U') IS NULL
            BEGIN
                CREATE TABLE dbo.app_sessions (
                    sid NVARCHAR(255) PRIMARY KEY,
                    data NVARCHAR(MAX) NOT NULL,
                    expires_at BIGINT NOT NULL,
                    updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
                );
                CREATE INDEX IX_app_sessions_expires_at ON dbo.app_sessions(expires_at);
            END`);
        this.ready.catch(() => {});
    }

    expiry(value) {
        const expires = value?.cookie?.expires ? new Date(value.cookie.expires).getTime() : 0;
        return Number.isFinite(expires) && expires > Date.now() ? expires : Date.now() + this.ttl;
    }

    async run(callback, operation) {
        try {
            await this.ready;
            callback(null, await operation());
        } catch (error) { callback(error); }
    }

    get(sid, callback) {
        this.run(callback, async () => {
            const row = (await query('SELECT data FROM dbo.app_sessions WHERE sid=@sid AND expires_at>@now', { sid, now: Date.now() })).recordset[0];
            if (!row) return null;
            try { return JSON.parse(row.data); } catch {
                await query('DELETE FROM dbo.app_sessions WHERE sid=@sid', { sid });
                return null;
            }
        });
    }

    set(sid, value, callback = () => {}) {
        this.run(callback, () => query(`MERGE dbo.app_sessions AS target
            USING (SELECT @sid sid) AS source ON target.sid=source.sid
            WHEN MATCHED THEN UPDATE SET data=@data,expires_at=@expires,updated_at=SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT(sid,data,expires_at) VALUES(@sid,@data,@expires);`,
        { sid, data: JSON.stringify(value), expires: this.expiry(value) }));
    }

    destroy(sid, callback = () => {}) {
        this.run(callback, () => query('DELETE FROM dbo.app_sessions WHERE sid=@sid', { sid }));
    }

    touch(sid, value, callback = () => {}) {
        this.run(callback, () => query('UPDATE dbo.app_sessions SET expires_at=@expires,updated_at=SYSUTCDATETIME() WHERE sid=@sid', { sid, expires: this.expiry(value) }));
    }
}

module.exports = SqlSessionStore;
