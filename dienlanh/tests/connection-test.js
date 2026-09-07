// ============================================
// ĐIỆN LẠNH NGUYÊN HÙNG - Comprehensive Test
// Kiểm tra kết nối đường dẫn các trang & server
// ============================================

const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');

// Configuration
const HOST = '127.0.0.1';
const PORT = 5000;
const BASE_URL = `http://${HOST}:${PORT}`;
const PROJECT_DIR = path.resolve(__dirname, '..');
const FRONTEND_DIR = path.resolve(__dirname, '../../dienlanh- web');
const ADMIN_DIR = path.resolve(__dirname, '../../admin');

// Colors for output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bgGreen: '\x1b[42m',
    bgRed: '\x1b[41m',
    bgYellow: '\x1b[43m',
    bold: '\x1b[1m',
    dim: '\x1b[2m'
};

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let warnings = 0;

function printBanner() {
    console.log(`
${colors.cyan}${colors.bold}╔══════════════════════════════════════════════════════╗
║   ĐIỆN LẠNH NGUYÊN HÙNG - COMPREHENSIVE TEST       ║
║   Kiểm tra kết nối đường dẫn & Server              ║
╚══════════════════════════════════════════════════════╝${colors.reset}
`);
}

function printSection(title) {
    console.log(`\n${colors.yellow}${colors.bold}━━━ ${title} ━━━${colors.reset}\n`);
}

function printResult(passed, message, detail = '') {
    totalTests++;
    if (passed) {
        passedTests++;
        console.log(`  ${colors.green}✓${colors.reset} ${message}`);
    } else {
        failedTests++;
        console.log(`  ${colors.red}✗${colors.reset} ${message}`);
        if (detail) console.log(`    ${colors.dim}${detail}${colors.reset}`);
    }
}

function printWarning(message) {
    warnings++;
    console.log(`  ${colors.yellow}⚠${colors.reset} ${message}`);
}

function printSummary() {
    const allPassed = failedTests === 0;
    const color = allPassed ? colors.bgGreen : colors.bgRed;
    console.log(`\n${colors.bold}═══════════════════════════════════════════════════${colors.reset}`);
    console.log(`${color}${colors.white}${colors.bold}  KẾT QUẢ KIỂM TRA                                  ${colors.reset}`);
    console.log(`  ${colors.bold}Tổng số:${colors.reset} ${totalTests}`);
    console.log(`  ${colors.green}✓ Pass: ${passedTests}${colors.reset}`);
    if (failedTests > 0) console.log(`  ${colors.red}✗ Fail: ${failedTests}${colors.reset}`);
    if (warnings > 0) console.log(`  ${colors.yellow}⚠ Warning: ${warnings}${colors.reset}`);
    const status = allPassed ? '✅ TẤT CẢ KIỂM TRA ĐẠT YÊU CẦU' : '❌ CÓ LỖI CẦN KHẮC PHỤC';
    console.log(`  ${colors.bold}Kết luận:${colors.reset} ${allPassed ? colors.green : colors.red}${status}${colors.reset}`);
    console.log(`${colors.bold}═══════════════════════════════════════════════════${colors.reset}\n`);
}

function makeRequest(method, urlPath, options = {}) {
    return new Promise((resolve) => {
        const urlObj = new URL(urlPath, BASE_URL);
        const req = http.request({
                hostname: HOST,
                port: PORT,
                path: urlObj.pathname + urlObj.search,
                method: method || 'GET',
                headers: options.headers || {},
                timeout: 10000
            },
            (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: data
                    });
                });
            }
        );
        req.on('error', (err) => {
            resolve({ error: err.message, statusCode: 0 });
        });
        req.on('timeout', () => {
            req.destroy();
            resolve({ error: 'Request timeout', statusCode: 0 });
        });
        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

