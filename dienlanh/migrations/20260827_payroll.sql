-- Payroll uses the existing technicians table as the employee source.
-- The migration is idempotent and does not duplicate existing columns/tables.
IF OBJECT_ID(N'dbo.payrolls', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.payrolls (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_payrolls PRIMARY KEY,
        employee_id INT NOT NULL,
        payroll_month TINYINT NOT NULL,
        payroll_year SMALLINT NOT NULL,
        base_salary DECIMAL(18,2) NOT NULL,
        standard_days DECIMAL(5,2) NOT NULL,
        working_days DECIMAL(5,2) NOT NULL,
        allowance DECIMAL(18,2) NOT NULL CONSTRAINT DF_payrolls_allowance DEFAULT 0,
        bonus DECIMAL(18,2) NOT NULL CONSTRAINT DF_payrolls_bonus DEFAULT 0,
        overtime DECIMAL(18,2) NOT NULL CONSTRAINT DF_payrolls_overtime DEFAULT 0,
        deduction DECIMAL(18,2) NOT NULL CONSTRAINT DF_payrolls_deduction DEFAULT 0,
        gross_salary DECIMAL(18,2) NOT NULL,
        net_salary DECIMAL(18,2) NOT NULL,
        status VARCHAR(20) NOT NULL CONSTRAINT DF_payrolls_status DEFAULT 'unpaid',
        note NVARCHAR(1000) NULL,
        paid_at DATETIME2 NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_payrolls_created DEFAULT SYSDATETIME(),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_payrolls_updated DEFAULT SYSDATETIME(),
        CONSTRAINT FK_payrolls_technicians FOREIGN KEY (employee_id) REFERENCES dbo.technicians(id),
        CONSTRAINT CK_payrolls_month CHECK (payroll_month BETWEEN 1 AND 12),
        CONSTRAINT CK_payrolls_year CHECK (payroll_year BETWEEN 2000 AND 2100),
        CONSTRAINT CK_payrolls_days CHECK (standard_days > 0 AND standard_days <= 31 AND working_days >= 0 AND working_days <= 31),
        CONSTRAINT CK_payrolls_money CHECK (base_salary >= 0 AND allowance >= 0 AND bonus >= 0 AND overtime >= 0 AND deduction >= 0 AND gross_salary >= 0 AND net_salary >= 0),
        CONSTRAINT CK_payrolls_status CHECK (status IN ('unpaid', 'paid')),
        CONSTRAINT UQ_payrolls_employee_period UNIQUE (employee_id, payroll_month, payroll_year)
    );
END;
GO

-- Employee payroll profile (the existing technicians table remains authoritative).
IF COL_LENGTH('dbo.technicians', 'employee_type') IS NULL ALTER TABLE dbo.technicians ADD employee_type VARCHAR(20) NOT NULL CONSTRAINT DF_technicians_employee_type DEFAULT 'official';
IF COL_LENGTH('dbo.technicians', 'job_grade') IS NULL ALTER TABLE dbo.technicians ADD job_grade VARCHAR(20) NOT NULL CONSTRAINT DF_technicians_job_grade DEFAULT 'assistant';
IF COL_LENGTH('dbo.technicians', 'base_salary') IS NULL ALTER TABLE dbo.technicians ADD base_salary DECIMAL(18,2) NOT NULL CONSTRAINT DF_technicians_base_salary DEFAULT 5000000;
IF COL_LENGTH('dbo.technicians', 'uses_company_vehicle') IS NULL ALTER TABLE dbo.technicians ADD uses_company_vehicle BIT NOT NULL CONSTRAINT DF_technicians_vehicle DEFAULT 0;
IF COL_LENGTH('dbo.technicians', 'start_date') IS NULL ALTER TABLE dbo.technicians ADD start_date DATE NULL;
IF COL_LENGTH('dbo.technicians', 'probation_start_date') IS NULL ALTER TABLE dbo.technicians ADD probation_start_date DATE NULL;
IF COL_LENGTH('dbo.technicians', 'probation_end_date') IS NULL ALTER TABLE dbo.technicians ADD probation_end_date DATE NULL;
IF COL_LENGTH('dbo.technicians', 'resigned_without_notice') IS NULL ALTER TABLE dbo.technicians ADD resigned_without_notice BIT NOT NULL CONSTRAINT DF_technicians_resigned DEFAULT 0;
IF COL_LENGTH('dbo.technicians', 'fraud_warning') IS NULL ALTER TABLE dbo.technicians ADD fraud_warning BIT NOT NULL CONSTRAINT DF_technicians_fraud DEFAULT 0;
GO

-- Snapshot fields ensure old payroll periods never change with the employee profile/policy.
IF COL_LENGTH('dbo.payrolls', 'employee_type') IS NULL ALTER TABLE dbo.payrolls ADD employee_type VARCHAR(20) NOT NULL CONSTRAINT DF_payroll_employee_type DEFAULT 'official';
IF COL_LENGTH('dbo.payrolls', 'job_grade') IS NULL ALTER TABLE dbo.payrolls ADD job_grade VARCHAR(20) NOT NULL CONSTRAINT DF_payroll_job_grade DEFAULT 'assistant';
IF COL_LENGTH('dbo.payrolls', 'period_start') IS NULL ALTER TABLE dbo.payrolls ADD period_start DATE NULL;
IF COL_LENGTH('dbo.payrolls', 'period_end') IS NULL ALTER TABLE dbo.payrolls ADD period_end DATE NULL;
IF COL_LENGTH('dbo.payrolls', 'revenue_amount') IS NULL ALTER TABLE dbo.payrolls ADD revenue_amount DECIMAL(18,2) NOT NULL CONSTRAINT DF_payroll_revenue DEFAULT 0;
IF COL_LENGTH('dbo.payrolls', 'revenue_source') IS NULL ALTER TABLE dbo.payrolls ADD revenue_source VARCHAR(20) NOT NULL CONSTRAINT DF_payroll_revenue_source DEFAULT 'bookings';
IF COL_LENGTH('dbo.payrolls', 'productivity_band') IS NULL ALTER TABLE dbo.payrolls ADD productivity_band NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.payrolls', 'productivity_percent') IS NULL ALTER TABLE dbo.payrolls ADD productivity_percent DECIMAL(8,4) NOT NULL CONSTRAINT DF_payroll_productivity_percent DEFAULT 0;
IF COL_LENGTH('dbo.payrolls', 'productivity_salary') IS NULL ALTER TABLE dbo.payrolls ADD productivity_salary DECIMAL(18,2) NOT NULL CONSTRAINT DF_payroll_productivity_salary DEFAULT 0;
IF COL_LENGTH('dbo.payrolls', 'meal_allowance') IS NULL ALTER TABLE dbo.payrolls ADD meal_allowance DECIMAL(18,2) NOT NULL CONSTRAINT DF_payroll_meal DEFAULT 0;
IF COL_LENGTH('dbo.payrolls', 'fuel_allowance') IS NULL ALTER TABLE dbo.payrolls ADD fuel_allowance DECIMAL(18,2) NOT NULL CONSTRAINT DF_payroll_fuel DEFAULT 0;
IF COL_LENGTH('dbo.payrolls', 'phone_allowance') IS NULL ALTER TABLE dbo.payrolls ADD phone_allowance DECIMAL(18,2) NOT NULL CONSTRAINT DF_payroll_phone DEFAULT 0;
IF COL_LENGTH('dbo.payrolls', 'leave_days') IS NULL ALTER TABLE dbo.payrolls ADD leave_days DECIMAL(5,2) NOT NULL CONSTRAINT DF_payroll_leave DEFAULT 0;
IF COL_LENGTH('dbo.payrolls', 'authorized_leave_days') IS NULL ALTER TABLE dbo.payrolls ADD authorized_leave_days DECIMAL(5,2) NOT NULL CONSTRAINT DF_payroll_authorized_leave DEFAULT 0;
IF COL_LENGTH('dbo.payrolls', 'unauthorized_leave_days') IS NULL ALTER TABLE dbo.payrolls ADD unauthorized_leave_days DECIMAL(5,2) NOT NULL CONSTRAINT DF_payroll_unauthorized_leave DEFAULT 0;
IF COL_LENGTH('dbo.payrolls', 'unauthorized_leave_deduction') IS NULL ALTER TABLE dbo.payrolls ADD unauthorized_leave_deduction DECIMAL(18,2) NOT NULL CONSTRAINT DF_payroll_leave_deduction DEFAULT 0;
IF COL_LENGTH('dbo.payrolls', 'overtime_approved') IS NULL ALTER TABLE dbo.payrolls ADD overtime_approved BIT NOT NULL CONSTRAINT DF_payroll_overtime_approved DEFAULT 0;
IF COL_LENGTH('dbo.payrolls', 'overtime_hours') IS NULL ALTER TABLE dbo.payrolls ADD overtime_hours DECIMAL(8,2) NOT NULL CONSTRAINT DF_payroll_overtime_hours DEFAULT 0;
IF COL_LENGTH('dbo.payrolls', 'overtime_approved_by') IS NULL ALTER TABLE dbo.payrolls ADD overtime_approved_by INT NULL;
IF COL_LENGTH('dbo.payrolls', 'penalty_total') IS NULL ALTER TABLE dbo.payrolls ADD penalty_total DECIMAL(18,2) NOT NULL CONSTRAINT DF_payroll_penalty DEFAULT 0;
IF COL_LENGTH('dbo.payrolls', 'advance_total') IS NULL ALTER TABLE dbo.payrolls ADD advance_total DECIMAL(18,2) NOT NULL CONSTRAINT DF_payroll_advance DEFAULT 0;
IF COL_LENGTH('dbo.payrolls', 'paid_total') IS NULL ALTER TABLE dbo.payrolls ADD paid_total DECIMAL(18,2) NOT NULL CONSTRAINT DF_payroll_paid_total DEFAULT 0;
IF COL_LENGTH('dbo.payrolls', 'balance_due') IS NULL ALTER TABLE dbo.payrolls ADD balance_due DECIMAL(18,2) NOT NULL CONSTRAINT DF_payroll_balance DEFAULT 0;
IF COL_LENGTH('dbo.payrolls', 'warning_message') IS NULL ALTER TABLE dbo.payrolls ADD warning_message NVARCHAR(1000) NULL;
IF COL_LENGTH('dbo.payrolls', 'is_locked') IS NULL ALTER TABLE dbo.payrolls ADD is_locked BIT NOT NULL CONSTRAINT DF_payroll_locked DEFAULT 0;
IF COL_LENGTH('dbo.payrolls', 'locked_at') IS NULL ALTER TABLE dbo.payrolls ADD locked_at DATETIME2 NULL;
IF COL_LENGTH('dbo.payrolls', 'locked_by') IS NULL ALTER TABLE dbo.payrolls ADD locked_by INT NULL;
IF COL_LENGTH('dbo.payrolls', 'created_by') IS NULL ALTER TABLE dbo.payrolls ADD created_by INT NULL;
IF COL_LENGTH('dbo.payrolls', 'updated_by') IS NULL ALTER TABLE dbo.payrolls ADD updated_by INT NULL;
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='CK_payrolls_status' AND parent_object_id=OBJECT_ID('dbo.payrolls')) ALTER TABLE dbo.payrolls DROP CONSTRAINT CK_payrolls_status;
ALTER TABLE dbo.payrolls ADD CONSTRAINT CK_payrolls_status CHECK (status IN ('created','advanced','pending_payment','paid','warning','locked','unpaid'));
GO

