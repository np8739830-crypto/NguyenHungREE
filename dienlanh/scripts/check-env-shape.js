'use strict';

const fs = require('fs');
const crypto = require('crypto');
const dotenv = require('dotenv');
const source = fs.readFileSync('.env', 'utf8');
const parsed = dotenv.parse(source);

for (const key of ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_D1_DATABASE_ID', 'CLOUDFLARE_D1_API_TOKEN']) {
    const line = source.split(/\r?\n/).find(value => value.startsWith(`${key}=`)) || '';
    const raw = line.slice(key.length + 1).trim().replace(/^['"]|['"]$/g, '');
    const hash = crypto.createHash('sha256').update(parsed[key] || '').digest('hex');
    console.log(`${key} DOTENV_LENGTH=${parsed[key]?.length || 0} RAW_LENGTH=${raw.length} MATCH=${parsed[key] === raw} SHA256=${hash}`);
}
