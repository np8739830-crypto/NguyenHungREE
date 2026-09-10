-- ============================================
-- ĐIỆN LẠNH NGUYÊN HÙNG
-- SQL Server Database Schema + Seed Data
-- ============================================

-- Create Database
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'DienLanhNguyenHung')
BEGIN
    CREATE DATABASE [DienLanhNguyenHung];
END
GO

USE [DienLanhNguyenHung];
GO

-- ============================================
-- 1. USERS TABLE
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND type in (N'U'))
BEGIN
CREATE TABLE [dbo].[users] (
    [id] INT IDENTITY(1,1) PRIMARY KEY,
    [name] NVARCHAR(100) NOT NULL,
    [email] NVARCHAR(100) NULL,
    [phone] NVARCHAR(20) NOT NULL,
    [address] NVARCHAR(300) NULL,
    [password_hash] NVARCHAR(255) NOT NULL,
    [role] NVARCHAR(20) NOT NULL DEFAULT 'user' CHECK ([role] IN ('admin', 'user')),
    [avatar] NVARCHAR(255) NULL,
    [status] NVARCHAR(20) NOT NULL DEFAULT 'active' CHECK ([status] IN ('active', 'inactive', 'banned')),
    [email_verified] BIT NOT NULL DEFAULT 0,
    [remember_token] NVARCHAR(255) NULL,
    [last_login] DATETIME NULL,
    [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
    [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
    [request_code] AS ('DL-' + CONVERT(char(8), [created_at], 112) + '-' + CASE WHEN [id] < 1000 THEN RIGHT('0000' + CONVERT(varchar(20), [id]), 4) ELSE CONVERT(varchar(20), [id]) END) PERSISTED
);
END
GO

-- ============================================
-- ADMIN ROLE-BASED ACCESS CONTROL
-- ============================================
IF OBJECT_ID(N'dbo.roles', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.roles (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(100) NOT NULL,
        slug NVARCHAR(50) NOT NULL UNIQUE,
        description NVARCHAR(500) NULL,
        is_system BIT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME NOT NULL DEFAULT GETDATE()
    );
END
GO

IF OBJECT_ID(N'dbo.permissions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.permissions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        module_key NVARCHAR(50) NOT NULL,
        action_key NVARCHAR(20) NOT NULL,
        name NVARCHAR(150) NOT NULL,
        CONSTRAINT UQ_permissions_module_action UNIQUE (module_key, action_key)
    );
END
GO

IF OBJECT_ID(N'dbo.role_permissions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.role_permissions (
        role_id INT NOT NULL,
        permission_id INT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_role_permissions PRIMARY KEY (role_id, permission_id),
        CONSTRAINT FK_role_permissions_role FOREIGN KEY (role_id) REFERENCES dbo.roles(id) ON DELETE CASCADE,
        CONSTRAINT FK_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES dbo.permissions(id) ON DELETE CASCADE
    );
END
GO

IF COL_LENGTH('dbo.users', 'username') IS NULL
    ALTER TABLE dbo.users ADD username NVARCHAR(50) NULL;
GO
IF COL_LENGTH('dbo.users', 'role_id') IS NULL
    ALTER TABLE dbo.users ADD role_id INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_users_roles')
    ALTER TABLE dbo.users ADD CONSTRAINT FK_users_roles FOREIGN KEY (role_id) REFERENCES dbo.roles(id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_users_username' AND object_id = OBJECT_ID('dbo.users'))
    CREATE UNIQUE NONCLUSTERED INDEX UX_users_username ON dbo.users(username) WHERE username IS NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE slug = 'administrator')
    INSERT dbo.roles (name, slug, description, is_system) VALUES (N'Administrator', 'administrator', N'Toàn quyền hệ thống.', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE slug = 'manager')
    INSERT dbo.roles (name, slug, description, is_system) VALUES (N'Quản lý', 'manager', N'Quản lý vận hành dịch vụ, lịch đặt, khách hàng và kỹ thuật viên.', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE slug = 'staff')
    INSERT dbo.roles (name, slug, description, is_system) VALUES (N'Nhân viên', 'staff', N'Chỉ truy cập các module được cấp quyền.', 1);
GO

DECLARE @rbacModules TABLE (module_key NVARCHAR(50), module_name NVARCHAR(100));
INSERT @rbacModules VALUES
    ('dashboard', N'Bảng điều khiển'), ('services', N'Quản lý dịch vụ'),
    ('bookings', N'Lịch đặt dịch vụ'), ('customers', N'Khách hàng'),
    ('technicians', N'Kỹ thuật viên'), ('contacts', N'Liên hệ'),
    ('telegram', N'Thông báo Telegram'), ('accounts', N'Tài khoản'),
    ('roles', N'Vai trò & Quyền hạn');
DECLARE @rbacActions TABLE (action_key NVARCHAR(20), action_name NVARCHAR(50));
INSERT @rbacActions VALUES ('view', N'Xem'), ('create', N'Thêm'), ('update', N'Sửa'), ('delete', N'Xóa');

INSERT dbo.permissions (module_key, action_key, name)
SELECT m.module_key, a.action_key, m.module_name + N' - ' + a.action_name
FROM @rbacModules m CROSS JOIN @rbacActions a
WHERE NOT EXISTS (SELECT 1 FROM dbo.permissions p WHERE p.module_key = m.module_key AND p.action_key = a.action_key);
GO

INSERT dbo.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM dbo.roles r CROSS JOIN dbo.permissions p
WHERE r.slug = 'administrator'
AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);
GO

INSERT dbo.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM dbo.roles r JOIN dbo.permissions p ON
    (p.module_key = 'dashboard' AND p.action_key = 'view') OR
    (p.module_key = 'services' AND p.action_key IN ('view', 'create', 'update')) OR
    (p.module_key = 'bookings' AND p.action_key IN ('view', 'create', 'update')) OR
    (p.module_key = 'customers' AND p.action_key IN ('view', 'create', 'update')) OR
    (p.module_key = 'technicians' AND p.action_key IN ('view', 'create', 'update')) OR
    (p.module_key = 'contacts' AND p.action_key = 'view')
WHERE r.slug = 'manager'
AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);
GO

INSERT dbo.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM dbo.roles r JOIN dbo.permissions p ON p.module_key = 'dashboard' AND p.action_key = 'view'
WHERE r.slug = 'staff'
AND NOT EXISTS (SELECT 1 FROM dbo.role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);
GO

UPDATE dbo.users
SET role_id = (SELECT id FROM dbo.roles WHERE slug = 'administrator'),
    username = COALESCE(username, CASE WHEN email = 'admin@dienlanhnguyenhung.vn' THEN 'admin' ELSE CONCAT('admin', id) END)
WHERE role = 'admin' AND role_id IS NULL;
GO

-- ============================================
-- 2. PASSWORD RESETS
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[password_resets]') AND type in (N'U'))
BEGIN
CREATE TABLE [dbo].[password_resets] (
    [id] INT IDENTITY(1,1) PRIMARY KEY,
    [email] NVARCHAR(100) NOT NULL,
    [token] NVARCHAR(255) NOT NULL,
    [user_id] INT NULL,
    [token_hash] CHAR(64) NULL,
    [expires_at] DATETIME NOT NULL,
    [used] BIT NOT NULL DEFAULT 0,
    [used_at] DATETIME2 NULL,
    [created_at] DATETIME NOT NULL DEFAULT GETDATE()
);
END
GO

-- ============================================
-- 3. SERVICES
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[services]') AND type in (N'U'))
BEGIN
CREATE TABLE [dbo].[services] (
    [id] INT IDENTITY(1,1) PRIMARY KEY,
    [name] NVARCHAR(200) NOT NULL,
    [slug] NVARCHAR(200) NOT NULL UNIQUE,
    [icon] NVARCHAR(100) NULL,
    [description] NVARCHAR(500) NULL,
    [full_description] NVARCHAR(MAX) NULL,
    [image] NVARCHAR(255) NULL,
    [price_range] NVARCHAR(100) NULL,
    [sort_order] INT NOT NULL DEFAULT 0,
    [status] NVARCHAR(20) NOT NULL DEFAULT 'active' CHECK ([status] IN ('active', 'inactive')),
    [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
    [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
    [request_code] AS ('LH-' + CONVERT(char(8), [created_at], 112) + '-' + CASE WHEN [id] < 1000 THEN RIGHT('0000' + CONVERT(varchar(20), [id]), 4) ELSE CONVERT(varchar(20), [id]) END) PERSISTED
);
END
GO

CREATE NONCLUSTERED INDEX [IX_services_slug] ON [dbo].[services]([slug]);

-- ============================================
-- 4. SERVICE ISSUES
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[service_issues]') AND type in (N'U'))
BEGIN
CREATE TABLE [dbo].[service_issues] (
    [id] INT IDENTITY(1,1) PRIMARY KEY,
    [service_id] INT NOT NULL FOREIGN KEY REFERENCES [dbo].[services](id) ON DELETE CASCADE,
    [issue_text] NVARCHAR(300) NOT NULL,
    [sort_order] INT NOT NULL DEFAULT 0
);
END
GO

-- ============================================
-- 5. SERVICE PROCESSES
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[service_processes]') AND type in (N'U'))
BEGIN
CREATE TABLE [dbo].[service_processes] (
    [id] INT IDENTITY(1,1) PRIMARY KEY,
    [service_id] INT NOT NULL FOREIGN KEY REFERENCES [dbo].[services](id) ON DELETE CASCADE,
    [step_text] NVARCHAR(300) NOT NULL,
    [step_order] INT NOT NULL DEFAULT 0
);
END
GO

-- ============================================
-- 6. PRICING
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[pricing]') AND type in (N'U'))
BEGIN
CREATE TABLE [dbo].[pricing] (
    [id] INT IDENTITY(1,1) PRIMARY KEY,
    [service_id] INT NOT NULL FOREIGN KEY REFERENCES [dbo].[services](id) ON DELETE CASCADE,
    [category] NVARCHAR(200) NULL,
    [item_name] NVARCHAR(200) NOT NULL,
    [description] NVARCHAR(500) NULL,
    [price] NVARCHAR(100) NOT NULL,
    [sort_order] INT NOT NULL DEFAULT 0,
    [status] NVARCHAR(20) NOT NULL DEFAULT 'active' CHECK ([status] IN ('active', 'inactive')),
    [created_at] DATETIME NOT NULL DEFAULT GETDATE()
);
END
GO

-- ============================================
-- 7. BOOKINGS
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[bookings]') AND type in (N'U'))
BEGIN
CREATE TABLE [dbo].[bookings] (
    [id] INT IDENTITY(1,1) PRIMARY KEY,
    [user_id] INT NULL FOREIGN KEY REFERENCES [dbo].[users](id) ON DELETE SET NULL,
    [fullname] NVARCHAR(100) NOT NULL,
    [phone] NVARCHAR(20) NOT NULL,
    [email] NVARCHAR(100) NULL,
    [address] NVARCHAR(300) NOT NULL,
    [device_type] NVARCHAR(100) NOT NULL,
    [service_type] NVARCHAR(100) NOT NULL,
    [booking_date] DATE NOT NULL,
    [booking_time] NVARCHAR(50) NULL,
    [description] NVARCHAR(MAX) NOT NULL,
    [status] NVARCHAR(20) NOT NULL DEFAULT 'pending' CHECK ([status] IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
    [admin_note] NVARCHAR(MAX) NULL,
    [estimated_cost] DECIMAL(18,2) NULL,
    [actual_cost] DECIMAL(18,2) NULL,
    [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
    [updated_at] DATETIME NOT NULL DEFAULT GETDATE()
);
END
GO

CREATE NONCLUSTERED INDEX [IX_bookings_status] ON [dbo].[bookings]([status]);
CREATE NONCLUSTERED INDEX [IX_bookings_date] ON [dbo].[bookings]([booking_date]);
CREATE NONCLUSTERED INDEX [IX_bookings_user_id] ON [dbo].[bookings]([user_id]);
CREATE UNIQUE NONCLUSTERED INDEX [UX_bookings_request_code] ON [dbo].[bookings]([request_code]);

-- ============================================
-- 8. CONTACTS
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[contacts]') AND type in (N'U'))
BEGIN
CREATE TABLE [dbo].[contacts] (
    [id] INT IDENTITY(1,1) PRIMARY KEY,
    [user_id] INT NULL FOREIGN KEY REFERENCES [dbo].[users](id),
    [name] NVARCHAR(100) NOT NULL,
    [phone] NVARCHAR(20) NOT NULL,
    [email] NVARCHAR(100) NULL,
    [subject] NVARCHAR(200) NULL,
    [message] NVARCHAR(MAX) NOT NULL,
    [status] NVARCHAR(20) NOT NULL DEFAULT 'new' CHECK ([status] IN ('new', 'read', 'replied', 'closed')),
    [admin_reply] NVARCHAR(MAX) NULL,
    [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
    [updated_at] DATETIME NOT NULL DEFAULT GETDATE()
);
END
GO

CREATE NONCLUSTERED INDEX [IX_contacts_status] ON [dbo].[contacts]([status]);
CREATE NONCLUSTERED INDEX [IX_contacts_user_created] ON [dbo].[contacts]([user_id], [created_at] DESC, [id] DESC);
CREATE UNIQUE NONCLUSTERED INDEX [UX_contacts_request_code] ON [dbo].[contacts]([request_code]);

-- ============================================
-- 9. REVIEWS
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[reviews]') AND type in (N'U'))
BEGIN
CREATE TABLE [dbo].[reviews] (
    [id] INT IDENTITY(1,1) PRIMARY KEY,
    [user_id] INT NULL FOREIGN KEY REFERENCES [dbo].[users](id) ON DELETE SET NULL,
    [name] NVARCHAR(100) NOT NULL,
    [location] NVARCHAR(100) NULL,
    [rating] INT NOT NULL DEFAULT 5 CHECK ([rating] BETWEEN 1 AND 5),
    [content] NVARCHAR(MAX) NOT NULL,
    [avatar] NVARCHAR(255) NULL,
    [status] NVARCHAR(20) NOT NULL DEFAULT 'pending' CHECK ([status] IN ('pending', 'approved', 'rejected')),
    [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
    [updated_at] DATETIME NOT NULL DEFAULT GETDATE()
);
END
GO

CREATE NONCLUSTERED INDEX [IX_reviews_status] ON [dbo].[reviews]([status]);

-- ============================================
-- 10. NEWS
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[news]') AND type in (N'U'))
BEGIN
CREATE TABLE [dbo].[news] (
    [id] INT IDENTITY(1,1) PRIMARY KEY,
    [title] NVARCHAR(300) NOT NULL,
    [slug] NVARCHAR(300) NOT NULL UNIQUE,
    [category] NVARCHAR(100) NULL,
    [image] NVARCHAR(255) NULL,
    [excerpt] NVARCHAR(500) NULL,
    [content] NVARCHAR(MAX) NOT NULL,
    [view_count] INT NOT NULL DEFAULT 0,
    [status] NVARCHAR(20) NOT NULL DEFAULT 'published' CHECK ([status] IN ('published', 'draft', 'archived')),
    [published_at] DATETIME NULL,
    [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
    [updated_at] DATETIME NOT NULL DEFAULT GETDATE()
);
END
GO

CREATE NONCLUSTERED INDEX [IX_news_status] ON [dbo].[news]([status]);
CREATE NONCLUSTERED INDEX [IX_news_slug] ON [dbo].[news]([slug]);

-- ============================================
-- 11. BANNERS
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[banners]') AND type in (N'U'))
BEGIN
CREATE TABLE [dbo].[banners] (
    [id] INT IDENTITY(1,1) PRIMARY KEY,
    [title] NVARCHAR(200) NULL,
    [subtitle] NVARCHAR(500) NULL,
    [image] NVARCHAR(255) NOT NULL,
    [link] NVARCHAR(255) NULL,
    [sort_order] INT NOT NULL DEFAULT 0,
    [status] NVARCHAR(20) NOT NULL DEFAULT 'active' CHECK ([status] IN ('active', 'inactive')),
    [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
    [updated_at] DATETIME NOT NULL DEFAULT GETDATE()
);
END
GO

-- ============================================
-- 12. SETTINGS
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[settings]') AND type in (N'U'))
BEGIN
CREATE TABLE [dbo].[settings] (
    [id] INT IDENTITY(1,1) PRIMARY KEY,
    [key] NVARCHAR(100) NOT NULL UNIQUE,
    [value] NVARCHAR(MAX) NULL,
    [group_name] NVARCHAR(100) NOT NULL DEFAULT 'general',
    [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
    [updated_at] DATETIME NOT NULL DEFAULT GETDATE()
);
END
GO

-- ============================================
-- 13. FAQS
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[faqs]') AND type in (N'U'))
BEGIN
CREATE TABLE [dbo].[faqs] (
    [id] INT IDENTITY(1,1) PRIMARY KEY,
    [question] NVARCHAR(500) NOT NULL,
    [answer] NVARCHAR(MAX) NOT NULL,
    [sort_order] INT NOT NULL DEFAULT 0,
    [status] NVARCHAR(20) NOT NULL DEFAULT 'active' CHECK ([status] IN ('active', 'inactive')),
    [created_at] DATETIME NOT NULL DEFAULT GETDATE()
);
END
GO

-- ============================================
-- 14. TIMELINE EVENTS
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[timeline_events]') AND type in (N'U'))
BEGIN
CREATE TABLE [dbo].[timeline_events] (
    [id] INT IDENTITY(1,1) PRIMARY KEY,
    [year] NVARCHAR(10) NOT NULL,
    [title] NVARCHAR(200) NOT NULL,
    [description] NVARCHAR(MAX) NULL,
    [icon] NVARCHAR(50) NULL,
    [sort_order] INT NOT NULL DEFAULT 0,
    [status] NVARCHAR(20) NOT NULL DEFAULT 'active' CHECK ([status] IN ('active', 'inactive')),
    [created_at] DATETIME NOT NULL DEFAULT GETDATE()
);
END
GO

-- ============================================
-- 15. BRANDS
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[brands]') AND type in (N'U'))
BEGIN
CREATE TABLE [dbo].[brands] (
    [id] INT IDENTITY(1,1) PRIMARY KEY,
    [name] NVARCHAR(100) NOT NULL,
    [icon] NVARCHAR(100) NULL,
    [image] NVARCHAR(255) NULL,
    [sort_order] INT NOT NULL DEFAULT 0,
    [status] NVARCHAR(20) NOT NULL DEFAULT 'active' CHECK ([status] IN ('active', 'inactive')),
    [created_at] DATETIME NOT NULL DEFAULT GETDATE()
);
END
GO

-- ============================================
-- SEED DATA
-- ============================================

-- Insert default admin (password: admin123456 - bcrypt hash)
IF NOT EXISTS (SELECT * FROM [dbo].[users] WHERE [email] = 'admin@dienlanhnguyenhung.vn')
BEGIN
    INSERT INTO [dbo].[users] ([name], [email], [phone], [password_hash], [role], [status])
    VALUES (N'Admin Nguyễn Hùng', 'admin@dienlanhnguyenhung.vn', '02822422822', '$2a$10$ldAMbCbC.FvxmGRNGtbc5.eIeLD69pmlOPhGjoAfZBdG1JxKlPUK6', 'admin', 'active');
END
GO

UPDATE dbo.users
SET role_id = (SELECT id FROM dbo.roles WHERE slug = 'administrator'),
    username = COALESCE(username, 'admin')
WHERE email = 'admin@dienlanhnguyenhung.vn' AND role = 'admin';
GO

-- Repair Vietnamese text in databases initialized with an older seed file.
UPDATE [dbo].[users]
SET [name] = N'Admin Nguyễn Hùng', [updated_at] = GETDATE()
WHERE [email] = 'admin@dienlanhnguyenhung.vn';

UPDATE [dbo].[settings]
SET [value] = CASE [key]
    WHEN 'site_name' THEN N'Điện Lạnh Nguyễn Hùng'
    WHEN 'site_description' THEN N'Dịch vụ sửa chữa, bảo trì và lắp đặt thiết bị điện lạnh chuyên nghiệp'
    WHEN 'address' THEN N'2 Hoàng Ngân, Phú Định, Quận 8, TP. HCM'
    WHEN 'about_experience' THEN N'14+ Năm kinh nghiệm'
    ELSE [value]
END
WHERE [key] IN ('site_name', 'site_description', 'address', 'about_experience');

UPDATE [dbo].[services]
SET [name] = CASE [slug]
        WHEN 'sua-may-lanh' THEN N'Sửa máy lạnh'
        WHEN 've-sinh-may-lanh' THEN N'Vệ sinh máy lạnh'
        WHEN 'lap-dat-may-lanh' THEN N'Lắp đặt máy lạnh'
        WHEN 'sua-tu-lanh' THEN N'Sửa tủ lạnh'
        WHEN 'sua-may-giat' THEN N'Sửa máy giặt'
        WHEN 'sua-may-nuoc-nong' THEN N'Sửa máy nước nóng'
        ELSE [name]
    END,
    [description] = CASE [slug]
        WHEN 'sua-may-lanh' THEN N'Sửa chữa mọi loại máy lạnh, điều hòa. Khắc phục nhanh các lỗi: không lạnh, chảy nước, kêu ồn, hết gas...'
        WHEN 've-sinh-may-lanh' THEN N'Vệ sinh máy lạnh định kỳ, sạch sẽ, bơm gas, kiểm tra tổng quát giúp máy hoạt động hiệu quả, tiết kiệm điện.'
        WHEN 'lap-dat-may-lanh' THEN N'Lắp đặt máy lạnh mới, di dời máy lạnh. Thi công chuyên nghiệp, đảm bảo an toàn và thẩm mỹ.'
        WHEN 'sua-tu-lanh' THEN N'Sửa chữa tủ lạnh mọi thương hiệu. Xử lý các lỗi: không lạnh, chảy nước, kêu to, ngắt điện liên tục.'
        WHEN 'sua-may-giat' THEN N'Sửa chữa máy giặt lồng đứng, lồng ngang. Khắc phục lỗi không vắt, không xả, kêu ồn, báo lỗi.'
        WHEN 'sua-may-nuoc-nong' THEN N'Sửa bình nóng lạnh, máy nước nóng năng lượng mặt trời. Đảm bảo an toàn tuyệt đối cho gia đình bạn.'
        ELSE [description]
    END,
    [updated_at] = GETDATE()
WHERE [slug] IN ('sua-may-lanh', 've-sinh-may-lanh', 'lap-dat-may-lanh', 'sua-tu-lanh', 'sua-may-giat', 'sua-may-nuoc-nong');
GO

-- Insert settings
IF NOT EXISTS (SELECT * FROM [dbo].[settings] WHERE [key] = 'site_name')
BEGIN
    INSERT INTO [dbo].[settings] ([key], [value], [group_name]) VALUES
    ('site_name', N'Điện Lạnh Nguyễn Hùng', 'general'),
    ('site_description', N'Dịch vụ sửa chữa, bảo trì và lắp đặt thiết bị điện lạnh chuyên nghiệp', 'general'),
    ('hotline', '028 2242 2822', 'contact'),
    ('email', 'info@dienlanhnguyenhung.vn', 'contact'),
    ('address', N'2 Hoàng Ngân, Phú Định, Quận 8, TP. HCM', 'contact'),
    ('working_hours', N'7:45 - 17:30CN)', 'contact'),
    ('facebook_url', 'https://facebook.com/dienlanhnguyenhung', 'social'),
    ('zalo_phone', '02822422822', 'social'),
    ('youtube_url', 'https://youtube.com/@dienlanhnguyenhung', 'social'),
    ('about_experience', N'14+ Năm kinh nghiệm', 'about'),
    ('about_customers', '5000+', 'about');
END
GO

-- Insert services
IF NOT EXISTS (SELECT * FROM [dbo].[services] WHERE [slug] = 'sua-may-lanh')
BEGIN
    INSERT INTO [dbo].[services] ([name], [slug], [icon], [description], [price_range], [sort_order]) VALUES
    (N'Sửa máy lạnh', 'sua-may-lanh', 'fa-snowflake', N'Sửa chữa mọi loại máy lạnh, điều hòa. Khắc phục nhanh các lỗi: không lạnh, chảy nước, kêu ồn, hết gas...', '200.000 - 2.000.000', 1),
    (N'Vệ sinh máy lạnh', 've-sinh-may-lanh', 'fa-broom', N'Vệ sinh máy lạnh định kỳ, sạch sẽ, bơm gas, kiểm tra tổng quát giúp máy hoạt động hiệu quả, tiết kiệm điện.', '150.000 - 500.000', 2),
    (N'Lắp đặt máy lạnh', 'lap-dat-may-lanh', 'fa-tools', N'Lắp đặt máy lạnh mới, di dời máy lạnh. Thi công chuyên nghiệp, đảm bảo an toàn và thẩm mỹ.', '500.000 - 1.500.000', 3),
    (N'Sửa tủ lạnh', 'sua-tu-lanh', 'fa-temperature-low', N'Sửa chữa tủ lạnh mọi thương hiệu. Xử lý các lỗi: không lạnh, chảy nước, kêu to, ngắt điện liên tục.', '250.000 - 1.500.000', 4),
    (N'Sửa máy giặt', 'sua-may-giat', 'fa-soap', N'Sửa chữa máy giặt lồng đứng, lồng ngang. Khắc phục lỗi không vắt, không xả, kêu ồn, báo lỗi.', '200.000 - 1.800.000', 5),
    (N'Sửa máy nước nóng', 'sua-may-nuoc-nong', 'fa-fire', N'Sửa bình nóng lạnh, máy nước nóng năng lượng mặt trời. Đảm bảo an toàn tuyệt đối cho gia đình bạn.', '150.000 - 600.000', 6);
END
GO

-- Additional built-in services (kept separate so existing databases can be upgraded safely).
IF NOT EXISTS (SELECT * FROM [dbo].[services] WHERE [slug] = 've-sinh-may-giat')
    INSERT INTO [dbo].[services] ([name], [slug], [icon], [description], [price_range], [sort_order])
    VALUES (N'Vệ sinh máy giặt', 've-sinh-may-giat', 'fa-soap', N'Vệ sinh máy giặt cửa trên, cửa ngang, loại bỏ bụi bẩn, cặn bám và mùi hôi. Giúp máy hoạt động sạch sẽ, hiệu quả và bền hơn.', N'Liên hệ', 7);
GO

IF NOT EXISTS (SELECT * FROM [dbo].[services] WHERE [slug] = 'trien-khai-he-thong-dien-lanh')
    INSERT INTO [dbo].[services] ([name], [slug], [icon], [description], [price_range], [sort_order])
    VALUES (N'Triển khai hệ thống điện lạnh', 'trien-khai-he-thong-dien-lanh', 'fa-drafting-compass', N'Thi công, lắp đặt hệ thống điện lạnh cho nhà ở, văn phòng, cửa hàng và công trình. Đảm bảo đúng kỹ thuật, an toàn và tối ưu hiệu quả.', N'Liên hệ', 8);
GO

IF NOT EXISTS (SELECT * FROM [dbo].[services] WHERE [slug] = 'bao-tri-he-thong-dien-lanh')
    INSERT INTO [dbo].[services] ([name], [slug], [icon], [description], [price_range], [sort_order])
    VALUES (N'Bảo trì hệ thống điện lạnh', 'bao-tri-he-thong-dien-lanh', 'fa-cogs', N'Kiểm tra, bảo dưỡng và bảo trì định kỳ hệ thống điện lạnh. Phát hiện sớm sự cố, duy trì hiệu suất hoạt động và kéo dài tuổi thọ thiết bị.', N'Liên hệ', 9);
GO

-- Keep the built-in services associated with their matching image assets.
UPDATE [dbo].[services]
SET [image] = CASE [slug]
    WHEN 'sua-may-lanh' THEN 'dich-vu/suamaylanh.png'
    WHEN 've-sinh-may-lanh' THEN 'dich-vu/vsmaylanh.png'
    WHEN 'lap-dat-may-lanh' THEN 'dich-vu/ldmaylanh.png'
    WHEN 'sua-tu-lanh' THEN 'dich-vu/suatulanh.png'
    WHEN 'sua-may-giat' THEN 'dich-vu/suamaygiat.png'
    WHEN 'sua-may-nuoc-nong' THEN 'dich-vu/suamaynong.png'
    WHEN 've-sinh-may-giat' THEN 'dich-vu/vsmaygiat.png'
    WHEN 'trien-khai-he-thong-dien-lanh' THEN 'dich-vu/hethong.png'
    WHEN 'bao-tri-he-thong-dien-lanh' THEN 'dich-vu/baotrihethong.png'
    ELSE [image]
END
WHERE [slug] IN (
    'sua-may-lanh', 've-sinh-may-lanh', 'lap-dat-may-lanh',
    'sua-tu-lanh', 'sua-may-giat', 'sua-may-nuoc-nong',
    've-sinh-may-giat', 'trien-khai-he-thong-dien-lanh', 'bao-tri-he-thong-dien-lanh'
);
GO

-- ============================================
-- SEED DATA: PRICING
-- ============================================
IF NOT EXISTS (SELECT * FROM [dbo].[pricing] WHERE [id] = 1)
BEGIN
    INSERT INTO [dbo].[pricing] ([service_id], [category], [item_name], [description], [price], [sort_order], [status])
    VALUES
    (1, N'Sửa máy lạnh', N'Kiểm tra tổng quát máy lạnh', N'Kiểm tra toàn bộ hoạt động của máy lạnh', N'Miễn phí', 1, 'active'),
    (1, N'Sửa máy lạnh', N'Bơm gas máy lạnh (R22)', N'Bơm gas R22 cho máy lạnh 1HP - 2HP', N'300.000 - 600.000', 2, 'active'),
    (1, N'Sửa máy lạnh', N'Bơm gas máy lạnh (R410A)', N'Bơm gas R410A cho máy lạnh 1HP - 2HP', N'500.000 - 900.000', 3, 'active'),
    (1, N'Sửa máy lạnh', N'Sửa board máy lạnh', N'Sửa chữa board điều khiển máy lạnh', N'400.000 - 1.200.000', 4, 'active'),
    (1, N'Sửa máy lạnh', N'Thay tụ máy lạnh', N'Thay tụ khởi động máy lạnh', N'250.000 - 500.000', 5, 'active'),
    (1, N'Sửa máy lạnh', N'Thay block máy lạnh', N'Thay block (máy nén) cho máy lạnh', N'1.500.000 - 3.500.000', 6, 'active'),
    (2, N'Vệ sinh máy lạnh', N'Vệ sinh máy lạnh cơ bản', N'Vệ sinh dàn nóng, dàn lạnh, lưới lọc', N'150.000 - 250.000', 1, 'active'),
    (2, N'Vệ sinh máy lạnh', N'Vệ sinh máy lạnh cao cấp', N'Vệ sinh sâu, súc xả, kiểm tra gas, tra dầu quạt', N'300.000 - 500.000', 2, 'active'),
    (3, N'Lắp đặt máy lạnh', N'Lắp đặt máy lạnh mới (1HP)', N'Lắp đặt máy lạnh 1HP, bao gồm vật tư cơ bản', N'800.000 - 1.200.000', 1, 'active'),
    (3, N'Lắp đặt máy lạnh', N'Lắp đặt máy lạnh mới (2HP)', N'Lắp đặt máy lạnh 2HP, bao gồm vật tư cơ bản', N'1.200.000 - 1.800.000', 2, 'active'),
    (3, N'Lắp đặt máy lạnh', N'Di dời máy lạnh', N'Tháo dỡ, di chuyển và lắp đặt lại máy lạnh', N'500.000 - 1.000.000', 3, 'active'),
    (4, N'Sửa tủ lạnh', N'Kiểm tra tổng quát tủ lạnh', N'Kiểm tra toàn bộ hoạt động tủ lạnh', N'Miễn phí', 1, 'active'),
    (4, N'Sửa tủ lạnh', N'Sửa rơ-le tủ lạnh', N'Thay thế rơ-le khởi động tủ lạnh', N'300.000 - 500.000', 2, 'active'),
    (4, N'Sửa tủ lạnh', N'Sửa board tủ lạnh', N'Sửa board điều khiển tủ lạnh', N'500.000 - 1.200.000', 3, 'active'),
    (4, N'Sửa tủ lạnh', N'Bơm gas tủ lạnh', N'Bơm gas cho tủ lạnh', N'500.000 - 1.000.000', 4, 'active'),
    (4, N'Sửa tủ lạnh', N'Thay block tủ lạnh', N'Thay block (máy nén) tủ lạnh', N'1.500.000 - 3.000.000', 5, 'active'),
    (5, N'Sửa máy giặt', N'Kiểm tra tổng quát máy giặt', N'Kiểm tra toàn bộ hoạt động máy giặt', N'Miễn phí', 1, 'active'),
    (5, N'Sửa máy giặt', N'Sửa board máy giặt', N'Sửa board điều khiển máy giặt', N'400.000 - 1.000.000', 2, 'active'),
    (5, N'Sửa máy giặt', N'Thay động cơ máy giặt', N'Thay motor máy giặt', N'800.000 - 1.800.000', 3, 'active'),
    (5, N'Sửa máy giặt', N'Thay bơm xả máy giặt', N'Thay bơm xả nước máy giặt', N'400.000 - 700.000', 4, 'active'),
    (5, N'Sửa máy giặt', N'Sửa hộp số máy giặt', N'Sửa chữa hộp số máy giặt', N'500.000 - 1.200.000', 5, 'active'),
    (6, N'Sửa máy nước nóng', N'Kiểm tra tổng quát máy nước nóng', N'Kiểm tra toàn bộ hoạt động máy nước nóng', N'Miễn phí', 1, 'active'),
    (6, N'Sửa máy nước nóng', N'Thay thanh đốt máy nước nóng', N'Thay thanh gia nhiệt máy nước nóng', N'300.000 - 600.000', 2, 'active'),
    (6, N'Sửa máy nước nóng', N'Sửa rơ-le máy nước nóng', N'Thay rơ-le nhiệt máy nước nóng', N'250.000 - 450.000', 3, 'active'),
    (6, N'Sửa máy nước nóng', N'Sửa van an toàn máy nước nóng', N'Thay van an toàn máy nước nóng', N'200.000 - 400.000', 4, 'active'),
    (6, N'Sửa máy nước nóng', N'Sửa board máy nước nóng', N'Sửa board điều khiển máy nước nóng', N'350.000 - 800.000', 5, 'active');
END
GO

-- ============================================
-- SEED DATA: TIMELINE EVENTS
-- ============================================
IF NOT EXISTS (SELECT * FROM [dbo].[timeline_events] WHERE [id] = 1)
BEGIN
    INSERT INTO [dbo].[timeline_events] ([year], [title], [description], [icon], [sort_order], [status])
    VALUES
    (N'2012', N'Thành lập doanh nghiệp', N'CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ NGUYÊN HÙNG REE chính thức đi vào hoạt động, định hướng phát triển trong lĩnh vực kinh doanh và dịch vụ điện máy, điện lạnh.', 'fa-flag', 1, 'active'),
    (N'2015', N'Mở rộng hoạt động kinh doanh', N'Từng bước mở rộng danh mục sản phẩm điện máy, điện lạnh và nâng cao khả năng đáp ứng nhu cầu của khách hàng.', 'fa-users', 2, 'active'),
    (N'2018', N'Phát triển dịch vụ kỹ thuật', N'Đẩy mạnh các dịch vụ tư vấn, lắp đặt, bảo trì và sửa chữa thiết bị điện lạnh, nâng cao chất lượng phục vụ.', 'fa-star', 3, 'active'),
    (N'2022', N'Nâng cao chất lượng phục vụ', N'Tập trung hoàn thiện quy trình phục vụ, nâng cao chất lượng sản phẩm và dịch vụ, hướng đến trải nghiệm khách hàng tốt hơn.', 'fa-rocket', 4, 'active'),
    (N'2026', N'Tiếp tục phát triển', N'Tiếp tục xây dựng thương hiệu Nguyên Hùng REE, mở rộng hoạt động kinh doanh và dịch vụ điện máy, điện lạnh, hướng đến sự chuyên nghiệp và lâu dài.', 'fa-trophy', 5, 'active');
END
GO

-- ============================================
-- SEED DATA: FAQS
-- ============================================
IF NOT EXISTS (SELECT * FROM [dbo].[faqs] WHERE [id] = 1)
BEGIN
    INSERT INTO [dbo].[faqs] ([question], [answer], [sort_order], [status])
    VALUES
    (N'Quy trình đặt lịch sửa chữa như thế nào?', N'Bạn có thể gọi điện trực tiếp đến hotline, đặt lịch qua website hoặc nhắn tin qua fanpage. Sau khi tiếp nhận, chúng tôi sẽ sắp xếp kỹ thuật viên đến kiểm tra và sửa chữa trong thời gian sớm nhất, thường là trong vòng 30 phút tại khu vực nội thành.', 1, 'active'),
    (N'Chi phí sửa chữa được tính như thế nào?', N'Chúng tôi luôn báo giá trước khi tiến hành sửa chữa. Chi phí bao gồm phí kiểm tra, công sửa chữa và linh kiện thay thế (nếu có). Cam kết không phát sinh chi phí ngoài thỏa thuận. Bạn có thể xem bảng giá tham khảo trên website của chúng tôi.', 2, 'active'),
    (N'Thời gian bảo hành dịch vụ là bao lâu?', N'Tùy vào từng loại dịch vụ và linh kiện thay thế, thời gian bảo hành dao động từ 3 tháng đến 12 tháng. Chi tiết thời gian bảo hành sẽ được ghi rõ trong phiếu bảo hành khi hoàn thành dịch vụ.', 3, 'active'),
    (N'Các khu vực nào được phục vụ?', N'Chúng tôi phục vụ tất cả các quận huyện tại TP.HCM và các khu vực lân cận như Bình Dương, Đồng Nai, Long An. Đối với khu vực nội thành, thời gian có mặt chỉ từ 30 phút.', 5, 'active'),
    (N'Có chính sách ưu đãi cho khách hàng thân thiết không?', N'Chúng tôi có nhiều chính sách ưu đãi dành cho khách hàng thân thiết, khách hàng giới thiệu và khách hàng sử dụng dịch vụ định kỳ. Vui lòng liên hệ trực tiếp để được tư vấn chi tiết.', 6, 'active');
END
GO

-- ============================================
-- SEED DATA: BRANDS
-- ============================================
IF NOT EXISTS (SELECT * FROM [dbo].[brands] WHERE [id] = 1)
BEGIN
    INSERT INTO [dbo].[brands] ([name], [icon], [image], [sort_order], [status])
    VALUES
    (N'Daikin', 'fa-snowflake', NULL, 1, 'active'),
    (N'Panasonic', 'fa-wind', NULL, 2, 'active'),
    (N'LG', 'fa-microchip', NULL, 3, 'active'),
    (N'Samsung', 'fa-mobile-alt', NULL, 4, 'active'),
    (N'Toshiba', 'fa-server', NULL, 5, 'active'),
    (N'Mitsubishi', 'fa-car-battery', NULL, 6, 'active'),
    (N'Sharp', 'fa-cut', NULL, 7, 'active'),
    (N'Aqua', 'fa-droplet', NULL, 8, 'active'),
    (N'Electrolux', 'fa-plug', NULL, 9, 'active'),
    (N'Hitachi', 'fa-bolt', NULL, 10, 'active');
END
GO

