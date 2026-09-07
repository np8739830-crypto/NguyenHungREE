/* Run once against the DienLanhNguyenHung database before enabling the
   service-operation admin screens.  Every statement is idempotent. */
IF COL_LENGTH('dbo.services', 'category') IS NULL
    ALTER TABLE dbo.services ADD category NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.services', 'duration_minutes') IS NULL
    ALTER TABLE dbo.services ADD duration_minutes INT NULL;
IF COL_LENGTH('dbo.services', 'common_issues') IS NULL
    ALTER TABLE dbo.services ADD common_issues NVARCHAR(MAX) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.technicians') AND type = N'U')
BEGIN
    CREATE TABLE dbo.technicians (
        id INT IDENTITY(1,1) PRIMARY KEY,
        full_name NVARCHAR(100) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        email VARCHAR(100) NULL,
        specialty NVARCHAR(100) NULL,
        service_area NVARCHAR(255) NULL,
        work_status VARCHAR(20) NOT NULL DEFAULT 'available',
        created_at DATETIME NOT NULL DEFAULT GETDATE()
    );
END
GO

IF COL_LENGTH('dbo.bookings', 'technician_id') IS NULL
    ALTER TABLE dbo.bookings ADD technician_id INT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_bookings_technicians')
    ALTER TABLE dbo.bookings ADD CONSTRAINT FK_bookings_technicians
        FOREIGN KEY (technician_id) REFERENCES dbo.technicians(id) ON DELETE SET NULL;
IF COL_LENGTH('dbo.bookings', 'scheduled_date') IS NULL
    ALTER TABLE dbo.bookings ADD scheduled_date DATE NULL;
IF COL_LENGTH('dbo.bookings', 'scheduled_time') IS NULL
    ALTER TABLE dbo.bookings ADD scheduled_time NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.bookings', 'work_note') IS NULL
    ALTER TABLE dbo.bookings ADD work_note NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.bookings', 'estimated_cost') IS NULL
    ALTER TABLE dbo.bookings ADD estimated_cost DECIMAL(18,2) NULL;
IF COL_LENGTH('dbo.bookings', 'actual_cost') IS NULL
    ALTER TABLE dbo.bookings ADD actual_cost DECIMAL(18,2) NULL;
IF COL_LENGTH('dbo.bookings', 'payment_status') IS NULL
    ALTER TABLE dbo.bookings ADD payment_status NVARCHAR(20) NOT NULL DEFAULT 'unpaid'
        CHECK (payment_status IN ('unpaid', 'paid', 'partial'));
IF COL_LENGTH('dbo.bookings', 'assigned_at') IS NULL
    ALTER TABLE dbo.bookings ADD assigned_at DATETIME NULL;
IF COL_LENGTH('dbo.bookings', 'completed_at') IS NULL
    ALTER TABLE dbo.bookings ADD completed_at DATETIME NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_bookings_technician_status')
    CREATE INDEX IX_bookings_technician_status ON dbo.bookings(technician_id, status);
GO