IF OBJECT_ID(N'dbo.payroll_policies', N'U') IS NULL CREATE TABLE dbo.payroll_policies (policy_key VARCHAR(80) PRIMARY KEY, numeric_value DECIMAL(18,4) NULL, text_value NVARCHAR(500) NULL, updated_by INT NULL, updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME());
IF OBJECT_ID(N'dbo.payroll_productivity_bands', N'U') IS NULL CREATE TABLE dbo.payroll_productivity_bands (id INT IDENTITY PRIMARY KEY, min_revenue DECIMAL(18,2) NOT NULL, max_revenue DECIMAL(18,2) NULL, salary_amount DECIMAL(18,2) NULL, productivity_percent DECIMAL(8,4) NOT NULL DEFAULT 0, label NVARCHAR(100) NOT NULL, is_active BIT NOT NULL DEFAULT 1, CONSTRAINT UQ_productivity_band UNIQUE(min_revenue,max_revenue));
IF OBJECT_ID(N'dbo.payroll_advances', N'U') IS NULL CREATE TABLE dbo.payroll_advances (id INT IDENTITY PRIMARY KEY, payroll_id INT NOT NULL REFERENCES dbo.payrolls(id), amount DECIMAL(18,2) NOT NULL CHECK(amount>0), advance_date DATE NOT NULL, performed_by INT NOT NULL REFERENCES dbo.users(id), note NVARCHAR(500) NULL, created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME());
IF OBJECT_ID(N'dbo.payroll_payments', N'U') IS NULL CREATE TABLE dbo.payroll_payments (id INT IDENTITY PRIMARY KEY, payroll_id INT NOT NULL REFERENCES dbo.payrolls(id), amount DECIMAL(18,2) NOT NULL CHECK(amount>0), payment_date DATE NOT NULL, payment_method VARCHAR(30) NULL, performed_by INT NOT NULL REFERENCES dbo.users(id), note NVARCHAR(500) NULL, created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME());
IF OBJECT_ID(N'dbo.payroll_deductions', N'U') IS NULL CREATE TABLE dbo.payroll_deductions (id INT IDENTITY PRIMARY KEY, payroll_id INT NOT NULL REFERENCES dbo.payrolls(id), deduction_type VARCHAR(40) NOT NULL, reason NVARCHAR(300) NOT NULL, amount DECIMAL(18,2) NOT NULL CHECK(amount>=0), recorded_by INT NOT NULL REFERENCES dbo.users(id), note NVARCHAR(500) NULL, created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME());
IF OBJECT_ID(N'dbo.payroll_bonuses', N'U') IS NULL CREATE TABLE dbo.payroll_bonuses (id INT IDENTITY PRIMARY KEY, payroll_id INT NOT NULL REFERENCES dbo.payrolls(id), bonus_type VARCHAR(40) NOT NULL DEFAULT 'monthly', reason NVARCHAR(300) NOT NULL, amount DECIMAL(18,2) NOT NULL CHECK(amount>=0), recorded_by INT NOT NULL REFERENCES dbo.users(id), note NVARCHAR(500) NULL, created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME());
IF OBJECT_ID(N'dbo.payroll_audit_logs', N'U') IS NULL CREATE TABLE dbo.payroll_audit_logs (id BIGINT IDENTITY PRIMARY KEY, payroll_id INT NULL, employee_id INT NULL, action_key VARCHAR(40) NOT NULL, actor_id INT NOT NULL REFERENCES dbo.users(id), details NVARCHAR(MAX) NULL, created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME());
IF OBJECT_ID(N'dbo.salary_history', N'U') IS NULL CREATE TABLE dbo.salary_history (id INT IDENTITY PRIMARY KEY, employee_id INT NOT NULL REFERENCES dbo.technicians(id), old_salary DECIMAL(18,2) NOT NULL, new_salary DECIMAL(18,2) NOT NULL, increase_percent DECIMAL(8,4) NOT NULL, effective_date DATE NOT NULL, reason NVARCHAR(500) NOT NULL, approved_by INT NOT NULL REFERENCES dbo.users(id), created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME());
GO

