SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.payroll_revenue', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.payroll_revenue (
        id INT IDENTITY(1,1) PRIMARY KEY,
        technician_id INT NOT NULL REFERENCES dbo.technicians(id),
        revenue_month TINYINT NOT NULL CHECK (revenue_month BETWEEN 1 AND 12),
        revenue_year SMALLINT NOT NULL CHECK (revenue_year BETWEEN 2000 AND 2100),
        revenue_amount DECIMAL(18,2) NOT NULL CHECK (revenue_amount >= 0),
        source VARCHAR(20) NOT NULL CONSTRAINT DF_payroll_revenue_manual_source DEFAULT 'manual'
            CHECK (source IN ('manual')),
        note NVARCHAR(1000) NULL,
        created_by INT NOT NULL REFERENCES dbo.users(id),
        created_at DATETIME2 NOT NULL CONSTRAINT DF_payroll_revenue_created DEFAULT SYSDATETIME(),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_payroll_revenue_updated DEFAULT SYSDATETIME(),
        CONSTRAINT UQ_payroll_revenue_period UNIQUE (technician_id, revenue_month, revenue_year)
    );
END;
GO

IF COL_LENGTH('dbo.payrolls', 'attendance_record_count') IS NULL
    ALTER TABLE dbo.payrolls ADD attendance_record_count INT NOT NULL
        CONSTRAINT DF_payroll_attendance_record_count DEFAULT 0;
GO
