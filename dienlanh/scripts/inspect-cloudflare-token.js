'use strict';

require('dotenv').config({ override: true });

const headers = { Authorization: `Bearer ${process.env.CLOUDFLARE_D1_API_TOKEN}` };

async function cloudflare(path) {
    const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, { headers });
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error(payload.errors?.[0]?.message || `HTTP ${response.status}`);
    return payload.result;
}

async function main() {
    const verification = await cloudflare('/user/tokens/verify');
    console.log(`TOKEN_STATUS=${verification.status || 'unknown'}`);
    try {
        const details = await cloudflare(`/user/tokens/${verification.id}`);
        const requestIp = details.condition?.request_ip;
        console.log(`IP_RESTRICTED=${Boolean(requestIp?.in?.length || requestIp?.not_in?.length)}`);
        console.log(`EXPIRES=${details.expires_on || 'none'}`);
    } catch (error) {
        console.log(`TOKEN_DETAILS=UNAVAILABLE (${error.message})`);
    }
}

main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});
