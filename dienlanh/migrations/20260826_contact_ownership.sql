IF COL_LENGTH('dbo.contacts', 'user_id') IS NULL
BEGIN
    ALTER TABLE dbo.contacts ADD user_id INT NULL;
END
GO

UPDATE c
SET c.user_id = matched.user_id
FROM dbo.contacts c
CROSS APPLY (
    SELECT MIN(u.id) AS user_id, COUNT(*) AS match_count
    FROM dbo.users u
    WHERE c.email IS NOT NULL AND LOWER(u.email) = LOWER(c.email)
) matched
WHERE c.user_id IS NULL AND matched.match_count = 1;
GO

UPDATE c
SET c.user_id = matched.user_id
FROM dbo.contacts c
CROSS APPLY (
    SELECT MIN(u.id) AS user_id, COUNT(*) AS match_count
    FROM dbo.users u
    WHERE c.phone IS NOT NULL AND u.phone = c.phone
) matched
WHERE c.user_id IS NULL AND matched.match_count = 1;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_contacts_users' AND parent_object_id = OBJECT_ID('dbo.contacts')
)
BEGIN
    ALTER TABLE dbo.contacts WITH CHECK
        ADD CONSTRAINT FK_contacts_users FOREIGN KEY (user_id) REFERENCES dbo.users(id);
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_contacts_user_created' AND object_id = OBJECT_ID('dbo.contacts')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_contacts_user_created
        ON dbo.contacts(user_id, created_at DESC, id DESC);
END
GO
