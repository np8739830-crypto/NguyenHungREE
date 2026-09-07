IF COL_LENGTH('dbo.bookings', 'request_code') IS NULL
BEGIN
    ALTER TABLE dbo.bookings ADD request_code AS (
        'DL-' + CONVERT(char(8), created_at, 112) + '-' +
        CASE
            WHEN id < 1000 THEN RIGHT('0000' + CONVERT(varchar(20), id), 4)
            ELSE CONVERT(varchar(20), id)
        END
    ) PERSISTED;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_bookings_request_code' AND object_id = OBJECT_ID('dbo.bookings'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_bookings_request_code ON dbo.bookings(request_code);
END
GO

IF COL_LENGTH('dbo.contacts', 'request_code') IS NULL
BEGIN
    ALTER TABLE dbo.contacts ADD request_code AS (
        'LH-' + CONVERT(char(8), created_at, 112) + '-' +
        CASE
            WHEN id < 1000 THEN RIGHT('0000' + CONVERT(varchar(20), id), 4)
            ELSE CONVERT(varchar(20), id)
        END
    ) PERSISTED;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_contacts_request_code' AND object_id = OBJECT_ID('dbo.contacts'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_contacts_request_code ON dbo.contacts(request_code);
END
GO
