require('dotenv').config();

const { query } = require('../config/database');

const services = [
    {
        name: 'Vệ sinh máy giặt',
        slug: 've-sinh-may-giat',
        icon: 'fa-soap',
        description: 'Vệ sinh máy giặt cửa trên, cửa ngang, loại bỏ bụi bẩn, cặn bám và mùi hôi. Giúp máy hoạt động sạch sẽ, hiệu quả và bền hơn.',
        image: 'dich-vu/vsmaygiat.png',
        priceRange: 'Liên hệ',
        sortOrder: 7
    },
    {
        name: 'Triển khai hệ thống điện lạnh',
        slug: 'trien-khai-he-thong-dien-lanh',
        icon: 'fa-drafting-compass',
        description: 'Thi công, lắp đặt hệ thống điện lạnh cho nhà ở, văn phòng, cửa hàng và công trình. Đảm bảo đúng kỹ thuật, an toàn và tối ưu hiệu quả.',
        image: 'dich-vu/hethong.png',
        priceRange: 'Liên hệ',
        sortOrder: 8
    },
    {
        name: 'Bảo trì hệ thống điện lạnh',
        slug: 'bao-tri-he-thong-dien-lanh',
        icon: 'fa-cogs',
        description: 'Kiểm tra, bảo dưỡng và bảo trì định kỳ hệ thống điện lạnh. Phát hiện sớm sự cố, duy trì hiệu suất hoạt động và kéo dài tuổi thọ thiết bị.',
        image: 'dich-vu/baotrihethong.png',
        priceRange: 'Liên hệ',
        sortOrder: 9
    }
];

const pricingItems = [
    ['ve-sinh-may-giat', 'Vệ sinh máy giặt', 'Vệ sinh máy giặt cửa trên', 'Vệ sinh lồng giặt, mâm giặt, khay chứa và bộ lọc', '350.000đ - 550.000đ', 1],
    ['ve-sinh-may-giat', 'Vệ sinh máy giặt', 'Vệ sinh máy giặt cửa ngang', 'Vệ sinh lồng giặt, gioăng cửa, khay chứa và bộ lọc', '500.000đ - 800.000đ', 2],
    ['ve-sinh-may-giat', 'Vệ sinh máy giặt', 'Vệ sinh chuyên sâu', 'Tháo lồng, làm sạch cặn bẩn, khử khuẩn và khử mùi', '700.000đ - 1.200.000đ', 3],
    ['ve-sinh-may-giat', 'Vệ sinh máy giặt', 'Vệ sinh từ 2 máy', 'Giá ưu đãi khi thực hiện từ 2 máy tại cùng địa chỉ', '300.000đ - 650.000đ/máy', 4],
    ['trien-khai-he-thong-dien-lanh', 'Triển khai hệ thống điện lạnh', 'Khảo sát và tư vấn phương án', 'Khảo sát công trình, tính công suất và đề xuất giải pháp', 'Miễn phí', 1],
    ['trien-khai-he-thong-dien-lanh', 'Triển khai hệ thống điện lạnh', 'Thiết kế hệ thống điện lạnh', 'Thiết kế mặt bằng bố trí thiết bị và đường ống', '30.000đ - 80.000đ/m²', 2],
    ['trien-khai-he-thong-dien-lanh', 'Triển khai hệ thống điện lạnh', 'Thi công đường ống đồng', 'Lắp ống đồng, bảo ôn và dây điều khiển theo thiết kế', '180.000đ - 350.000đ/mét', 3],
    ['trien-khai-he-thong-dien-lanh', 'Triển khai hệ thống điện lạnh', 'Lắp đặt thiết bị', 'Lắp dàn lạnh, dàn nóng và hoàn thiện kết nối hệ thống', '500.000đ - 1.800.000đ/bộ', 4],
    ['trien-khai-he-thong-dien-lanh', 'Triển khai hệ thống điện lạnh', 'Thi công hệ thống trung tâm', 'Hệ thống multi, VRV/VRF hoặc điều hòa trung tâm', 'Liên hệ khảo sát', 5],
    ['bao-tri-he-thong-dien-lanh', 'Bảo trì hệ thống điện lạnh', 'Khảo sát hệ thống', 'Kiểm tra hiện trạng và lập kế hoạch bảo trì', 'Miễn phí', 1],
    ['bao-tri-he-thong-dien-lanh', 'Bảo trì hệ thống điện lạnh', 'Bảo trì máy lạnh treo tường', 'Vệ sinh, đo thông số và kiểm tra vận hành', '150.000đ - 300.000đ/bộ', 2],
    ['bao-tri-he-thong-dien-lanh', 'Bảo trì hệ thống điện lạnh', 'Bảo trì máy lạnh âm trần', 'Vệ sinh dàn, bơm thoát nước và kiểm tra hệ thống', '350.000đ - 650.000đ/bộ', 3],
    ['bao-tri-he-thong-dien-lanh', 'Bảo trì hệ thống điện lạnh', 'Bảo trì hệ thống trung tâm', 'Kiểm tra tổng thể hệ thống multi, VRV/VRF hoặc chiller', '2.000.000đ - 10.000.000đ/hệ thống', 4],
    ['bao-tri-he-thong-dien-lanh', 'Bảo trì hệ thống điện lạnh', 'Hợp đồng bảo trì định kỳ', 'Bảo trì theo tháng, quý hoặc năm tùy quy mô công trình', 'Liên hệ báo giá', 5]
];

async function addBuiltInServices() {
    await query(`
        IF NOT EXISTS (SELECT 1 FROM devices WHERE slug = 'he-thong-dien-lanh')
            INSERT INTO devices (slug, name, status)
            VALUES ('he-thong-dien-lanh', N'Hệ thống điện lạnh', 'active')
    `);

    for (const service of services) {
        await query(`
            IF NOT EXISTS (SELECT 1 FROM services WHERE slug = @slug)
                INSERT INTO services (name, slug, icon, description, full_description, image, price_range, sort_order, status)
                VALUES (@name, @slug, @icon, @description, @description, @image, @priceRange, @sortOrder, 'active')
            ELSE
                UPDATE services
                SET image = CASE WHEN image IS NULL OR image = '' THEN @image ELSE image END,
                    status = 'active'
                WHERE slug = @slug
        `, service);
    }

    for (const [slug, category, itemName, description, price, sortOrder] of pricingItems) {
        await query(`
            DECLARE @serviceId INT = (SELECT id FROM services WHERE slug = @slug);
            IF @serviceId IS NOT NULL AND NOT EXISTS (
                SELECT 1 FROM pricing WHERE service_id = @serviceId AND item_name = @itemName
            )
                INSERT INTO pricing (service_id, category, item_name, description, price, sort_order, status)
                VALUES (@serviceId, @category, @itemName, @description, @price, @sortOrder, 'active')
        `, { slug, category, itemName, description, price, sortOrder });
    }

    const result = await query(`
        SELECT name, slug, sort_order, status
        FROM services
        WHERE slug IN ('ve-sinh-may-giat', 'trien-khai-he-thong-dien-lanh', 'bao-tri-he-thong-dien-lanh')
        ORDER BY sort_order
    `);

    console.table(result.recordset);
}

if (require.main === module) {
    addBuiltInServices()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Không thể thêm dịch vụ:', error.message);
            process.exit(1);
        });
}

module.exports = { addBuiltInServices };