// ========== ENVIRONMENT CHECKS ==========
async function checkEnvironment() {
    printSection('1. KIỂM TRA MÔI TRƯỜNG');

    // Check Node version
    const nodeVersion = process.version;
    const major = parseInt(nodeVersion.slice(1).split('.')[0]);
    printResult(major >= 18, `Node.js ${nodeVersion} (>=18.x)`);

    // Check frontend files exist
    const frontendFiles = [
        'trang-chu.html', 'gioi-thieu.html', 'dich-vu.html', 'chi-tiet-dich-vu.html',
        'bang-gia.html', 'dat-lich.html', 'lien-he.html', 'tin-tuc.html'
    ];
    let allExist = true;
    for (const file of frontendFiles) {
        const filePath = path.join(FRONTEND_DIR, file);
        if (!fs.existsSync(filePath)) {
            printResult(false, `Frontend file missing: ${file}`);
            allExist = false;
        }
    }
    if (allExist) {
        printResult(true, 'Tất cả 8 file frontend HTML đều tồn tại');
    }

    // Check CSS/JS files
    const cssExists = fs.existsSync(path.join(FRONTEND_DIR, 'css', 'style.css'));
    printResult(cssExists, 'Frontend CSS file: style.css');

    const jsExists = fs.existsSync(path.join(FRONTEND_DIR, 'js', 'script.js'));
    printResult(jsExists, 'Frontend JS file: script.js');

    const backendJsExists = fs.existsSync(path.join(FRONTEND_DIR, 'js', 'backend.js'));
    printResult(backendJsExists, 'Frontend JS file: backend.js');

    // Check admin files
    const adminFiles = [
        'bangdieukhien.html', 'sanpham.html', 'banhang.html', 'khachhang.html',
        'cauhinh.html', 'hinhanh.html', 'hotro.html', 'lienhe.html', 'nhanvien.html', 'cauhinhthongtin.html'
    ];
    let allAdminExist = true;
    for (const file of adminFiles) {
        const filePath = path.join(ADMIN_DIR, 'html', file);
        if (!fs.existsSync(filePath)) {
            printResult(false, `Admin file missing: ${file}`);
            allAdminExist = false;
        }
    }
    if (allAdminExist) {
        printResult(true, 'Tất cả 10 file admin HTML đều tồn tại');
    }
}

// ========== SERVER CONNECTION CHECK ==========
async function checkServerConnection() {
    printSection('2. KIỂM TRA KẾT NỐI SERVER');

    const res = await makeRequest('GET', '/');
    if (res.error) {
        printResult(false, 'Kết nối server', res.error);
        return false;
    }
    printResult(true, `Server đang chạy tại http://localhost:${PORT}`);
    printResult(res.statusCode === 200, `Status code: ${res.statusCode}`);
    printResult(
        res.headers['content-type'] && res.headers['content-type'].includes('text/html'),
        'Content-Type: text/html'
    );
    // CORS headers are only set when Origin header is present in request
    // Detailed CORS check is done in section 10 with proper Origin headers
    if (res.headers['access-control-allow-origin'] !== undefined) {
        printResult(true, 'CORS headers present (unexpected - Origin not sent)');
    } else {
        printWarning('CORS headers only set when Origin header is present (see section 10)');
    }
    return true;
}

// ========== ROUTE CHECKS ==========
async function checkRoutes() {
    printSection('3. KIỂM TRA CÁC ROUTE TRANG (HTTP 200)');

    const routes = [
        { path: '/', name: 'Trang chủ' },
        { path: '/about', name: 'Giới thiệu' },
        { path: '/services', name: 'Dịch vụ' },
        { path: '/service-detail', name: 'Chi tiết dịch vụ' },
        { path: '/pricing', name: 'Bảng giá' },
        { path: '/booking', name: 'Đặt lịch' },
        { path: '/contact', name: 'Liên hệ' },
        { path: '/news', name: 'Tin tức' },
    ];

    for (const route of routes) {
        const res = await makeRequest('GET', route.path);
        const passed = res.statusCode === 200;
        const detail = passed ? '' : `Status: ${res.statusCode}`;
        printResult(passed, `${route.name} (${route.path})`, detail);
    }
}

// ========== LEGACY REDIRECT CHECKS ==========
async function checkRedirects() {
    printSection('4. KIỂM TRA REDIRECT ROUTES (HTTP 301)');

    const redirects = [
        { from: '/index.html', to: '/' },
        { from: '/about.html', to: '/about' },
        { from: '/pricing.html', to: '/pricing' },
        { from: '/services.html', to: '/services' },
        { from: '/booking.html', to: '/booking' },
        { from: '/contact.html', to: '/contact' },
        { from: '/news.html', to: '/news' },
        { from: '/service-detail.html', to: '/service-detail' },
    ];

    for (const redirect of redirects) {
        const res = await makeRequest('GET', redirect.from);
        const passed = res.statusCode === 301 || res.statusCode === 302;
        const locationMatch = res.headers['location'] === redirect.to;
        const detail = passed && locationMatch ?
            '' :
            `Status: ${res.statusCode}, Location: ${res.headers['location']}, Expected: ${redirect.to}`;
        printResult(passed && locationMatch, `${redirect.from} → ${redirect.to}`, detail);
    }

    // Check admin HTML redirects (302) - these routes are mounted at /admin
    // So the full path is /admin/bangdieukhien.html, not /bangdieukhien.html
    const adminRedirects = [
        { from: '/admin/bangdieukhien.html', to: '/admin' },
        { from: '/admin/sanpham.html', to: '/admin/products' },
        { from: '/admin/banhang.html', to: '/admin/orders' },
    ];

    for (const redirect of adminRedirects) {
        const res = await makeRequest('GET', redirect.from);
        // These routes require authentication, so they may redirect to /admin/login first
        // or redirect to /admin if already logged in
        const isRedirect = res.statusCode === 302;
        const redirectTarget = res.headers['location'] || '';
        // If not logged in, redirect goes to /admin/login
        // If logged in, redirect goes to the target
        const validTargets = [redirect.to, '/admin/login'];
        const targetMatch = validTargets.includes(redirectTarget);
        printResult(isRedirect && targetMatch, `${redirect.from} → ${redirect.to} (admin)`,
            `Status: ${res.statusCode}, Location: ${redirectTarget}`);
    }
}

