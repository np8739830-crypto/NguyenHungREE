IF OBJECT_ID(N'dbo.password_resets', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.password_resets (
        id INT IDENTITY(1,1) PRIMARY KEY,
        email NVARCHAR(100) NULL,
        token NVARCHAR(255) NULL,
        user_id INT NOT NULL,
        token_hash CHAR(64) NOT NULL,
        otp_hash NVARCHAR(255) NULL,
        otp_attempts INT NOT NULL CONSTRAINT DF_password_resets_otp_attempts DEFAULT 0,
        verified_at DATETIME2 NULL,
        verification_hash CHAR(64) NULL,
        expires_at DATETIME2 NOT NULL,
        used BIT NOT NULL CONSTRAINT DF_password_resets_used DEFAULT 0,
        used_at DATETIME2 NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_password_resets_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_password_resets_user FOREIGN KEY (user_id) REFERENCES dbo.users(id)
    );
END
ELSE
BEGIN
    IF COL_LENGTH('dbo.password_resets', 'user_id') IS NULL ALTER TABLE dbo.password_resets ADD user_id INT NULL;
    IF COL_LENGTH('dbo.password_resets', 'token_hash') IS NULL ALTER TABLE dbo.password_resets ADD token_hash CHAR(64) NULL;
    IF COL_LENGTH('dbo.password_resets', 'used_at') IS NULL ALTER TABLE dbo.password_resets ADD used_at DATETIME2 NULL;
    IF COL_LENGTH('dbo.password_resets', 'otp_hash') IS NULL ALTER TABLE dbo.password_resets ADD otp_hash NVARCHAR(255) NULL;
    IF COL_LENGTH('dbo.password_resets', 'otp_attempts') IS NULL ALTER TABLE dbo.password_resets ADD otp_attempts INT NOT NULL CONSTRAINT DF_password_resets_otp_attempts DEFAULT 0;
    IF COL_LENGTH('dbo.password_resets', 'verified_at') IS NULL ALTER TABLE dbo.password_resets ADD verified_at DATETIME2 NULL;
    IF COL_LENGTH('dbo.password_resets', 'verification_hash') IS NULL ALTER TABLE dbo.password_resets ADD verification_hash CHAR(64) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.password_resets') AND name = 'IX_password_resets_token_hash')
    CREATE INDEX IX_password_resets_token_hash ON dbo.password_resets(token_hash) INCLUDE (user_id, expires_at, used);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.password_resets') AND name = 'IX_password_resets_user_created')
    CREATE INDEX IX_password_resets_user_created ON dbo.password_resets(user_id, created_at DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.password_resets') AND name = 'IX_password_resets_verification_hash')
    CREATE INDEX IX_password_resets_verification_hash ON dbo.password_resets(verification_hash) INCLUDE (user_id, verified_at, used);
GO
