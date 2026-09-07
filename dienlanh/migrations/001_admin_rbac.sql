-- Role-based access control for the existing Admin system.
-- This migration is idempotent and preserves every existing user.

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
END;
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
END;
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
END;
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
    INSERT dbo.roles (name, slug, description, is_system) VALUES
        (N'Administrator', 'administrator', N'Toàn quyền hệ thống.', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE slug = 'manager')
    INSERT dbo.roles (name, slug, description, is_system) VALUES
        (N'Quản lý', 'manager', N'Quản lý vận hành dịch vụ, lịch đặt, khách hàng và kỹ thuật viên.', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE slug = 'staff')
    INSERT dbo.roles (name, slug, description, is_system) VALUES
        (N'Nhân viên', 'staff', N'Chỉ truy cập các module được cấp quyền.', 1);
GO

DECLARE @modules TABLE (module_key NVARCHAR(50), module_name NVARCHAR(100));
INSERT @modules VALUES
    ('dashboard', N'Bảng điều khiển'),
    ('services', N'Quản lý dịch vụ'),
    ('bookings', N'Lịch đặt dịch vụ'),
    ('customers', N'Khách hàng'),
    ('technicians', N'Kỹ thuật viên'),
    ('attendance', N'Chấm công'),
    ('payroll', N'Bảng lương'),
    ('contacts', N'Liên hệ'),
    ('reviews', N'Đánh giá'),
    ('telegram', N'Thông báo Telegram'),
    ('accounts', N'Tài khoản'),
    ('roles', N'Vai trò & Quyền hạn');

DECLARE @actions TABLE (action_key NVARCHAR(20), action_name NVARCHAR(50));
INSERT @actions VALUES ('view', N'Xem'), ('create', N'Thêm'), ('update', N'Sửa'), ('delete', N'Xóa');

INSERT dbo.permissions (module_key, action_key, name)
SELECT m.module_key, a.action_key, m.module_name + N' - ' + a.action_name
FROM @modules m CROSS JOIN @actions a
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.permissions p
    WHERE p.module_key = m.module_key AND p.action_key = a.action_key
);
GO

-- Administrator always owns every permission.
INSERT dbo.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM dbo.roles r CROSS JOIN dbo.permissions p
WHERE r.slug = 'administrator'
AND NOT EXISTS (
    SELECT 1 FROM dbo.role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
);
GO

-- Safe defaults for the existing operational manager role.
INSERT dbo.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM dbo.roles r
JOIN dbo.permissions p ON
    (p.module_key = 'dashboard' AND p.action_key = 'view') OR
    (p.module_key = 'services' AND p.action_key IN ('view', 'create', 'update')) OR
    (p.module_key = 'bookings' AND p.action_key IN ('view', 'create', 'update')) OR
    (p.module_key = 'customers' AND p.action_key IN ('view', 'create', 'update')) OR
    (p.module_key = 'technicians' AND p.action_key IN ('view', 'create', 'update')) OR
    (p.module_key = 'attendance' AND p.action_key IN ('view', 'create', 'update')) OR
    (p.module_key = 'payroll' AND p.action_key IN ('view', 'create', 'update')) OR
    (p.module_key = 'contacts' AND p.action_key = 'view')
    OR (p.module_key = 'reviews' AND p.action_key IN ('view', 'update', 'delete'))
WHERE r.slug = 'manager'
AND NOT EXISTS (
    SELECT 1 FROM dbo.role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
);
GO

-- Staff starts with dashboard access; Administrator can grant more modules.
INSERT dbo.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM dbo.roles r
JOIN dbo.permissions p ON p.module_key = 'dashboard' AND p.action_key = 'view'
WHERE r.slug = 'staff'
AND NOT EXISTS (
    SELECT 1 FROM dbo.role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
);
GO

UPDATE dbo.users
SET role_id = (SELECT id FROM dbo.roles WHERE slug = 'administrator'),
    username = COALESCE(username, CASE
        WHEN email = 'admin@dienlanhnguyenhung.vn' THEN 'admin'
        ELSE CONCAT('admin', id)
    END)
WHERE role = 'admin' AND role_id IS NULL;
GO