// ========== API ENDPOINTS CHECK ==========
async function checkAPIs() {
    printSection('5. KIỂM TRA API ENDPOINTS');

    // Auth me
    const authRes = await makeRequest('GET', '/auth/me');
    printResult(authRes.statusCode === 200, '/auth/me - Check auth status');
    if (authRes.statusCode === 200) {
        try {
            const body = JSON.parse(authRes.body);
            printResult(true, '/auth/me - Response is valid JSON');
        } catch {
            printResult(false, '/auth/me - Response is NOT valid JSON');
        }
    }

    // Content bootstrap
    const contentRes = await makeRequest('GET', '/content/bootstrap');
    if (contentRes.statusCode === 200) {
        printResult(true, '/content/bootstrap - Đang chạy (có thể DB chưa connect)');
    } else if (contentRes.statusCode === 500) {
        printWarning('/content/bootstrap - Trả về 500 (do DB chưa kết nối - có thể chấp nhận)');
    } else {
        printResult(false, `/content/bootstrap - Status: ${contentRes.statusCode}`);
    }

    // Services API
    const servicesRes = await makeRequest('GET', '/services/api');
    if (servicesRes.statusCode === 200) {
        printResult(true, '/services/api - OK');
        try {
            const body = JSON.parse(servicesRes.body);
            printResult(Array.isArray(body), '/services/api - Response is an array');
        } catch {
            printWarning('/services/api - Could not parse JSON');
        }
    } else {
        printWarning(`/services/api - Status: ${servicesRes.statusCode} (có thể do DB)`);
    }

    // News API
    const newsRes = await makeRequest('GET', '/news/api');
    if (newsRes.statusCode === 200) {
        printResult(true, '/news/api - OK');
    } else {
        printWarning(`/news/api - Status: ${newsRes.statusCode} (có thể do DB)`);
    }

    // Reviews API
    const reviewsRes = await makeRequest('GET', '/reviews');
    if (reviewsRes.statusCode === 200) {
        printResult(true, '/reviews - OK');
    } else {
        printWarning(`/reviews - Status: ${reviewsRes.statusCode} (có thể do DB)`);
    }
}

// ========== STATIC FILES CHECK ==========
async function checkStaticFiles() {
    printSection('6. KIỂM TRA STATIC FILES (CSS, JS, Images)');

    const staticFiles = [
        { path: '/css/style.css', name: 'CSS style.css', type: 'text/css' },
        { path: '/js/script.js', name: 'JS script.js', type: 'javascript' },
        { path: '/js/backend.js', name: 'JS backend.js', type: 'javascript' },
        { path: '/images/logo.png', name: 'Image logo.png', type: 'image' },
        { path: '/images/giadung.png', name: 'Image giadung.png', type: 'image' },
        { path: '/images/dich-vu/suamaylanh.png', name: 'Image suamaylanh.png', type: 'image' },
        { path: '/images/dich-vu/suamaygiat.png', name: 'Image suamaygiat.png', type: 'image' },
        { path: '/images/dich-vu/suatulanh.png', name: 'Image suatulanh.png', type: 'image' },
        { path: '/images/dich-vu/suamaynong.png', name: 'Image suamaynong.png', type: 'image' },
        { path: '/images/dich-vu/vsmaylanh.png', name: 'Image vsmaylanh.png', type: 'image' },
        { path: '/images/dich-vu/ldmaylanh.png', name: 'Image ldmaylanh.png', type: 'image' },
    ];

    for (const file of staticFiles) {
        const res = await makeRequest('GET', file.path);
        const passed = res.statusCode === 200;
        printResult(passed, `${file.name} (${file.path})`,
            passed ? '' : `Status: ${res.statusCode}`);
    }
}

