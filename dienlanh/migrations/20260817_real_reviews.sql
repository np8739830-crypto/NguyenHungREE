IF OBJECT_ID(N'dbo.reviews', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.reviews (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NULL,
        name NVARCHAR(100) NOT NULL,
        contact NVARCHAR(150) NOT NULL,
        service_id INT NULL,
        service_name NVARCHAR(200) NULL,
        rating INT NOT NULL,
        content NVARCHAR(2000) NOT NULL,
        status NVARCHAR(20) NOT NULL CONSTRAINT DF_reviews_status DEFAULT 'pending',
        created_at DATETIME NOT NULL CONSTRAINT DF_reviews_created_at DEFAULT GETDATE(),
        updated_at DATETIME NOT NULL CONSTRAINT DF_reviews_updated_at DEFAULT GETDATE(),
        CONSTRAINT CK_reviews_rating CHECK (rating BETWEEN 1 AND 5),
        CONSTRAINT CK_reviews_status CHECK (status IN ('pending', 'approved', 'hidden'))
    );
END;
GO

IF COL_LENGTH('dbo.reviews', 'contact') IS NULL
    ALTER TABLE dbo.reviews ADD contact NVARCHAR(150) NULL;
IF COL_LENGTH('dbo.reviews', 'service_id') IS NULL
    ALTER TABLE dbo.reviews ADD service_id INT NULL;
IF COL_LENGTH('dbo.reviews', 'service_name') IS NULL
    ALTER TABLE dbo.reviews ADD service_name NVARCHAR(200) NULL;
GO

-- Remove only the legacy sample reviews previously shipped with this project.
DELETE FROM dbo.reviews
WHERE content LIKE N'Máy lạnh nhà tôi bị hư giữa mùa nóng, gọi điện là có kỹ thuật viên đến ngay trong 30 phút.%'
   OR content LIKE N'Dịch vụ vệ sinh máy lạnh rất chuyên nghiệp. Kỹ thuật viên thân thiện, làm việc cẩn thận, sạch sẽ.%'
   OR content LIKE N'Đã sử dụng dịch vụ sửa tủ lạnh. Nhân viên tư vấn nhiệt tình, báo giá trước, không phát sinh chi phí.%'
   OR content LIKE N'Kỹ thuật viên rất chuyên nghiệp, sửa máy giặt tại nhà nhanh chóng. Giá cả phải chăng,%'
   OR content LIKE N'Điện Máy Nguyên Hùng là địa chỉ tin cậy của gia đình tôi.%'
   OR content LIKE N'Điện Lạnh Nguyên Hùng là địa chỉ tin cậy của gia đình tôi.%';
GO

DECLARE @statusConstraint SYSNAME;
SELECT TOP 1 @statusConstraint = cc.name
FROM sys.check_constraints cc
WHERE cc.parent_object_id = OBJECT_ID(N'dbo.reviews')
  AND cc.definition LIKE '%status%';
IF @statusConstraint IS NOT NULL
BEGIN
    DECLARE @dropStatusConstraintSql NVARCHAR(500) = N'ALTER TABLE dbo.reviews DROP CONSTRAINT ' + QUOTENAME(@statusConstraint);
    EXEC sys.sp_executesql @dropStatusConstraintSql;
END;
GO

-- Normalize the old rejected state to the new explicit hidden state.
UPDATE dbo.reviews SET status = 'hidden' WHERE status = 'rejected';
GO

ALTER TABLE dbo.reviews ADD CONSTRAINT CK_reviews_status_real
    CHECK (status IN ('pending', 'approved', 'hidden'));
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_reviews_status_created' AND object_id = OBJECT_ID('dbo.reviews'))
    CREATE INDEX IX_reviews_status_created ON dbo.reviews(status, created_at DESC);
GO

-- Remove the legacy hard-coded satisfaction statistic; future statistics must be calculated from approved reviews.
IF OBJECT_ID(N'dbo.settings', N'U') IS NOT NULL
    DELETE FROM dbo.settings WHERE [key] = 'about_satisfaction' AND [value] = '98%';
GO
