/*
 * Imports editable content that originally lived in the static frontend.
 * It only fills empty tables, so it never overwrites content managed in SQL.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query } = require('./db');

const frontend = path.resolve(__dirname, '../dienlanh- web');
const read = file => fs.readFileSync(path.join(frontend, file), 'utf8');
const text = value => value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

async function isEmpty(table) {
    return Number((await query(`SELECT COUNT(*) AS total FROM ${table}`)).recordset[0].total) === 0;
}

async function importPricing() {
    if (!await isEmpty('pricing')) return 0;
    const html = read('bang-gia.html');
    const categories = html.split('<div class="pricing-category">').slice(1).map(block => block.split('</table>')[0]);
    const serviceSlugs = ['sua-may-lanh', 've-sinh-may-lanh', 'lap-dat-may-lanh', 'sua-tu-lanh', 'sua-may-giat', 'sua-may-nuoc-nong'];
    let imported = 0;
    for (let categoryIndex = 0; categoryIndex < categories.length; categoryIndex += 1) {
        const category = categories[categoryIndex];
        const title = text((category.match(/<h3[^>]*>[\s\S]*?<\/h3>/) || [''])[0]);
        const service = (await query('SELECT id FROM services WHERE slug = @slug', { slug: serviceSlugs[categoryIndex] })).recordset[0];
        if (!service) continue;
        const rows = [...category.matchAll(/<tr>\s*<td><strong>([\s\S]*?)<\/strong><\/td>\s*<td>([\s\S]*?)<\/td>\s*<td class="price-cell">([\s\S]*?)<\/td>/g)];
        for (let index = 0; index < rows.length; index += 1) {
            await query(`INSERT INTO pricing (service_id, category, item_name, description, price, sort_order)
                         VALUES (@serviceId, @category, @itemName, @description, @price, @sortOrder)`, {
                serviceId: service.id,
                category: title,
                itemName: text(rows[index][1]),
                description: text(rows[index][2]),
                price: text(rows[index][3]),
                sortOrder: index + 1
            });
            imported += 1;
        }
    }
    return imported;
}

async function importAboutData() {
    const html = read('gioi-thieu.html');
    const result = { faqs: 0, timeline: 0, brands: 0 };

    if (await isEmpty('faqs')) {
        const questions = [...html.matchAll(/faq__question[\s\S]*?<span>([\s\S]*?)<\/span>/g)].map(match => text(match[1]));
        const answers = [...html.matchAll(/faq__answer[\s\S]*?<p>([\s\S]*?)<\/p>/g)].map(match => text(match[1]));
        for (let index = 0; index < questions.length; index += 1) {
            await query('INSERT INTO faqs (question, answer, sort_order) VALUES (@question, @answer, @sortOrder)', {
                question: questions[index], answer: answers[index] || '', sortOrder: index + 1
            });
            result.faqs += 1;
        }
    }

    if (await isEmpty('timeline_events')) {
        const events = [...html.matchAll(/timeline__item[\s\S]*?timeline__year">([\s\S]*?)<\/span>[\s\S]*?timeline__title">([\s\S]*?)<\/h3>[\s\S]*?timeline__desc">([\s\S]*?)<\/p>/g)];
        for (let index = 0; index < events.length; index += 1) {
            await query('INSERT INTO timeline_events (year, title, description, sort_order) VALUES (@year, @title, @description, @sortOrder)', {
                year: text(events[index][1]), title: text(events[index][2]), description: text(events[index][3]), sortOrder: index + 1
            });
            result.timeline += 1;
        }
    }

    if (await isEmpty('brands')) {
        const brands = [...html.matchAll(/brands-grid__logo">\s*<i class="([^"]+)"[^>]*><\/i>[\s\S]*?brands-grid__name">([\s\S]*?)<\/span>/g)];
        for (let index = 0; index < brands.length; index += 1) {
            await query('INSERT INTO brands (name, icon, sort_order) VALUES (@name, @icon, @sortOrder)', {
                name: text(brands[index][2]), icon: brands[index][1], sortOrder: index + 1
            });
            result.brands += 1;
        }
    }
    return result;
}

async function migrate() {
    const pricing = await importPricing();
    const about = await importAboutData();
    console.log('Đã nhập dữ liệu frontend:', { pricing, ...about });
}

if (require.main === module) {
    migrate().catch(error => { console.error('Không thể nhập dữ liệu frontend:', error); process.exitCode = 1; });
}

module.exports = { migrate };
