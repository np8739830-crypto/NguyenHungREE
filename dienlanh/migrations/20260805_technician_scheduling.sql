/* Safe to run repeatedly. Extends the existing technician/booking schema. */
IF COL_LENGTH('dbo.technicians', 'avatar') IS NULL ALTER TABLE dbo.technicians ADD avatar NVARCHAR(500) NULL;
IF COL_LENGTH('dbo.technicians', 'experience') IS NULL ALTER TABLE dbo.technicians ADD experience NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.technicians', 'rating') IS NULL ALTER TABLE dbo.technicians ADD rating DECIMAL(3,2) NULL;
IF COL_LENGTH('dbo.technicians', 'updated_at') IS NULL ALTER TABLE dbo.technicians ADD updated_at DATETIME NOT NULL DEFAULT GETDATE();
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_bookings_technician_slot')
    CREATE INDEX IX_bookings_technician_slot ON dbo.bookings(technician_id, booking_date, booking_time, status);
GO
