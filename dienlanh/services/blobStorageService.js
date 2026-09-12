'use strict';

const fs = require('fs/promises');
const path = require('path');
const { Readable } = require('stream');

function isBlobEnabled() {
    return Boolean(process.env.VERCEL && (
        process.env.BLOB_READ_WRITE_TOKEN ||
        (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID)
    ));
}

function blobSdk() {
    return require('@vercel/blob');
}

async function uploadBuffer(pathname, buffer, contentType) {
    if (!isBlobEnabled()) throw new Error('Vercel Blob chưa được cấu hình.');
    return blobSdk().put(pathname, buffer, {
        access: 'private',
        contentType,
        addRandomSuffix: false
    });
}

async function persistMulterFile(file, filename) {
    if (!file || !isBlobEnabled()) return file;
    const body = file.buffer || await fs.readFile(file.path);
    await uploadBuffer(`public-uploads/${filename}`, body, file.mimetype);
    if (file.path) await fs.unlink(file.path).catch(() => {});
    file.filename = filename;
    file.path = null;
    return file;
}

async function deleteBlob(pathname) {
    if (isBlobEnabled()) await blobSdk().del(pathname);
}

async function pipeBlob(pathname, res) {
    if (!isBlobEnabled()) return false;
    const result = await blobSdk().get(pathname, { access: 'private' });
    if (!result || result.statusCode !== 200 || !result.stream) return false;
    res.setHeader('Content-Type', result.blob.contentType || 'application/octet-stream');
    res.setHeader('Content-Length', String(result.blob.size));
    res.setHeader('Cache-Control', result.blob.cacheControl || 'private, max-age=3600');
    Readable.fromWeb(result.stream).pipe(res);
    return true;
}

function safeFilename(value) {
    const filename = path.basename(String(value || ''));
    return filename && filename === value ? filename : null;
}

module.exports = {
    isBlobEnabled,
    uploadBuffer,
    persistMulterFile,
    deleteBlob,
    pipeBlob,
    safeFilename
};
