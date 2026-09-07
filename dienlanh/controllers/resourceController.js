const CrudModel = require('../models/CrudModel');
const { query } = require('../config/database');
const { storeImages, removeStoredImages, validateImages, createRequestImage } = require('../services/requestImageService');

const FIELD_MESSAGES = {
    fullname: 'Vui lòng nhập họ và tên.',
    phone: 'Vui lòng nhập số điện thoại.',
    email: 'Vui lòng nhập email.',
    address: 'Vui lòng nhập địa chỉ.',
    device_type: 'Vui lòng chọn loại thiết bị.',
    service_type: 'Vui lòng chọn dịch vụ.',
    serviceId: 'Thiếu trường serviceId.',
    booking_date: 'Vui lòng chọn ngày hẹn.',
    booking_time: 'Vui lòng chọn giờ hẹn.',
    description: 'Vui lòng mô tả tình trạng thiết bị.',
    name: 'Vui lòng nhập họ và tên.',
    message: 'Vui lòng nhập nội dung.',
    subject: 'Vui lòng chọn chủ đề.'
};

function getMissingFieldMessage(fieldName) {
    return FIELD_MESSAGES[fieldName] || `Thiếu trường ${fieldName}.`;
}

function createResourceController(table, fields, options = {}) {
    const model = new CrudModel(table);

    return {
        async list(req, res, next) {
            try {
                return res.json(await model.all(options.where || '1=1', {}, options.orderBy || 'id DESC'));
            } catch (error) {
                return next(error);
            }
        },

        async detail(req, res, next) {
            try {
                const item = await model.find(req.params.id);
                if (!item) return res.status(404).json({ error: 'Không tìm thấy dữ liệu.' });
                return res.json(item);
            } catch (error) {
                return next(error);
            }
        },

        async create(req, res, next) {
            let storedImages = [];
            let itemId;
            let requestCode = null;
            let notificationSent = null;
            try {
                validateImages(req.files || []);

                const requiredFields = options.requiredFields || fields;
                const missingFields = requiredFields.filter(field => {
                    const value = req.body[field];
                    return value === undefined || value === null || (typeof value === 'string' && !value.trim());
                });

                if (missingFields.length) {
                    const fieldErrors = Object.fromEntries(
                        missingFields.map(field => [field, getMissingFieldMessage(field)])
                    );

                    return res.status(400).json({
                        error: getMissingFieldMessage(missingFields[0]),
                        fields: missingFields,
                        fieldErrors
                    });
                }

                const data = Object.fromEntries(fields
                    .filter(field => {
                        const value = req.body[field];
                        if (value === undefined || value === null) return false;
                        if (typeof value === 'string' && !value.trim()) return false;
                        return true;
                    })
                    .map(field => [field, req.body[field]]));
                itemId = typeof options.createItem === 'function'
                    ? await options.createItem(data)
                    : await model.create(data);

                if (options.includeRequestCode) {
                    const savedItem = await model.find(itemId);
                    requestCode = savedItem?.request_code || null;
                    if (!requestCode) throw new Error(`Request code was not generated for ${table} item ${itemId}.`);
                    data.request_code = requestCode;
                }

                if (options.imageRequestType && req.files?.length) {
                    storedImages = await storeImages(options.imageRequestType, itemId, req.files);
                    for (const image of storedImages) {
                        const imageSaved = await createRequestImage({
                            requestType: options.imageRequestType, requestId: itemId,
                            bookingId: options.imageRequestType === 'booking' ? itemId : null,
                            contactId: options.imageRequestType === 'contact' ? itemId : null,
                            filename: image.filename, mimeType: image.mime_type, sizeBytes: image.size_bytes
                        });
                        if (!imageSaved) {
                            await removeStoredImages(storedImages.map(storedImage => storedImage.filename));
                            break;
                        }
                    }
                }

                // Pass the saved attachment metadata to post-create handlers.
                // This lets Telegram send the uploaded photos immediately even
                // when the optional request_images migration has not yet been run.
                if (storedImages.length) data._storedImages = storedImages.map(image => ({
                    filename: image.filename,
                    mime_type: image.mime_type,
                    size_bytes: image.size_bytes
                }));

                if (typeof options.afterCreate === 'function') {
                    try {
                        const afterCreateResult = await options.afterCreate(data, itemId);
                        notificationSent = afterCreateResult !== false;
                        if (afterCreateResult === false) {
                            console.error(`Post-create notification failed for ${table} item ${itemId}.`);
                        }
                    } catch (error) {
                        // A notification failure must never undo a successfully saved request.
                        notificationSent = false;
                        console.error(`Post-create action failed for ${table}:`, error);
                    }
                }

                return res.status(201).json({
                    id: itemId,
                    requestCode,
                    telegramStatus: notificationSent === false ? 'pending' : 'sent',
                    message: notificationSent === false
                        ? 'Yêu cầu đã được tiếp nhận, thông báo Telegram đang chờ xử lý.'
                        : 'Gửi yêu cầu thành công.'
                });
            } catch (error) {
                await removeStoredImages(storedImages.map(image => image.filename));
                // Do not leave a request that failed while its attachments were being saved.
                if (itemId) {
                    try { await query(`DELETE FROM ${table} WHERE id = @id`, { id: itemId }); } catch (cleanupError) { console.error('Could not roll back failed request:', cleanupError); }
                }
                if (error.statusCode) {
                    return res.status(error.statusCode).json({ success: false, message: error.message });
                }
                return next(error);
            }
        }
    };
}

module.exports = { createResourceController };
