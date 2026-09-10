require('dotenv').config();

const { query } = require('../config/database');

const services = [
    {
        name: 'Vệ sinh máy giặt',
        slug: 've-sinh-may-giat',
        icon: 'fa-soap',
        description: 'Vệ sinh máy giặt cửa trên, cửa ngang, loại bỏ bụi bẩn, cặn bám và mùi hôi. Giúp máy hoạt động sạch sẽ, hiệu quả và bền hơn.',
        priceRange: 'Liên hệ',
        sortOrder: 7
    },
    {
        name: 'Triển khai hệ thống điện lạnh',
        slug: 'trien-khai-he-thong-dien-lanh',
        icon: 'fa-drafting-compass',
        description: 'Thi công, lắp đặt hệ thống điện lạnh cho nhà ở, văn phòng, cửa hàng và công trình. Đảm bảo đúng kỹ thuật, an toàn và tối ưu hiệu quả.',
        priceRange: 'Liên hệ',
        sortOrder: 8
    },
    {
        name: 'Bảo trì hệ thống điện lạnh',
        slug: 'bao-tri-he-thong-dien-lanh',
        icon: 'fa-cogs',
        description: 'Kiểm tra, bảo dưỡng và bảo trì định kỳ hệ thống điện lạnh. Phát hiện sớm sự cố, duy trì hiệu suất hoạt động và kéo dài tuổi thọ thiết bị.',
        priceRange: 'Liên hệ',
        sortOrder: 9
    }
];

async function addBuiltInServices() {
    for (const service of services) {
        await query(`
            IF NOT EXISTS (SELECT 1 FROM services WHERE slug = @slug)
                INSERT INTO services (name, slug, icon, description, price_range, sort_order, status)
                VALUES (@name, @slug, @icon, @description, @priceRange, @sortOrder, 'active')
        `, service);
    }

    const result = await query(`
        SELECT name, slug, sort_order, status
        FROM services
        WHERE slug IN ('ve-sinh-may-giat', 'trien-khai-he-thong-dien-lanh', 'bao-tri-he-thong-dien-lanh')
        ORDER BY sort_order
    `);

    console.table(result.recordset);
}

addBuiltInServices()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('Không thể thêm dịch vụ:', error.message);
        process.exit(1);
    });