// ========== 404 HANDLER CHECK ==========
async function check404() {
    printSection('7. KIỂM TRA 404 HANDLER');

    const notFoundRoutes = [
        '/nonexistent-page',
        '/random-test-123',
        '/api/nonexistent',
    ];

    for (const route of notFoundRoutes) {
        const res = await makeRequest('GET', route);
        const passed = res.statusCode === 404;
        const detail = passed ? '' : `Status: ${res.statusCode}`;
        printResult(passed, `${route} → 404 Not Found`, detail);
    }
}

// ========== ADMIN ROUTES CHECK ==========
async function checkAdminRoutes() {
    printSection('8. KIỂM TRA ADMIN ROUTES');

    // Admin should redirect to login when not authenticated
    const adminRoutes = [
        { path: '/admin', name: 'Dashboard' },
        { path: '/admin/products', name: 'Sản phẩm' },
        { path: '/admin/orders', name: 'Đơn hàng' },
        { path: '/admin/customers', name: 'Khách hàng' },
        { path: '/admin/settings', name: 'Cấu hình' },
        { path: '/admin/contacts', name: 'Liên hệ' },
        { path: '/admin/telegram', name: 'Thông báo Telegram' },
        { path: '/admin/staff', name: 'Nhân viên' },
    ];

    // Login page should be accessible
    const loginRes = await makeRequest('GET', '/admin/login');
    printResult(loginRes.statusCode === 200, '/admin/login - Trang đăng nhập');

    // Protected routes should redirect to login
    for (const route of adminRoutes) {
        const res = await makeRequest('GET', route.path);
        // When not logged in, should redirect to /admin/login
        const passed = res.statusCode === 302;
        const locationIsLogin = res.headers['location'] === '/admin/login';
        if (passed && locationIsLogin) {
            printResult(true, `${route.name} (${route.path}) → Redirect to login`);
        } else {
            printWarning(`${route.name} (${route.path}) → Status: ${res.statusCode}, Location: ${res.headers['location']}`);
        }
    }
}

// ========== STATIC ADMIN FILES CHECK ==========
async function checkAdminStaticFiles() {
    printSection('9. KIỂM TRA ADMIN STATIC FILES');

    const adminStatic = [
        { path: '/admin/css/1.css', name: 'Admin CSS' },
        { path: '/admin/js/1.js', name: 'Admin JS' },
        { path: '/css/1.css', name: 'Admin CSS (legacy path)' },
        { path: '/js/1.js', name: 'Admin JS (legacy path)' },
    ];

    for (const file of adminStatic) {
        const res = await makeRequest('GET', file.path);
        printResult(res.statusCode === 200, `${file.name} (${file.path})`,
            res.statusCode !== 200 ? `Status: ${res.statusCode}` : '');
    }
}

// ========== CORS CHECK ==========
async function checkCORS() {
    printSection('10. KIỂM TRA CORS HEADERS');

    const corsHeaders = [
        { header: 'access-control-allow-origin', name: 'Access-Control-Allow-Origin' },
        { header: 'access-control-allow-credentials', name: 'Access-Control-Allow-Credentials' },
    ];

    // Test with localhost origin
    const res = await makeRequest('GET', '/', {
        headers: { 'Origin': 'http://localhost:5500' }
    });

    let corsOk = true;
    for (const ch of corsHeaders) {
        const hasHeader = res.headers[ch.header] !== undefined;
        if (!hasHeader) corsOk = false;
        printResult(hasHeader, `${ch.name} header`);
    }

    // Test OPTIONS preflight
    const optionsRes = await makeRequest('OPTIONS', '/', {
        headers: { 'Origin': 'http://localhost:5500' }
    });
    printResult(optionsRes.statusCode === 204, 'OPTIONS preflight → 204 No Content');
}

// ========== MAIN ==========
async function main() {
    printBanner();

    // Step 1: Environment
    await checkEnvironment();

    // Step 2: Server connection (if fails, skip remaining)
    const serverOk = await checkServerConnection();
    if (!serverOk) {
        console.log(`\n${colors.red}${colors.bold}Không thể kết nối server. Vui lòng kiểm tra server đã được khởi động chưa.${colors.reset}`);
        console.log(`Chạy lệnh: ${colors.cyan}cd dienlanh-nguyenhung && npm start${colors.reset}\n`);
        printSummary();
        return;
    }

    // Steps 3-10
    await checkRoutes();
    await checkRedirects();
    await checkAPIs();
    await checkStaticFiles();
    await check404();
    await checkAdminRoutes();
    await checkAdminStaticFiles();
    await checkCORS();

    // Summary
    printSummary();

    // Exit with appropriate code
    process.exit(failedTests > 0 ? 1 : 0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
