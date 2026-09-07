const { query } = require('../config/database');

async function page(req, res, next) {
    try {
        const status = ['pending', 'approved', 'hidden'].includes(req.query.status) ? req.query.status : '';
        const rating = /^[1-5]$/.test(String(req.query.rating || '')) ? Number(req.query.rating) : null;
        const conditions = [];
        const params = {};
        if (status) { conditions.push('r.status = @status'); params.status = status; }
        if (rating) { conditions.push('r.rating = @rating'); params.rating = rating; }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const result = await query(`SELECT r.id, r.name, r.contact, r.rating, r.content, r.service_name,
                r.status, r.created_at, r.booking_id, r.attitude_rating, r.punctuality_rating,
                r.technical_rating, r.explanation_rating, r.cleanliness_rating, r.is_recommended,
                u.email AS account_email, t.full_name AS technician_name, b.request_code
            FROM reviews r LEFT JOIN users u ON u.id = r.user_id
            LEFT JOIN technicians t ON t.id = r.technician_id
            LEFT JOIN bookings b ON b.id = r.booking_id
            ${where} ORDER BY r.created_at DESC, r.id DESC`, params);
        return res.render('reviews', { title: 'Quản lý đánh giá - NGUYÊN HÙNG', reviews: result.recordset,
            selectedStatus: status, selectedRating: rating });
    } catch (error) { return next(error); }
}

async function update(req, res, next) {
    try {
        const status = ['approved', 'hidden'].includes(req.body.status) ? req.body.status : null;
        if (!status) {
            req.flash('error', 'Trạng thái đánh giá không hợp lệ.');
            return res.redirect('/admin/reviews');
        }
        const result = await query('UPDATE reviews SET status = @status, updated_at = GETDATE() WHERE id = @id', { id: req.params.id, status });
        req.flash(result.rowsAffected?.[0] ? 'success' : 'error', result.rowsAffected?.[0] ? 'Đã cập nhật đánh giá.' : 'Không tìm thấy đánh giá.');
        return res.redirect('/admin/reviews');
    } catch (error) { return next(error); }
}

async function remove(req, res, next) {
    try {
        const result = await query('DELETE FROM reviews WHERE id = @id', { id: req.params.id });
        req.flash(result.rowsAffected?.[0] ? 'success' : 'error', result.rowsAffected?.[0] ? 'Đã xóa đánh giá.' : 'Không tìm thấy đánh giá.');
        return res.redirect('/admin/reviews');
    } catch (error) { return next(error); }
}

module.exports = { page, update, remove };