IF COL_LENGTH('dbo.payroll_deductions','complaint_count') IS NULL ALTER TABLE dbo.payroll_deductions ADD complaint_count INT NULL;
IF COL_LENGTH('dbo.payroll_deductions','affected_cases') IS NULL ALTER TABLE dbo.payroll_deductions ADD affected_cases INT NULL;
GO

MERGE dbo.payroll_policies AS target USING (VALUES
 ('assistant_base_salary',5000000,NULL),('technician_base_salary',5000000,NULL),('meal_allowance',600000,NULL),('fuel_allowance',1000000,NULL),('phone_allowance',300000,NULL),('advance_max_percent',50,NULL),('monthly_paid_leave_days',2,NULL),('unauthorized_leave_multiplier',2,NULL),('complaint_penalty',100000,NULL),('productivity_add_to_base',0,N'0 = mức năng suất thay thế lương cơ bản; 1 = cộng thêm'),('unconfirmed_productivity_percent',0,N'Chưa cấu hình hệ số %')
) AS source(policy_key,numeric_value,text_value) ON target.policy_key=source.policy_key WHEN NOT MATCHED THEN INSERT(policy_key,numeric_value,text_value) VALUES(source.policy_key,source.numeric_value,source.text_value);
GO

MERGE dbo.payroll_productivity_bands AS target USING (VALUES
 (0,40000000,CAST(NULL AS DECIMAL(18,2)),0,N'Dưới 40 triệu'),(40000000,41000000,NULL,0,N'40–41 triệu: Chưa cấu hình hệ số %'),(41000000,46000000,12000000,0,N'41–45 triệu'),(46000000,51000000,13000000,0,N'46–50 triệu'),(51000000,56000000,15000000,0,N'51–55 triệu'),(56000000,71000000,18000000,0,N'56–70 triệu'),(71000000,100000001,25000000,0,N'71–100 triệu')
) AS source(min_revenue,max_revenue,salary_amount,productivity_percent,label) ON target.min_revenue=source.min_revenue AND target.max_revenue=source.max_revenue WHEN NOT MATCHED THEN INSERT(min_revenue,max_revenue,salary_amount,productivity_percent,label) VALUES(source.min_revenue,source.max_revenue,source.salary_amount,source.productivity_percent,source.label);
GO
