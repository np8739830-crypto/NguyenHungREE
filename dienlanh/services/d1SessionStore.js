'use strict';

const session = require('express-session');
const { requestD1 } = require('../config/d1Database');

class D1SessionStore extends session.Store {
    constructor(options = {}) {
        super();
        this.ttl = Number(options.ttl) || 24 * 60 * 60 * 1000;
        this.ready = requestD1(`
            CREATE TABLE IF NOT EXISTS app_sessions (
                sid TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                expires_at INTEGER NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `).then(() => requestD1(
            'CREATE INDEX IF NOT EXISTS ix_app_sessions_expires_at ON app_sessions(expires_at)'
        ));
    }

    expiry(value) {
        const cookieExpiry = value?.cookie?.expires ? new Date(value.cookie.expires).getTime() : 0;
        return Number.isFinite(cookieExpiry) && cookieExpiry > Date.now()
            ? cookieExpiry
            : Date.now() + this.ttl;
    }

    async execute(callback, operation) {
        try {
            await this.ready;
            callback(null, await operation());
        } catch (error) {
            callback(error);
        }
    }

    get(sid, callback) {
        this.execute(callback, async () => {
            const result = await requestD1(
                'SELECT data FROM app_sessions WHERE sid = ? AND expires_at > ?',
                [sid, Date.now()]
            );
            if (!result.results?.[0]) return null;
            try {
                return JSON.parse(result.results[0].data);
            } catch {
                await requestD1('DELETE FROM app_sessions WHERE sid = ?', [sid]);
                return null;
            }
        });
    }

    set(sid, value, callback = () => {}) {
        this.execute(callback, async () => {
            await requestD1(`
                INSERT INTO app_sessions (sid, data, expires_at, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(sid) DO UPDATE SET
                    data = excluded.data,
                    expires_at = excluded.expires_at,
                    updated_at = CURRENT_TIMESTAMP
            `, [sid, JSON.stringify(value), this.expiry(value)]);
        });
    }

    destroy(sid, callback = () => {}) {
        this.execute(callback, async () => {
            await requestD1('DELETE FROM app_sessions WHERE sid = ?', [sid]);
        });
    }

    touch(sid, value, callback = () => {}) {
        this.execute(callback, async () => {
            await requestD1(
                'UPDATE app_sessions SET expires_at = ?, updated_at = CURRENT_TIMESTAMP WHERE sid = ?',
                [this.expiry(value), sid]
            );
        });
    }

    clear(callback = () => {}) {
        this.execute(callback, async () => {
            await requestD1('DELETE FROM app_sessions');
        });
    }
}

module.exports = D1SessionStore;
