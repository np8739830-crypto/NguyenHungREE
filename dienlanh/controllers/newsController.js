const { query } = require('../config/database');
const removedNewsSlug = 'huong-dan-ve-sinh-may-lanh-tai-nha';

async function findPublishedArticle(slug) {
    return (await query(
        "SELECT * FROM news WHERE slug = @slug AND slug <> @removedNewsSlug AND status = 'published'",
        { slug, removedNewsSlug }
    )).recordset[0] || null;
}

async function detailBySlug(req, res, next) {
    try {
        const article = await findPublishedArticle(req.params.slug);

        if (!article) return res.status(404).json({ error: 'Không tìm thấy bài viết.' });

        const [relatedResult, settingsResult] = await Promise.all([
            query(
                `SELECT TOP (3) id, title, slug, category, image, excerpt, published_at
                 FROM news
                 WHERE status = 'published' AND id <> @id AND slug <> @removedNewsSlug
                 ORDER BY CASE WHEN category = @category THEN 0 ELSE 1 END,
                          published_at DESC, id DESC`,
                { id: article.id, category: article.category || null, removedNewsSlug }
            ),
            query("SELECT [value] FROM settings WHERE [key] = 'site_name'")
        ]);

        // Build API response without mutating the database record. If the
        // article has no `image` field, provide a reasonable topic-specific
        // fallback for the frontend to use (keeps DB unchanged).
        const apiArticle = {
            ...article,
            author: settingsResult.recordset[0] ?
                settingsResult.recordset[0].value :
                null,
        };

        if (!apiArticle.image && /Cách chọn công suất/i.test(String(apiArticle.title || ''))) {
            apiArticle.image = 'tin-tuc/cachchoncongsuat.png';
        }

        return res.json({
            article: apiArticle,
            related: relatedResult.recordset
        });
    } catch (error) {
        return next(error);
    }
}

async function detailPageBySlug(req, res, next) {
    try {
        const article = await findPublishedArticle(req.params.slug);
        if (!article) {
            return res.status(404).render('pages/news-not-found', {
                title: 'Bài viết không tồn tại | Điện Lạnh Nguyên Hùng'
            });
        }

        // The page fetches the same article data from the API to populate its
        // responsive detail layout, after this server-side existence check.
        return res.sendFile(require('path').resolve(__dirname, '../../dienlanh- web/chi-tiet-tin-tuc.html'));
    } catch (error) {
        return next(error);
    }
}

module.exports = { detailBySlug, detailPageBySlug };
