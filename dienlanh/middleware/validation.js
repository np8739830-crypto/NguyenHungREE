/**
 * Server-side validation middleware
 */

const Validator = {
    // Validate required fields
    required(fields, body) {
        const errors = [];
        fields.forEach(field => {
            if (!body[field] || (typeof body[field] === 'string' && !body[field].trim())) {
                errors.push({ field, message: `Vui lòng nhập ${field}` });
            }
        });
        return errors;
    },

    // Validate email
    email(value) {
        if (!value) return null;
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!regex.test(value)) {
            return 'Email không hợp lệ';
        }
        return null;
    },

    // Validate phone (Vietnamese format)
    phone(value) {
        if (!value) return null;
        const regex = /(0[3|5|7|8|9])+([0-9]{8})\b/;
        if (!regex.test(value)) {
            return 'Số điện thoại không hợp lệ';
        }
        return null;
    },

    // Validate min length
    minLength(value, min, fieldName) {
        if (!value) return null;
        if (value.length < min) {
            return `${fieldName} phải có ít nhất ${min} ký tự`;
        }
        return null;
    },

    // Validate password match
    match(password, confirm) {
        if (password !== confirm) {
            return 'Mật khẩu xác nhận không khớp';
        }
        return null;
    },

    // Sanitize string (prevent XSS)
    sanitize(str) {
        if (typeof str !== 'string') return str;
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '<')
            .replace(/>/g, '>')
            .replace(/"/g, '"')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    },

    // Sanitize object recursively
    sanitizeObject(obj) {
        if (typeof obj !== 'object' || obj === null) return obj;
        const sanitized = {};
        Object.keys(obj).forEach(key => {
            sanitized[key] = typeof obj[key] === 'string' ? this.sanitize(obj[key]) : obj[key];
        });
        return sanitized;
    }
};

// Express middleware for form validation
function validate(rules) {
    return (req, res, next) => {
        const errors = [];
        const body = req.body || {};

        rules.forEach(rule => {
            const { field, type, minLength, match: matchField, required } = rule;
            const value = body[field];

            if (required && (!value || !value.trim())) {
                errors.push({ field, message: rule.message || `Vui lòng nhập ${field}` });
                return;
            }

            if (value && value.trim()) {
                if (type === 'email') {
                    const err = Validator.email(value);
                    if (err) errors.push({ field, message: err });
                }
                if (type === 'phone') {
                    const err = Validator.phone(value);
                    if (err) errors.push({ field, message: err });
                }
                if (minLength) {
                    const err = Validator.minLength(value, minLength, field);
                    if (err) errors.push({ field, message: err });
                }
                if (matchField) {
                    const err = Validator.match(value, body[matchField]);
                    if (err) errors.push({ field, message: err });
                }
            }
        });

        if (errors.length > 0) {
            if (req.xhr || req.headers['content-type']?.includes('json')) {
                return res.status(400).json({ errors });
            }
            req.flash('error', errors[0].message);
            return res.redirect('back');
        }

        // Sanitize body
        req.body = Validator.sanitizeObject(body);
        next();
    };
}

module.exports = { Validator, validate };
