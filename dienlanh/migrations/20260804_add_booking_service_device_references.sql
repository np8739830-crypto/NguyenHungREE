IF OBJECT_ID(N'dbo.devices', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.devices (
        id INT IDENTITY(1,1) PRIMARY KEY,
        slug NVARCHAR(100) NOT NULL UNIQUE,
        name NVARCHAR(100) NOT NULL,
        status NVARCHAR(20) NOT NULL CONSTRAINT DF_devices_status DEFAULT 'active'
    );
END;
GO

MERGE dbo.devices AS target
USING (VALUES
    (N'may-lanh', N'Máy lạnh'),
    (N'tu-lanh', N'Tủ lạnh'),
    (N'may-giat', N'Máy giặt'),
    (N'may-nuoc-nong', N'Máy nước nóng'),
    (N'khac', N'Thiết bị khác')
) AS source(slug, name)
ON target.slug = source.slug
WHEN NOT MATCHED THEN
    INSERT (slug, name) VALUES (source.slug, source.name);
GO

IF COL_LENGTH(N'dbo.bookings', N'service_id') IS NULL
    ALTER TABLE dbo.bookings ADD service_id INT NULL;
GO

IF COL_LENGTH(N'dbo.bookings', N'device_id') IS NULL
    ALTER TABLE dbo.bookings ADD device_id INT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_bookings_service')
    ALTER TABLE dbo.bookings ADD CONSTRAINT FK_bookings_service FOREIGN KEY (service_id) REFERENCES dbo.services(id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_bookings_device')
    ALTER TABLE dbo.bookings ADD CONSTRAINT FK_bookings_device FOREIGN KEY (device_id) REFERENCES dbo.devices(id);
GO

UPDATE b
SET service_id = s.id
FROM dbo.bookings b
JOIN dbo.services s ON b.service_type = s.slug
    OR b.service_type = s.name
    OR REPLACE(b.service_type, N'su-', N'sua-') = s.slug
WHERE b.service_id IS NULL;
GO

UPDATE b
SET device_id = d.id
FROM dbo.bookings b
JOIN dbo.devices d ON b.device_type = d.slug OR b.device_type = d.name
WHERE b.device_id IS NULL;
GO
