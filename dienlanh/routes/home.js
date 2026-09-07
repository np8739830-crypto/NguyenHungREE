const express = require('express');
const path = require('path');

const router = express.Router();
const site = path.resolve(__dirname, '../../dienlanh- web');
const pages = {
    '/': 'trang-chu.html',
    '/about': 'gioi-thieu.html',
    '/pricing': 'bang-gia.html',
    '/service-detail': 'chi-tiet-dich-vu.html',
    '/danh-gia': 'danh-gia.html'
};

for (const [route, page] of Object.entries(pages)) {
    router.get(route, (req, res) => res.sendFile(path.join(site, page)));
}

function authRedirect(type) {
    return (req, res) => {
        const returnTo = typeof req.query.returnTo === 'string' ? req.query.returnTo : '';
        const query = new URLSearchParams({ auth: type });
        // Retain only internal destinations to avoid an open redirect.
        if (returnTo.startsWith('/') && !returnTo.startsWith('//')) query.set('returnTo', returnTo);
        return res.redirect(`/?${query.toString()}`);
    };
}

router.get('/login', authRedirect('login'));
router.get('/register', authRedirect('register'));

const legacyPaths = {
    '/index.html': '/',
    '/about.html': '/about',
    '/pricing.html': '/pricing',
    '/services.html': '/services',
    '/booking.html': '/booking',
    '/contact.html': '/contact',
    '/news.html': '/news',
    '/service-detail.html': '/service-detail',
    '/reviews.html': '/danh-gia',
    '/trang-chu.html': '/',
    '/gioi-thieu.html': '/about',
    '/bang-gia.html': '/pricing',
    '/dich-vu.html': '/services',
    '/dat-lich.html': '/booking',
    '/lien-he.html': '/contact',
    '/tin-tuc.html': '/news',
    '/chi-tiet-dich-vu.html': '/service-detail',
    '/danh-gia.html': '/danh-gia'
};

for (const [legacyPath, route] of Object.entries(legacyPaths)) {
    router.get(legacyPath, (req, res) => res.redirect(301, `${route}${req.url.slice(legacyPath.length)}`));
}

module.exports = router;
