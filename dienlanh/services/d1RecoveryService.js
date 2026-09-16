'use strict';

function config() {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
    const apiToken = process.env.CLOUDFLARE_D1_API_TOKEN;
    if (!accountId || !databaseId || !apiToken) throw new Error('Cloudflare D1 recovery is not configured.');
    return { accountId, databaseId, apiToken };
}

async function cloudflareRequest(pathname, options = {}) {
    const { accountId, databaseId, apiToken } = config();
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}${pathname}`, {
        ...options,
        headers: { Authorization: `Bearer ${apiToken}`, ...(options.headers || {}) },
        signal: AbortSignal.timeout(20000)
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
        throw new Error(payload?.errors?.[0]?.message || `Cloudflare recovery API HTTP ${response.status}`);
    }
    return payload.result;
}

async function getCurrentBookmark(timestamp = null) {
    const query = timestamp ? `?timestamp=${encodeURIComponent(timestamp)}` : '';
    return cloudflareRequest(`/time_travel/bookmark${query}`);
}

async function restoreToPoint({ timestamp, bookmark, confirmation }) {
    if (confirmation !== 'RESTORE_D1_PRODUCTION') throw new Error('Explicit restore confirmation is required.');
    if (!timestamp && !bookmark) throw new Error('A timestamp or bookmark is required.');
    const query = timestamp
        ? `?timestamp=${encodeURIComponent(timestamp)}`
        : `?bookmark=${encodeURIComponent(bookmark)}`;
    return cloudflareRequest(`/time_travel/restore${query}`, { method: 'POST' });
}

module.exports = { getCurrentBookmark, restoreToPoint };
