-- Chạy một lần trên cơ sở dữ liệu DienLanhNguyenHung hiện có.
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[request_images]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[request_images] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [request_type] NVARCHAR(20) NOT NULL CHECK ([request_type] IN ('booking', 'contact')),
        [request_id] INT NOT NULL,
        -- request_id is retained for the existing application API.  The two
        -- nullable columns below provide real SQL Server foreign keys.
        [booking_id] INT NULL,
        [contact_id] INT NULL,
        [filename] NVARCHAR(255) NOT NULL UNIQUE,
        [mime_type] NVARCHAR(50) NOT NULL CHECK ([mime_type] IN ('image/jpeg', 'image/png', 'image/webp')),
        [size_bytes] INT NOT NULL CHECK ([size_bytes] > 0 AND [size_bytes] <= 5242880),
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT [CK_request_images_owner] CHECK (
            ([request_type] = 'booking' AND [booking_id] = [request_id] AND [contact_id] IS NULL)
            OR ([request_type] = 'contact' AND [contact_id] = [request_id] AND [booking_id] IS NULL)
        ),
        CONSTRAINT [FK_request_images_booking] FOREIGN KEY ([booking_id]) REFERENCES [dbo].[bookings]([id]),
        CONSTRAINT [FK_request_images_contact] FOREIGN KEY ([contact_id]) REFERENCES [dbo].[contacts]([id])
    );
    CREATE NONCLUSTERED INDEX [IX_request_images_request] ON [dbo].[request_images]([request_type], [request_id]);
END
ELSE
BEGIN
    -- Upgrade the earlier polymorphic version without deleting any rows.
    IF COL_LENGTH(N'dbo.request_images', N'booking_id') IS NULL
        ALTER TABLE [dbo].[request_images] ADD [booking_id] INT NULL;
    IF COL_LENGTH(N'dbo.request_images', N'contact_id') IS NULL
        ALTER TABLE [dbo].[request_images] ADD [contact_id] INT NULL;

    UPDATE [dbo].[request_images]
    SET [booking_id] = [request_id]
    WHERE [request_type] = 'booking' AND [booking_id] IS NULL;
    UPDATE [dbo].[request_images]
    SET [contact_id] = [request_id]
    WHERE [request_type] = 'contact' AND [contact_id] IS NULL;

    -- Stop safely rather than creating an untrusted FK over inconsistent data.
    IF EXISTS (
        SELECT 1 FROM [dbo].[request_images] ri
        LEFT JOIN [dbo].[bookings] b ON b.id = ri.booking_id
        LEFT JOIN [dbo].[contacts] c ON c.id = ri.contact_id
        WHERE (ri.request_type = 'booking' AND (ri.contact_id IS NOT NULL OR b.id IS NULL))
           OR (ri.request_type = 'contact' AND (ri.booking_id IS NOT NULL OR c.id IS NULL))
    )
        THROW 51000, 'request_images contains orphaned or inconsistent rows; no data was changed.', 1;

    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_request_images_owner' AND parent_object_id = OBJECT_ID(N'dbo.request_images'))
        ALTER TABLE [dbo].[request_images] ADD CONSTRAINT [CK_request_images_owner] CHECK (
            ([request_type] = 'booking' AND [booking_id] = [request_id] AND [contact_id] IS NULL)
            OR ([request_type] = 'contact' AND [contact_id] = [request_id] AND [booking_id] IS NULL)
        );
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_request_images_booking' AND parent_object_id = OBJECT_ID(N'dbo.request_images'))
        ALTER TABLE [dbo].[request_images] ADD CONSTRAINT [FK_request_images_booking] FOREIGN KEY ([booking_id]) REFERENCES [dbo].[bookings]([id]);
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_request_images_contact' AND parent_object_id = OBJECT_ID(N'dbo.request_images'))
        ALTER TABLE [dbo].[request_images] ADD CONSTRAINT [FK_request_images_contact] FOREIGN KEY ([contact_id]) REFERENCES [dbo].[contacts]([id]);
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_request_images_request' AND object_id = OBJECT_ID(N'dbo.request_images'))
        CREATE NONCLUSTERED INDEX [IX_request_images_request] ON [dbo].[request_images]([request_type], [request_id]);
END
GO
