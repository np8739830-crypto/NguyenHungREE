const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const multer = require('multer');
const { query } = require('../config/database');
const { isBlobEnabled, uploadBuffer, deleteBlob } = require('./blobStorageService');

const MAX_IMAGES = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const TYPES = {
    'image/jpeg': { extensions: ['.jpg', '.jpeg'], signature: buffer => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff, extension: '.jpg' },
    'image/png': { extensions: ['.png'], signature: buffer => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), extension: '.png' },
    'image/webp': { extensions: ['.webp'], signature: buffer => buffer.length >= 12 && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP', extension: '.webp' }
};
const requestImageDirectory = process.env.VERCEL
    ? path.join('/tmp', 'request-images')
    : path.join(__dirname, '../private/request-images');

const uploadRequestImages = multer({
    storage: multer.memoryStorage(), limits: { files: MAX_IMAGES, fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, callback) => {
        const type = TYPES[file.mimetype];
        if (!type || !type.extensions.includes(path.extname(file.originalname).toLowerCase())) return callback(new Error('Chỉ chấp nhận ảnh JPG, JPEG, PNG hoặc WEBP.'));
        callback(null, true);
    }
}).array('images', MAX_IMAGES);

function validateImages(files = []) {
    if (files.length > MAX_IMAGES) throw new Error('Chỉ được tải tối đa 3 ảnh.');
    for (const file of files) {
        const type = TYPES[file.mimetype];
        if (!type || file.size > MAX_FILE_SIZE || !type.signature(file.buffer)) throw new Error('Tệp tải lên không phải ảnh JPG, JPEG, PNG hoặc WEBP hợp lệ.');
    }
}

async function storeImages(requestType, requestId, files = []) {
    validateImages(files);
    const directory = requestImageDirectory;
    await fs.mkdir(directory, { recursive: true });
    const saved = [];
    try {
        for (const file of files) {
            const filename = `${requestType}-${requestId}-${crypto.randomBytes(20).toString('hex')}${TYPES[file.mimetype].extension}`;
            if (isBlobEnabled()) await uploadBuffer(`request-images/${filename}`, file.buffer, file.mimetype);
            else await fs.writeFile(path.join(directory, filename), file.buffer, { flag: 'wx' });
            saved.push({ filename, mime_type: file.mimetype, size_bytes: file.size });
        }
        return saved;
    } catch (error) {
        await removeStoredImages(saved.map(item => item.filename));
        throw error;
    }
}

async function removeStoredImages(filenames = []) {
    await Promise.all(filenames.map(filename => isBlobEnabled()
        ? deleteBlob(`request-images/${filename}`).catch(() => {})
        : fs.unlink(path.join(requestImageDirectory, filename)).catch(() => {})));
}

function isMissingRequestImagesTable(error) {
    return error?.number === 208 || /Invalid object name ['\"]?(?:dbo\.)?request_images/i.test(error?.message || '');
}

// Attachments are optional. A database that has not run the image migration
// must still be able to display and create bookings/contacts.
async function getRequestImages(requestType, requestId = null) {
    try {
        const result = await query(
            `SELECT id, request_id FROM dbo.request_images
             WHERE request_type = @requestType
               AND (@requestId IS NULL OR request_id = @requestId)
             ORDER BY id`,
            { requestType, requestId }
        );
        return result.recordset;
    } catch (error) {
        if (isMissingRequestImagesTable(error)) return [];
        throw error;
    }
}

async function getRequestImageById(id) {
    try {
        const result = await query(
            'SELECT id, request_type, request_id, filename, mime_type FROM dbo.request_images WHERE id = @id',
            { id }
        );
        return result.recordset[0] || null;
    } catch (error) {
        if (isMissingRequestImagesTable(error)) return null;
        throw error;
    }
}

async function createRequestImage(image) {
    try {
        await query(`INSERT INTO dbo.request_images
                        (request_type, request_id, booking_id, contact_id, filename, mime_type, size_bytes)
                     VALUES
                        (@requestType, @requestId, @bookingId, @contactId, @filename, @mimeType, @sizeBytes)`, image);
        return true;
    } catch (error) {
        if (isMissingRequestImagesTable(error)) return false;
        throw error;
    }
}

module.exports = { MAX_IMAGES, MAX_FILE_SIZE, uploadRequestImages, validateImages, storeImages, removeStoredImages, getRequestImages, getRequestImageById, createRequestImage };
