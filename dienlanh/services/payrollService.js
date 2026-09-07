const { query, getConnection, sql } = require('../config/database');
const crypto = require('crypto');
const attendanceService = require('./attendanceService');
const round = value => Math.round((Number(value) || 0) * 100) / 100;
const num = value => value === '' || value == null ? 0 : Number(value);

function productivityForRevenue(revenue, bands, baseSalary, addToBase = false) {
    const band = bands.find(x => revenue >= Number(x.min_revenue) && (x.max_revenue == null || revenue < Number(x.max_revenue)));
    if (!band) return { band: 'Ngoài phạm vi chính sách', salary: 0, percent: 0, warning: 'Doanh thu ngoài phạm vi chính sách.' };
    const percent = num(band.productivity_percent), fixed = band.salary_amount == null ? null : Number(band.salary_amount);
    let salary = fixed == null ? revenue * percent / 100 : fixed;
    if (fixed != null && addToBase) salary += baseSalary;
    return { band: band.label, salary: round(salary), percent, warning: fixed == null && percent === 0 && revenue >= 40000000 ? 'Chưa cấu hình hệ số %.' : null };
}

function calculatePolicy(i) {
    const base = Math.max(0, num(i.baseSalary)), standard = Math.max(1, num(i.standardDays) || 26), working = Math.max(0, num(i.workingDays));
    const attendanceSalary = round(base / standard * working);
    const unauthorizedLeaveDeduction = round(base / standard * Math.max(0, num(i.unauthorizedLeaveDays)) * (num(i.unauthorizedMultiplier) || 2));
    const overtime = i.overtimeApproved ? Math.max(0, num(i.overtime)) : 0;
    const productivitySalary = Math.max(0, num(i.productivitySalary));
    const salaryPart = i.jobGrade === 'technician' && productivitySalary > 0 ? productivitySalary : attendanceSalary;
    const grossSalary = round(salaryPart + num(i.mealAllowance) + num(i.fuelAllowance) + num(i.phoneAllowance) + num(i.bonus) + overtime);
    const totalDeduction = round(num(i.deduction) + num(i.penalty) + unauthorizedLeaveDeduction);
    let totalSalary = Math.max(0, round(grossSalary - totalDeduction));
    const warnings = [...(i.warnings || [])];
    if (i.employeeType === 'probation' && (num(i.daysEmployedInPeriod) < 15 || i.resignedWithoutNotice)) { totalSalary = 0; warnings.push('Thử việc chưa đủ 15 ngày hoặc nghỉ không báo trước; cần Admin xác nhận.'); }
    const balanceDue = Math.max(0, round(totalSalary - num(i.advanceTotal) - num(i.paidTotal)));
    return { attendanceSalary, unauthorizedLeaveDeduction, overtime, grossSalary, totalDeduction, totalSalary, balanceDue, warnings };
}

async function policies() {
    const [p, b] = await Promise.all([query('SELECT policy_key,numeric_value,text_value FROM dbo.payroll_policies'), query('SELECT * FROM dbo.payroll_productivity_bands WHERE is_active=1 ORDER BY min_revenue')]);
    return { values: Object.fromEntries(p.recordset.map(x => [x.policy_key, Number(x.numeric_value)])), bands: b.recordset };
}

const selectSql = `SELECT p.*,t.full_name employee_name,t.specialty position,t.start_date,t.probation_start_date,t.probation_end_date,t.work_status,CONCAT('NV',RIGHT('0000'+CAST(t.id AS VARCHAR(10)),4)) employee_code FROM dbo.payrolls p JOIN dbo.technicians t ON t.id=p.employee_id`;
function whereFor(filters, params) { const w=[]; if(num(filters.month)){w.push('p.payroll_month=@month');params.month=num(filters.month)} if(num(filters.year)){w.push('p.payroll_year=@year');params.year=num(filters.year)} if(['created','advanced','pending_payment','paid','warning','locked','unpaid'].includes(filters.status)){w.push('p.status=@status');params.status=filters.status} if(['assistant','technician'].includes(filters.job_grade)){w.push('p.job_grade=@jobGrade');params.jobGrade=filters.job_grade} if(String(filters.search||'').trim()){w.push(`(t.full_name LIKE @search OR CONCAT('NV',RIGHT('0000'+CAST(t.id AS VARCHAR(10)),4)) LIKE @search)`);params.search=`%${String(filters.search).trim().slice(0,100)}%`} return w.length?`WHERE ${w.join(' AND ')}`:''; }

