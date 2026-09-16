const express = require('express');
const controller = require('../controllers/forgotPasswordController');
const { passwordResetRateLimit } = require('../middleware/passwordResetRateLimit');
const { rejectBots } = require('../middleware/security');

const router = express.Router();
router.get('/', controller.showPage);
router.post('/', passwordResetRateLimit, rejectBots, controller.sendOtp);
router.post('/send-otp', passwordResetRateLimit, rejectBots, controller.sendOtp);
router.post('/resend-otp', passwordResetRateLimit, rejectBots, controller.sendOtp);
router.post('/verify-otp', passwordResetRateLimit, rejectBots, controller.verifyOtp);
router.post('/reset', passwordResetRateLimit, rejectBots, controller.resetPassword);

module.exports = router;
