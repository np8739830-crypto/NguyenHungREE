// ============================================
// ĐIỆN LẠNH NGUYÊN HÙNG - Main Server Entry
// Node.js + Express + SQL Server
// ============================================

require('dotenv').config({ override: true });
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const flash = require('connect-flash');
const os = require('os');
const fs = require('fs');
const path = require('path');
const morgan = require('morgan');
const methodOverride = require('method-override');
const cookieParser = require('cookie-parser');
const { testConnection } = require('./config/database');
const { runRbacMigration } = require('./services/rbacMigrationService');
const { runPasswordResetMigration } = require('./services/passwordResetMigrationService');
const { runReviewMigration } = require('./services/reviewMigrationService');
const { runRequestCodeMigration } = require('./services/requestCodeMigrationService');
const { runContactOwnershipMigration } = require('./services/contactOwnershipMigrationService');
const { runPayrollMigration } = require('./services/payrollMigrationService');
const { runAttendanceMigration } = require('./services/attendanceMigrationService');
const { setUserLocals, csrfProtect } = require('./middleware/auth');

const app = express();
const PORT = Number(process.env.PORT) || 5000;
// Bind to every network interface so devices on the same LAN can reach the app.
const HOST = process.env.HOST || '0.0.0.0';
const staticSite = path.resolve(__dirname, '../dienlanh- web');
const legacyAdmin = path.resolve(__dirname, '../admin');

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET is required when NODE_ENV=production');
}

function getLanIPv4Addresses() {
    const privateIPv4 = address => /^10\./.test(address) || /^192\.168\./.test(address) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(address);
    const candidates = Object.entries(os.networkInterfaces()).flatMap(([name, addresses]) =>
        (addresses || [])
            .filter(address => address.family === 'IPv4' && !address.internal && privateIPv4(address.address))
            .map(address => ({ name, address: address.address }))
    );
    const physical = candidates.filter(({ name }) => !/(virtual|vethernet|wsl|hyper-v|virtualbox|loopback)/i.test(name));
    return [...new Set((physical.length ? physical : candidates).map(item => item.address))];
}

// Secure cookies must trust the TLS-terminating proxy in production.
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

// Allow the static frontend to be previewed from localhost or another device
// on the private LAN (for example by VS Code Live Server).
app.use((req, res, next) => {
    const origin = req.get('origin');
    const isPrivateLanOrigin = value => {
        try {
            const hostname = new URL(value).hostname;
            return hostname === 'localhost' || hostname === '127.0.0.1' ||
                /^10\./.test(hostname) || /^192\.168\./.test(hostname) ||
                /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
        } catch {
            return false;
        }
    };

    if (origin && isPrivateLanOrigin(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
});

// ===== VIEW ENGINE =====
app.set('view engine', 'ejs');
app.engine('html', require('ejs').renderFile);
app.set('views', [
    path.join(__dirname, 'views'),
    path.join(__dirname, 'admin/views'),
    path.join(legacyAdmin, 'html')
]);

// ===== MIDDLEWARE =====
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(cookieParser());

// Static files
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/admin/css', express.static(path.join(legacyAdmin, 'css')));
app.use('/admin/js', express.static(path.join(legacyAdmin, 'js')));
// Existing Admin templates use ../css/1.css and ../js/1.js. Keep those asset
// URLs working when a template is rendered from an MVC route such as /admin/orders.
app.get('/css/1.css', (req, res) => res.sendFile(path.join(legacyAdmin, 'css', '1.css')));
app.get('/js/1.js', (req, res) => res.sendFile(path.join(legacyAdmin, 'js', '1.js')));
// Admin HTML files are EJS templates, never public static files. Serving this
// directory made EJS tags appear as plain text and allowed directory browsing.
app.get('/admin/html/:file', (req, res) => res.redirect(302, '/admin'));
app.get('/admin/html', (req, res) => res.redirect(302, '/admin'));
app.use('/css', express.static(path.join(staticSite, 'css')));
app.use('/js', express.static(path.join(staticSite, 'js')));
app.use('/images', express.static(path.join(staticSite, 'images')));

// Keep production sessions across process restarts. The default in-memory
// store remains useful for local development and automated tests.
const sessionOptions = {
    secret: process.env.SESSION_SECRET || 'local-development-only-change-me',
    resave: false,
    saveUninitialized: false,
    name: 'dienlanh.sid',
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
};

if (process.env.NODE_ENV === 'production') {
    // Vercel mounts the deployed source under /var/task as read-only. Its
    // serverless functions may only write temporary runtime files under /tmp.
    const defaultSessionDir = process.env.VERCEL
        ? path.join(os.tmpdir(), 'dienlanh-sessions')
        : path.resolve(__dirname, 'data');
    const sessionDir = process.env.SESSION_DB_DIR || defaultSessionDir;
    fs.mkdirSync(sessionDir, { recursive: true });
    sessionOptions.store = new SQLiteStore({ db: 'sessions.sqlite', dir: sessionDir });
}

app.use(session(sessionOptions));

// Flash messages
app.use(flash());

// User locals & CSRF
app.use(setUserLocals);

// Flash messages to locals
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success');
    res.locals.error_msg = req.flash('error');
    res.locals.warning_msg = req.flash('warning');
    res.locals.query = req.query || {};
    next();
});