async function list(filters={}) { const params={},where=whereFor(filters,params),page=Math.max(1,num(filters.page)||1),limit=Math.min(5000,Math.max(5,num(filters.limit)||10));params.offset=(page-1)*limit;params.limit=limit;const [r,s]=await Promise.all([query(`${selectSql} ${where} ORDER BY p.payroll_year DESC,p.payroll_month DESC,t.full_name OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,params),query(`SELECT COUNT(*) records_total,COUNT(DISTINCT p.employee_id) employee_total,COALESCE(SUM(p.net_salary),0) total_fund,COALESCE(SUM(p.advance_total),0) advance_total,COALESCE(SUM(p.paid_total),0) paid_total,COALESCE(SUM(p.balance_due),0) balance_total FROM dbo.payrolls p JOIN dbo.technicians t ON t.id=p.employee_id ${where}`,params)]);const stats=s.recordset[0];return{data:r.recordset,stats,pagination:{page,limit,total:stats.records_total,totalPages:Math.max(1,Math.ceil(stats.records_total/limit))}}; }

async function getById(id) { const p=(await query(`${selectSql} WHERE p.id=@id`,{id})).recordset[0];if(!p)return null;const [a,py,d,b,h]=await Promise.all([query('SELECT a.*,u.name performed_by_name FROM dbo.payroll_advances a JOIN dbo.users u ON u.id=a.performed_by WHERE payroll_id=@id ORDER BY created_at DESC',{id}),query('SELECT a.*,u.name performed_by_name FROM dbo.payroll_payments a JOIN dbo.users u ON u.id=a.performed_by WHERE payroll_id=@id ORDER BY created_at DESC',{id}),query('SELECT a.*,u.name recorded_by_name FROM dbo.payroll_deductions a JOIN dbo.users u ON u.id=a.recorded_by WHERE payroll_id=@id ORDER BY created_at DESC',{id}),query('SELECT a.*,u.name recorded_by_name FROM dbo.payroll_bonuses a JOIN dbo.users u ON u.id=a.recorded_by WHERE payroll_id=@id ORDER BY created_at DESC',{id}),query('SELECT a.*,u.name actor_name FROM dbo.payroll_audit_logs a JOIN dbo.users u ON u.id=a.actor_id WHERE payroll_id=@id ORDER BY created_at DESC',{id})]);return{...p,advances:a.recordset,payments:py.recordset,deductions:d.recordset,bonuses:b.recordset,audit:h.recordset}; }
async function audit(payrollId,employeeId,action,actorId,details=''){await query('INSERT dbo.payroll_audit_logs(payroll_id,employee_id,action_key,actor_id,details) VALUES(@payrollId,@employeeId,@action,@actorId,@details)',{payrollId,employeeId,action,actorId,details:String(details).slice(0,4000)});}

async function snapshot(employee,month,year,body={}) { const cfg=await policies(),attendance=await attendanceService.summary(employee.id,month,year),start=`${year}-${String(month).padStart(2,'0')}-01`,end=new Date(year,month,0).toISOString().slice(0,10);const rr=await query(`SELECT COALESCE(SUM(COALESCE(actual_cost,estimated_cost,0)),0) revenue FROM dbo.bookings WHERE technician_id=@id AND status='completed' AND COALESCE(scheduled_date,booking_date,CAST(completed_at AS date))>=@start AND COALESCE(scheduled_date,booking_date,CAST(completed_at AS date))<DATEADD(day,1,@end)`,{id:employee.id,start,end});const revenue=num(body.revenue_amount ?? rr.recordset[0].revenue),base=num(employee.base_salary)||5000000,prod=employee.job_grade==='technician'?productivityForRevenue(revenue,cfg.bands,base,!!cfg.values.productivity_add_to_base):{band:'Không áp dụng',salary:0,percent:0,warning:null};const joined=new Date(employee.probation_start_date||employee.start_date||start),periodStart=new Date(start),days=Math.max(0,Math.floor((new Date(end)-(joined>periodStart?joined:periodStart))/86400000)+1);const input={baseSalary:base,standardDays:num(body.standard_days)||26,workingDays:attendance.working_days,unauthorizedLeaveDays:attendance.unauthorized_leave_days,unauthorizedMultiplier:cfg.values.unauthorized_leave_multiplier||2,jobGrade:employee.job_grade,productivitySalary:prod.salary,mealAllowance:cfg.values.meal_allowance||0,fuelAllowance:employee.uses_company_vehicle?cfg.values.fuel_allowance||0:0,phoneAllowance:employee.job_grade==='technician'?cfg.values.phone_allowance||0:0,bonus:num(body.bonus),deduction:num(body.deduction),penalty:num(body.penalty_total),overtime:0,overtimeApproved:false,employeeType:employee.employee_type,daysEmployedInPeriod:days,resignedWithoutNotice:employee.resigned_without_notice,warnings:[prod.warning,employee.fraud_warning?'Có cảnh báo gian dối trong hồ sơ.':null,attendance.working_days===0?'Chưa có dữ liệu chấm công trong kỳ.':null].filter(Boolean)};return{cfg,start,end,revenue,base,prod,input,attendance,calc:calculatePolicy(input)}; }

async function generate(month,year,actorId,body={}) { if(!Number.isInteger(month)||month<1||month>12||!Number.isInteger(year)||year<2000||year>2100)return{errors:['Kỳ lương không hợp lệ.']};const employees=(await query(`SELECT * FROM dbo.technicians WHERE work_status<>'inactive'`)).recordset;let created=0,skipped=0;for(const e of employees){try{const s=await snapshot(e,month,year,body),c=s.calc;const r=await query(`INSERT dbo.payrolls(employee_id,payroll_month,payroll_year,base_salary,standard_days,working_days,allowance,bonus,overtime,deduction,gross_salary,net_salary,status,note,employee_type,job_grade,period_start,period_end,revenue_amount,productivity_band,productivity_percent,productivity_salary,meal_allowance,fuel_allowance,phone_allowance,leave_days,authorized_leave_days,unauthorized_leave_days,unauthorized_leave_deduction,overtime_approved,overtime_hours,penalty_total,advance_total,paid_total,balance_due,warning_message,created_by,updated_by) OUTPUT INSERTED.id VALUES(@employeeId,@month,@year,@base,@standard,@working,@allowance,@bonus,@overtime,@deduction,@gross,@net,@status,@note,@employeeType,@jobGrade,@start,@end,@revenue,@band,@percent,@prodSalary,@meal,@fuel,@phone,@leave,@authorized,@unauthorized,@leaveDeduction,@otApproved,@otHours,@penalty,0,0,@balance,@warning,@actor,@actor)`,{employeeId:e.id,month,year,base:s.base,standard:s.input.standardDays,working:s.input.workingDays,allowance:s.input.mealAllowance+s.input.fuelAllowance+s.input.phoneAllowance,bonus:s.input.bonus,overtime:c.overtime,deduction:c.totalDeduction,gross:c.grossSalary,net:c.totalSalary,status:c.warnings.length?'warning':'created',note:String(body.note||''),employeeType:e.employee_type,jobGrade:e.job_grade,start:s.start,end:s.end,revenue:s.revenue,band:s.prod.band,percent:s.prod.percent,prodSalary:s.prod.salary,meal:s.input.mealAllowance,fuel:s.input.fuelAllowance,phone:s.input.phoneAllowance,leave:num(body.leave_days),authorized:num(body.authorized_leave_days),unauthorized:s.input.unauthorizedLeaveDays,leaveDeduction:c.unauthorizedLeaveDeduction,otApproved:s.input.overtimeApproved,otHours:num(body.overtime_hours),penalty:s.input.penalty,balance:c.balanceDue,warning:c.warnings.join(' '),actor:actorId});await audit(r.recordset[0].id,e.id,'generate',actorId,`Tạo kỳ ${month}/${year}`);created++}catch(error){if([2601,2627].includes(error.number))skipped++;else throw error}}return{created,skipped}; }

async function recalculate(id,actorId){const p=await getById(id);if(!p)return null;const bonus=p.bonuses.filter(x=>x.bonus_type!=='year_end').reduce((s,x)=>s+num(x.amount),0),deduction=p.deductions.reduce((s,x)=>s+num(x.amount),0);const c=calculatePolicy({baseSalary:p.base_salary,standardDays:p.standard_days,workingDays:p.working_days,unauthorizedLeaveDays:p.unauthorized_leave_days,unauthorizedMultiplier:2,jobGrade:p.job_grade,productivitySalary:p.productivity_salary,mealAllowance:p.meal_allowance,fuelAllowance:p.fuel_allowance,phoneAllowance:p.phone_allowance,bonus,overtime:p.overtime,overtimeApproved:p.overtime_approved,deduction,advanceTotal:p.advance_total,paidTotal:p.paid_total,employeeType:'official'});const status=p.is_locked?'locked':c.balanceDue===0?'paid':num(p.advance_total)>0?'advanced':num(p.paid_total)>0?'pending_payment':p.warning_message?'warning':'created';await query(`UPDATE dbo.payrolls SET bonus=@bonus,deduction=@deduction,penalty_total=@deduction,gross_salary=@gross,net_salary=@net,balance_due=@balance,status=@status,paid_at=CASE WHEN @status='paid' THEN COALESCE(paid_at,SYSDATETIME()) ELSE paid_at END,updated_by=@actor,updated_at=SYSDATETIME() WHERE id=@id`,{id,bonus,deduction,gross:c.grossSalary,net:c.totalSalary,balance:c.balanceDue,status,actor:actorId});return getById(id);}
async function advance(id,body,actor){const p=await getById(id);if(!p)return{notFound:true};if(p.is_locked)return{errors:['Bảng lương đã khóa.']};const date=body.date||new Date().toISOString().slice(0,10);if(Number(date.slice(8,10))!==1)return{errors:['Theo chính sách, ngày tạm ứng phải là ngày 01.']};const amount=num(body.amount),max=round(num(p.net_salary)*.5);if(amount<=0||num(p.advance_total)+amount>max)return{errors:[`Tổng tạm ứng không được vượt quá 50% lương (${max.toLocaleString('vi-VN')} ₫).`]};await query(`INSERT dbo.payroll_advances(payroll_id,amount,advance_date,performed_by,note) VALUES(@id,@amount,@date,@actor,@note);UPDATE dbo.payrolls SET advance_total=advance_total+@amount WHERE id=@id`,{id,amount,date,actor,note:String(body.note||'').slice(0,500)});await audit(id,p.employee_id,'advance',actor,`Tạm ứng ${amount}`);return{payroll:await recalculate(id,actor)};}
async function payment(id,body,actor){const p=await getById(id);if(!p)return{notFound:true};if(p.is_locked)return{errors:['Bảng lương đã khóa.']};const date=body.date||new Date().toISOString().slice(0,10);if(Number(date.slice(8,10))!==15)return{errors:['Theo chính sách, ngày thanh toán lương phải là ngày 15.']};const payDate=new Date(`${date}T00:00:00Z`),periodEnd=new Date(p.period_end);if(payDate<=periodEnd)return{errors:['Ngày thanh toán phải thuộc tháng sau kỳ lương.']};const amount=num(body.amount);if(amount<=0||amount>num(p.balance_due))return{errors:['Số tiền không hợp lệ hoặc vượt số còn phải trả.']};await query(`INSERT dbo.payroll_payments(payroll_id,amount,payment_date,payment_method,performed_by,note) VALUES(@id,@amount,@date,@method,@actor,@note);UPDATE dbo.payrolls SET paid_total=paid_total+@amount WHERE id=@id`,{id,amount,date,method:String(body.payment_method||'cash').slice(0,30),actor,note:String(body.note||'').slice(0,500)});await audit(id,p.employee_id,'payment',actor,`Thanh toán ${amount}`);return{payroll:await recalculate(id,actor)};}
async function adjustment(id,body,actor,type){const p=await getById(id);if(!p)return{notFound:true};if(p.is_locked)return{errors:['Bảng lương đã khóa.']};const amount=num(body.amount),reason=String(body.reason||'').trim();if(amount<0||!reason)return{errors:['Số tiền và lý do là bắt buộc.']};const table=type==='bonus'?'payroll_bonuses':'payroll_deductions',column=type==='bonus'?'bonus_type':'deduction_type';await query(`INSERT dbo.${table}(payroll_id,${column},reason,amount,recorded_by,note) VALUES(@id,@kind,@reason,@amount,@actor,@note)`,{id,kind:String(body.type||'manual').slice(0,40),reason:reason.slice(0,300),amount,actor,note:String(body.note||'').slice(0,500)});await audit(id,p.employee_id,type,actor,`${reason}: ${amount}`);return{payroll:await recalculate(id,actor)};}
async function penalty(id,body,actor){const p=await getById(id);if(!p)return{notFound:true};if(p.is_locked)return{errors:['Bảng lương đã khóa.']};const complaints=Math.max(0,Math.trunc(num(body.complaint_count))),cases=Math.max(0,Math.trunc(num(body.affected_cases))),reason=String(body.reason||'').trim();if(!reason)return{errors:['Không được ghi nhận phạt khi chưa có lý do.']};const cfg=await policies(),amount=complaints<10?round(cases*(cfg.values.complaint_penalty||100000)):0;await query(`INSERT dbo.payroll_deductions(payroll_id,deduction_type,reason,amount,recorded_by,note,complaint_count,affected_cases) VALUES(@id,'complaint',@reason,@amount,@actor,@note,@complaints,@cases)`,{id,reason:reason.slice(0,300),amount,actor,note:String(body.note||'').slice(0,500),complaints,cases});await audit(id,p.employee_id,'penalty',actor,`${complaints} phàn nàn, ${cases} ca, phạt ${amount}`);return{payroll:await recalculate(id,actor),amount};}
async function updatePayroll(id,body,actor){const p=await getById(id);if(!p)return{notFound:true};if(p.is_locked)return{errors:['Bảng lương đã khóa.']};const standard=num(body.standard_days??p.standard_days),working=num(body.working_days??p.working_days),unauthorized=num(body.unauthorized_leave_days??p.unauthorized_leave_days),revenue=num(body.revenue_amount??p.revenue_amount);if(standard<=0||standard>31||working<0||working>31||unauthorized<0||unauthorized>31||revenue<0)return{errors:['Ngày công hoặc doanh thu không hợp lệ.']};const cfg=await policies(),prod=p.job_grade==='technician'?productivityForRevenue(revenue,cfg.bands,num(p.base_salary),!!cfg.values.productivity_add_to_base):{band:'Không áp dụng',salary:0,percent:0,warning:null};const overtimeApproved=body.overtime_approved===true||body.overtime_approved==='true',overtime=overtimeApproved?Math.max(0,num(body.overtime??p.overtime)):0;const leaveDeduction=round(num(p.base_salary)/standard*unauthorized*(cfg.values.unauthorized_leave_multiplier||2));await query(`UPDATE dbo.payrolls SET standard_days=@standard,working_days=@working,leave_days=@leave,authorized_leave_days=@authorized,unauthorized_leave_days=@unauthorized,unauthorized_leave_deduction=@leaveDeduction,revenue_amount=@revenue,revenue_source=@source,productivity_band=@band,productivity_percent=@percent,productivity_salary=@prodSalary,overtime_approved=@otApproved,overtime_hours=@otHours,overtime=@overtime,note=@note,warning_message=@warning,updated_by=@actor,updated_at=SYSDATETIME() WHERE id=@id`,{id,standard,working,leave:num(body.leave_days??p.leave_days),authorized:num(body.authorized_leave_days??p.authorized_leave_days),unauthorized,leaveDeduction,revenue,source:body.revenue_amount!==undefined?'admin_confirmed':p.revenue_source,band:prod.band,percent:prod.percent,prodSalary:prod.salary,otApproved:overtimeApproved?1:0,otHours:num(body.overtime_hours??p.overtime_hours),overtime,note:String(body.note??p.note??'').slice(0,1000),warning:prod.warning||p.warning_message,actor});await audit(id,p.employee_id,'update',actor,'Cập nhật ngày công/doanh thu/tăng ca');return{payroll:await recalculate(id,actor)};}
async function lock(id,value,actor){const p=await getById(id);if(!p)return null;await query(`UPDATE dbo.payrolls SET is_locked=@value,locked_at=CASE WHEN @value=1 THEN SYSDATETIME() ELSE NULL END,locked_by=CASE WHEN @value=1 THEN @actor ELSE NULL END,status=CASE WHEN @value=1 THEN 'locked' ELSE CASE WHEN balance_due=0 THEN 'paid' WHEN advance_total>0 THEN 'advanced' ELSE 'created' END END WHERE id=@id`,{id,value:value?1:0,actor});await audit(id,p.employee_id,value?'lock':'unlock',actor,value?'Khóa':'Mở khóa');return getById(id);}
function verifyDeletePassword(password){
 const configured=process.env.PAYROLL_DELETE_PASSWORD;
 if(!configured)throw Object.assign(new Error('Chưa cấu hình PAYROLL_DELETE_PASSWORD trên máy chủ.'),{statusCode:500,code:'PAYROLL_DELETE_PASSWORD_NOT_CONFIGURED'});
 if(typeof password!=='string'||password.length===0)throw Object.assign(new Error('Vui lòng nhập mật khẩu.'),{statusCode:422,code:'PAYROLL_DELETE_PASSWORD_REQUIRED'});
 const suppliedHash=crypto.createHash('sha256').update(password,'utf8').digest(),configuredHash=crypto.createHash('sha256').update(configured,'utf8').digest();
 if(!crypto.timingSafeEqual(suppliedHash,configuredHash))throw Object.assign(new Error('Mật khẩu không chính xác.'),{statusCode:403,code:'PAYROLL_DELETE_PASSWORD_INVALID'});
 return true;
}
async function remove(id,actor,deletePassword){
 if(!Number.isInteger(id)||id<=0)throw Object.assign(new Error('Mã bảng lương không hợp lệ.'),{statusCode:400});
 verifyDeletePassword(deletePassword);
 const connection=await getConnection(),transaction=new sql.Transaction(connection);await transaction.begin();
 try{
  const payrollRequest=new sql.Request(transaction);payrollRequest.input('id',sql.Int,id);
  const payroll=(await payrollRequest.query(`SELECT p.id,p.employee_id,p.payroll_month,p.payroll_year,p.net_salary,p.status,p.is_locked,t.full_name,
      CONCAT('KT-',RIGHT('000'+CAST(t.id AS VARCHAR(10)),3)) employee_code
      FROM dbo.payrolls p WITH(UPDLOCK,HOLDLOCK) JOIN dbo.technicians t ON t.id=p.employee_id WHERE p.id=@id`)).recordset[0];
  if(!payroll){await transaction.rollback();return false}
  const fkRequest=new sql.Request(transaction);fkRequest.input('payrollObjectId',sql.Int,0);
  const references=(await fkRequest.query(`SELECT OBJECT_NAME(f.parent_object_id) table_name FROM sys.foreign_keys f
      WHERE f.referenced_object_id=OBJECT_ID(N'dbo.payrolls')`)).recordset.map(x=>x.table_name);
  const handled=new Set(['payroll_advances','payroll_payments','payroll_deductions','payroll_bonuses']);
  const unknown=references.filter(name=>!handled.has(name));
  if(unknown.length)throw Object.assign(new Error(`Có bảng liên quan chưa được xử lý an toàn: ${unknown.join(', ')}.`),{statusCode:409});
  const deleteRequest=new sql.Request(transaction);deleteRequest.input('id',sql.Int,id);
  const deleted=await deleteRequest.query(`
      DELETE FROM dbo.payroll_advances WHERE payroll_id=@id;
      DELETE FROM dbo.payroll_payments WHERE payroll_id=@id;
      DELETE FROM dbo.payroll_deductions WHERE payroll_id=@id;
      DELETE FROM dbo.payroll_bonuses WHERE payroll_id=@id;
      DELETE FROM dbo.payroll_audit_logs WHERE payroll_id=@id;
      DELETE FROM dbo.payrolls WHERE id=@id;
  `);
  const logRequest=new sql.Request(transaction);logRequest.input('employeeId',sql.Int,payroll.employee_id);logRequest.input('actor',sql.Int,actor);
  logRequest.input('details',sql.NVarChar(sql.MAX),`Admin đã xóa bảng lương #${payroll.id}, ${payroll.employee_code} - ${payroll.full_name}, kỳ ${String(payroll.payroll_month).padStart(2,'0')}/${payroll.payroll_year}, thực nhận ${num(payroll.net_salary).toLocaleString('vi-VN')}đ, trạng thái ${payroll.status}.`);
  await logRequest.query(`INSERT dbo.payroll_audit_logs(payroll_id,employee_id,action_key,actor_id,details)
      VALUES(NULL,@employeeId,'delete',@actor,@details)`);
  await transaction.commit();
  return{deleted:true,payroll,counts:{advances:deleted.rowsAffected[0]||0,payments:deleted.rowsAffected[1]||0,deductions:deleted.rowsAffected[2]||0,bonuses:deleted.rowsAffected[3]||0,audit:deleted.rowsAffected[4]||0}};
 }catch(error){if(transaction._aborted!==true)try{await transaction.rollback()}catch(rollbackError){console.error('Payroll rollback:',rollbackError)}throw error}
}
async function employees(){return(await query(`SELECT id,full_name,employee_type,job_grade,base_salary,uses_company_vehicle,work_status,CONCAT('NV',RIGHT('0000'+CAST(id AS VARCHAR(10)),4)) employee_code FROM dbo.technicians WHERE work_status<>'inactive' ORDER BY full_name`)).recordset;}
async function updateConfiguration(body,actor){const percent=Math.max(0,Math.min(100,num(body.productivity_percent))),add=body.productivity_add_to_base===true||body.productivity_add_to_base==='true'||body.productivity_add_to_base==='1';await query(`UPDATE dbo.payroll_productivity_bands SET productivity_percent=@percent WHERE min_revenue=40000000 AND max_revenue=41000000;UPDATE dbo.payroll_policies SET numeric_value=@add,updated_by=@actor,updated_at=SYSDATETIME() WHERE policy_key='productivity_add_to_base'`,{percent,add:add?1:0,actor});return policies();}
function yearEndMultiplier(months){if(months>60)return 3.2;if(months>=24)return 1.7;if(months>12)return 1.2;if(months>6)return .5;return 0;}
async function yearEndBonus(id,body,actor){const p=await getById(id);if(!p)return{notFound:true};const start=p.start_date||p.probation_start_date;if(!start)return{errors:['Hồ sơ chưa có ngày bắt đầu làm việc.']};const at=new Date(body.award_date||`${p.payroll_year}-12-31`),joined=new Date(start),months=(at.getFullYear()-joined.getFullYear())*12+at.getMonth()-joined.getMonth(),multiplier=yearEndMultiplier(months),amount=round(num(p.base_salary)*multiplier);if(!amount)return{errors:['Nhân viên chưa đủ trên 6 tháng để nhận thưởng cuối năm.']};const duplicate=(await query(`SELECT id FROM dbo.payroll_bonuses WHERE payroll_id=@id AND bonus_type='year_end'`,{id})).recordset[0];if(duplicate)return{errors:['Thưởng cuối năm của kỳ này đã được tạo.']};await query(`INSERT dbo.payroll_bonuses(payroll_id,bonus_type,reason,amount,recorded_by,note) VALUES(@id,'year_end',N'Thưởng thâm niên cuối năm',@amount,@actor,@note)`,{id,amount,actor,note:String(body.note||'').slice(0,500)});await audit(id,p.employee_id,'year_end_bonus',actor,`Thưởng cuối năm ${amount}; không cộng vào lương tháng`);return{amount,multiplier};}
async function salaryIncrease(employeeId,body,actor){const employee=(await query('SELECT id,base_salary FROM dbo.technicians WHERE id=@employeeId',{employeeId})).recordset[0];if(!employee)return{notFound:true};const newSalary=num(body.new_salary),oldSalary=num(employee.base_salary),percent=oldSalary?round((newSalary-oldSalary)/oldSalary*100):0;if(newSalary<=oldSalary||percent>10)return{errors:['Lương mới phải cao hơn lương hiện tại và mức tăng không quá 10%.']};const last=(await query('SELECT TOP 1 effective_date FROM dbo.salary_history WHERE employee_id=@employeeId ORDER BY effective_date DESC',{employeeId})).recordset[0];if(last&&new Date(body.effective_date)-new Date(last.effective_date)<365*86400000)return{errors:['Chưa đủ 12 tháng kể từ lần tăng lương gần nhất.']};await query(`INSERT dbo.salary_history(employee_id,old_salary,new_salary,increase_percent,effective_date,reason,approved_by) VALUES(@employeeId,@oldSalary,@newSalary,@percent,@date,@reason,@actor);UPDATE dbo.technicians SET base_salary=@newSalary,updated_at=GETDATE() WHERE id=@employeeId`,{employeeId,oldSalary,newSalary,percent,date:body.effective_date,reason:String(body.reason||'').trim().slice(0,500),actor});await audit(null,employeeId,'salary_increase',actor,`${oldSalary} -> ${newSalary}`);return{oldSalary,newSalary,percent};}

async function automaticRevenue(payroll) {
    const result = await query(`SELECT b.id, b.request_code,
            COALESCE(b.scheduled_date,b.booking_date,CAST(b.completed_at AS date)) revenue_date,
            b.fullname customer_name, COALESCE(s.name,b.service_type) content,
            COALESCE(b.actual_cost,b.estimated_cost,0) revenue_amount, b.status, b.payment_status
        FROM dbo.bookings b
        LEFT JOIN dbo.services s ON s.id=b.service_id
        WHERE b.technician_id=@employeeId AND b.status='completed'
          AND COALESCE(b.scheduled_date,b.booking_date,CAST(b.completed_at AS date))>=@start
          AND COALESCE(b.scheduled_date,b.booking_date,CAST(b.completed_at AS date))<DATEADD(day,1,@end)
        ORDER BY revenue_date,b.id`, {
        employeeId: payroll.employee_id,
        start: payroll.period_start,
        end: payroll.period_end
    });
    const details = result.recordset;
    return { details, total: round(details.reduce((sum, item) => sum + num(item.revenue_amount), 0)) };
}

async function revenue(id) {
    const payroll = await getById(id);
    if (!payroll) return { notFound: true };
    const [automatic, manualResult] = await Promise.all([
        automaticRevenue(payroll),
        query(`SELECT r.*,u.name created_by_name FROM dbo.payroll_revenue r
            LEFT JOIN dbo.users u ON u.id=r.created_by
            WHERE technician_id=@employeeId AND revenue_month=@month AND revenue_year=@year`, {
            employeeId: payroll.employee_id, month: payroll.payroll_month, year: payroll.payroll_year
        })
    ]);
    return { payroll, automatic, manual: manualResult.recordset[0] || null,
        selected: { amount: num(payroll.revenue_amount), source: payroll.revenue_source || 'auto' } };
}

async function applyRevenue(payroll, amount, source, actor, note) {
    if (payroll.is_locked) return { errors: ['Bảng lương đã khóa.'] };
    const cfg = await policies();
    const productivity = payroll.job_grade === 'technician'
        ? productivityForRevenue(amount, cfg.bands, num(payroll.base_salary), !!cfg.values.productivity_add_to_base)
        : { band: 'Không áp dụng', salary: 0, percent: 0, warning: null };
    await query(`UPDATE dbo.payrolls SET revenue_amount=@amount,revenue_source=@source,
        productivity_band=@band,productivity_percent=@percent,productivity_salary=@salary,
        warning_message=@warning,updated_by=@actor,updated_at=SYSDATETIME() WHERE id=@id`, {
        id: payroll.id, amount, source, band: productivity.band, percent: productivity.percent,
        salary: productivity.salary, warning: productivity.warning, actor
    });
    await audit(payroll.id, payroll.employee_id, source === 'manual' ? 'revenue_manual' : 'revenue_sync', actor, note);
    return { payroll: await recalculate(payroll.id, actor), productivity };
}

async function syncRevenue(id, actor) {
    const payroll = await getById(id);
    if (!payroll) return { notFound: true };
    const automatic = await automaticRevenue(payroll);
    const result = await applyRevenue(payroll, automatic.total, 'auto', actor,
        `Đồng bộ ${automatic.details.length} đơn hợp lệ, tổng ${automatic.total}`);
    return { ...result, automatic };
}

function bookingRevenuePeriod(booking) {
    if (!booking || booking.status !== 'completed' || !num(booking.technician_id)) return null;
    const rawDate = booking.scheduled_date || booking.booking_date || booking.completed_at;
    if (!rawDate) return null;
    const date = rawDate instanceof Date ? rawDate : new Date(rawDate);
    if (Number.isNaN(date.getTime())) return null;
    return { employeeId: num(booking.technician_id), month: date.getMonth() + 1, year: date.getFullYear() };
}

async function syncRevenueForBookingChange(before, after, actor) {
    const periods = new Map();
    for (const booking of [before, after]) {
        const period = bookingRevenuePeriod(booking);
        if (period) periods.set(`${period.employeeId}-${period.year}-${period.month}`, period);
    }
    let updated = 0;
    for (const period of periods.values()) {
        const row = (await query(`SELECT TOP 1 id FROM dbo.payrolls
            WHERE employee_id=@employeeId AND payroll_month=@month AND payroll_year=@year AND is_locked=0`, period)).recordset[0];
        if (!row) continue;
        const payroll = await getById(row.id);
        const automatic = await automaticRevenue(payroll);
        await applyRevenue(payroll, automatic.total, 'auto', actor,
            `Tự động đồng bộ sau khi cập nhật đơn dịch vụ; ${automatic.details.length} đơn hoàn thành, tổng ${automatic.total}`);
        updated++;
    }
    return { updated };
}

async function saveManualRevenue(id, body, actor) {
    const payroll = await getById(id);
    if (!payroll) return { notFound: true };
    const amount = num(body.revenue_amount);
    if (!Number.isFinite(amount) || amount < 0) return { errors: ['Doanh thu thủ công không hợp lệ.'] };
    const note = String(body.note || '').trim().slice(0, 1000);
    await query(`MERGE dbo.payroll_revenue AS target
        USING (SELECT @employeeId technician_id,@month revenue_month,@year revenue_year) AS source
        ON target.technician_id=source.technician_id AND target.revenue_month=source.revenue_month AND target.revenue_year=source.revenue_year
        WHEN MATCHED THEN UPDATE SET revenue_amount=@amount,note=@note,updated_at=SYSDATETIME()
        WHEN NOT MATCHED THEN INSERT(technician_id,revenue_month,revenue_year,revenue_amount,source,note,created_by)
        VALUES(@employeeId,@month,@year,@amount,'manual',@note,@actor);`, {
        employeeId: payroll.employee_id, month: payroll.payroll_month, year: payroll.payroll_year,
        amount, note, actor
    });
    const result = await applyRevenue(payroll, amount, 'manual', actor, `Doanh thu nhập thủ công: ${amount}. ${note}`);
    return { ...result, manual: { revenue_amount: amount, note, source: 'manual' } };
}

async function revenueDetails(id) {
    const data = await revenue(id);
    if (data.notFound) return data;
    return { details: data.automatic.details, total: data.automatic.total,
        selected: data.selected, manual: data.manual };
}

async function productivity(id) {
    const payroll = await getById(id);
    if (!payroll) return { notFound: true };
    const cfg = await policies();
    return { revenue_amount: num(payroll.revenue_amount), revenue_source: payroll.revenue_source,
        productivity: payroll.job_grade === 'technician'
            ? productivityForRevenue(num(payroll.revenue_amount), cfg.bands, num(payroll.base_salary), !!cfg.values.productivity_add_to_base)
            : { band: 'Không áp dụng', salary: 0, percent: 0, warning: null } };
}
module.exports={productivityForRevenue,calculatePolicy,yearEndMultiplier,policies,updateConfiguration,list,getById,generate,updatePayroll,advance,payment,adjustment,penalty,lock,remove,verifyDeletePassword,employees,yearEndBonus,salaryIncrease,automaticRevenue,revenue,revenueDetails,saveManualRevenue,syncRevenue,syncRevenueForBookingChange,productivity};
