const database = require('../config/database');
const { query } = database;

async function removeOrDeactivate(technicianId) {
    const id = Number(technicianId);
    if (!Number.isInteger(id) || id <= 0) return { notFound: true };
    if (database.provider === 'd1') {
        const technician = (await query('SELECT id FROM technicians WHERE id=@id', { id })).recordset[0];
        if (!technician) return { notFound: true };
        const related = Number((await query(`SELECT
            (SELECT COUNT(*) FROM bookings WHERE technician_id=@id) +
            (SELECT COUNT(*) FROM attendance WHERE technician_id=@id) +
            (SELECT COUNT(*) FROM attendance_audit_logs WHERE technician_id=@id) +
            (SELECT COUNT(*) FROM payrolls WHERE employee_id=@id) +
            (SELECT COUNT(*) FROM salary_history WHERE employee_id=@id) +
            (SELECT COUNT(*) FROM payroll_revenue WHERE technician_id=@id) AS total`, { id })).recordset[0]?.total || 0);
        if (related > 0) {
            await query("UPDATE technicians SET work_status='inactive',updated_at=CURRENT_TIMESTAMP WHERE id=@id", { id });
            return { deactivated: true, deleted: false, relatedRecords: related };
        }
        await query('DELETE FROM technicians WHERE id=@id', { id });
        return { deactivated: false, deleted: true, relatedRecords: 0 };
    }
    const result = await query(`
        SET XACT_ABORT ON;
        BEGIN TRY
            BEGIN TRANSACTION;
            IF NOT EXISTS (SELECT 1 FROM dbo.technicians WITH (UPDLOCK,HOLDLOCK) WHERE id=@id)
            BEGIN
                ROLLBACK TRANSACTION;
                SELECT CAST(1 AS BIT) not_found, CAST(0 AS BIT) deactivated, CAST(0 AS BIT) deleted, 0 related_records;
                RETURN;
            END;

            DECLARE @related INT =
                (SELECT COUNT(*) FROM dbo.bookings WHERE technician_id=@id) +
                (SELECT COUNT(*) FROM dbo.attendance WHERE technician_id=@id) +
                (SELECT COUNT(*) FROM dbo.attendance_audit_logs WHERE technician_id=@id) +
                (SELECT COUNT(*) FROM dbo.payrolls WHERE employee_id=@id) +
                (SELECT COUNT(*) FROM dbo.salary_history WHERE employee_id=@id) +
                (SELECT COUNT(*) FROM dbo.payroll_revenue WHERE technician_id=@id);

            IF @related > 0
            BEGIN
                UPDATE dbo.technicians SET work_status='inactive',updated_at=GETDATE() WHERE id=@id;
                COMMIT TRANSACTION;
                SELECT CAST(0 AS BIT) not_found, CAST(1 AS BIT) deactivated, CAST(0 AS BIT) deleted, @related related_records;
            END
            ELSE
            BEGIN
                DELETE FROM dbo.technicians WHERE id=@id;
                COMMIT TRANSACTION;
                SELECT CAST(0 AS BIT) not_found, CAST(0 AS BIT) deactivated, CAST(1 AS BIT) deleted, 0 related_records;
            END
        END TRY
        BEGIN CATCH
            IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
            THROW;
        END CATCH;
    `, { id });
    const outcome = result.recordset?.[0] || result.recordsets?.at(-1)?.[0];
    if (!outcome || outcome.not_found) return { notFound: true };
    return { deactivated: !!outcome.deactivated, deleted: !!outcome.deleted, relatedRecords: Number(outcome.related_records) || 0 };
}

module.exports = { removeOrDeactivate };