// ===== ROUTES =====
const homeRoutes = require('./routes/home');
const authRoutes = require('./routes/auth');
const serviceRoutes = require('./routes/services');
const bookingRoutes = require('./routes/bookings');
const contactRoutes = require('./routes/contacts');
const reviewRoutes = require('./routes/reviews');
const newsRoutes = require('./routes/news');
const adminRoutes = require('./routes/admin');
const contentRoutes = require('./routes/content');
const accountRoutes = require('./routes/account');
const forgotPasswordRoutes = require('./routes/forgotPassword');
const attachmentRoutes = require('./routes/attachments');
const schedulingRoutes = require('./routes/scheduling');

app.use('/forgot-password', forgotPasswordRoutes);
app.use('/', homeRoutes);
app.use('/auth', authRoutes);
app.use('/services', serviceRoutes);
app.use('/booking', bookingRoutes);
app.use('/contact', contactRoutes);
// The API aliases share the same protected handlers as the public forms.
app.use('/api/bookings', bookingRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api', schedulingRoutes);
app.use('/reviews', reviewRoutes);
app.use('/news', newsRoutes);
app.use('/content', contentRoutes);
app.use('/account', accountRoutes);
app.use('/attachments', attachmentRoutes);
// Admin pages are session-specific and must always reference the latest asset version.
app.use('/admin', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
});
app.use('/admin', adminRoutes);

// ===== 404 HANDLER =====
app.use((req, res) => {
    res.status(404).render('pages/404', {
        title: '404 - Không tìm thấy trang',
        layout: 'layouts/main'
    });
});

// ===== ERROR HANDLER =====
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err.stack);
    res.status(500).render('pages/500', {
        title: '500 - Lỗi máy chủ',
        layout: 'layouts/main',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Đã xảy ra lỗi máy chủ'
    });
});

// ===== START SERVER =====
async function start() {
    // Test database connection
    let dbConnected = await testConnection();

    if (dbConnected) {
        try {
            await runRbacMigration();
            await runPasswordResetMigration();
            await runReviewMigration();
            await runRequestCodeMigration();
            await runContactOwnershipMigration();
            await runPayrollMigration();
            await runAttendanceMigration();
            console.log('✅ Cấu trúc phân quyền Admin đã sẵn sàng');
        } catch (error) {
            dbConnected = false;
            console.error('❌ Không thể cập nhật cấu trúc phân quyền:', error.message);
        }
    }

    app.locals.dbConnected = dbConnected;

    const server = app.listen(PORT, HOST, () => {
        const lanUrls = getLanIPv4Addresses().map(address => `http://${address}:${PORT}`).join('\n   LAN:    ') ||
            `http://<IPv4-cua-may>:${PORT}`;
        console.log(`
═══════════════════════════════════════════
   ĐIỆN LẠNH NGUYÊN HÙNG 
   Local:  http://localhost:${PORT}
   LAN:    ${lanUrls}
   Admin:  http://<IPv4-cua-may>:${PORT}/admin
   DB:     ${dbConnected ? '✅ Đã kết nối' : '⚠️ Chưa kết nối'}
   ENV:    ${process.env.NODE_ENV || 'development'}
═══════════════════════════════════════════
    `);
    });

    // Do not let common startup failures terminate the process without a
    // useful explanation (for example, when PORT is already in use).
    server.on('error', error => {
        if (error.code === 'EADDRINUSE') {
            console.error(`Cổng ${PORT} đang được một tiến trình khác sử dụng.`);
            return;
        }
        console.error('Không thể khởi động HTTP server:', error.message);
    });

    return server;
}

if (require.main === module) {
    start();
}

module.exports = { app, start };
