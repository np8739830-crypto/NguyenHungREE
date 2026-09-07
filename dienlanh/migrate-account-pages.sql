-- Run once for existing installations before using the customer account pages.
USE [DienLanhNguyenHung];
GO

IF COL_LENGTH('dbo.users', 'address') IS NULL
    ALTER TABLE dbo.users ADD address NVARCHAR(300) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_bookings_user_id' AND object_id = OBJECT_ID('dbo.bookings'))
    CREATE INDEX IX_bookings_user_id ON dbo.bookings(user_id);
GO
