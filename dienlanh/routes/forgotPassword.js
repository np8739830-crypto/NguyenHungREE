const express = require('express');
const controller = require('../controllers/forgotPasswordController');
const { passwordResetRateLimit } = require('../middleware/passwordResetRateLimit');

const router = express.Router();
router.get('/', controller.showPage);
router.post('/', passwordResetRateLimit, controller.sendOtp);
router.post('/send-otp', passwordResetRateLimit, controller.sendOtp);
router.post('/resend-otp', passwordResetRateLimit, controller.sendOtp);
router.post('/verify-otp', controller.verifyOtp);
router.post('/reset', controller.resetPassword);

module.exports = router;
