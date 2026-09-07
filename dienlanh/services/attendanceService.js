const { query, getConnection } = require('../config/database');
const statuses = ['present', 'leave', 'unauthorized_leave', 'holiday', 'business_trip', 'off'];
const datePattern = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

function validDate(value) {
    const date = String(value || '');
    if (!datePattern.test(date)) return false;
    const [year, month, day] = date.split('-').map(Number);
    return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}
function validPeriod(month, year) {
    return Number.isInteger(Number(month)) && Number(month) >= 1 && Number(month) <= 12
        && Number.isInteger(Number(year)) && Number(year) >= 2000 && Number(year) <= 2100;
}
function timeMinutes(value) { if (!timePattern.test(String(value || ''))) return null; const [h,m]=String(value).split(':').map(Number); return h*60+m; }
function hours(a,b) { const start=timeMinutes(a),end=timeMinutes(b); return start==null||end==null||end<=start?0:Math.round((end-start)/60*100)/100; }
function validate(body={}) {
    const errors=[],technicianId=Number(body.technician_id),date=String(body.attendance_date||''),status=String(body.status||'');
    const checkIn=String(body.check_in||'').trim(),checkOut=String(body.check_out||'').trim(),otText=String(body.overtime_hours??'0').trim(),overtime=Number(otText);
    if(!Number.isInteger(technicianId)||technicianId<=0)errors.push('Nhân viên chấm công không hợp lệ.');
    if(!validDate(date))errors.push('Ngày chấm công không hợp lệ.');
    if(!statuses.includes(status))errors.push('Nội dung chấm công không hợp lệ.');
    if(otText===''||!Number.isFinite(overtime)||overtime<0)errors.push('Tăng ca phải là số lớn hơn hoặc bằng 0.');
    if(status==='present'){
        if(!checkIn)errors.push('Vui lòng nhập giờ vào.');else if(!timePattern.test(checkIn))errors.push('Giờ vào không hợp lệ, định dạng phải là HH:mm.');
        if(!checkOut)errors.push('Vui lòng nhập giờ ra.');else if(!timePattern.test(checkOut))errors.push('Giờ ra không hợp lệ, định dạng phải là HH:mm.');
        if(timePattern.test(checkIn)&&timePattern.test(checkOut)&&timeMinutes(checkOut)<=timeMinutes(checkIn))errors.push('Giờ ra phải lớn hơn giờ vào.');
    }
    return{errors,value:{technicianId,date,status,checkIn:status==='present'?checkIn:null,checkOut:status==='present'?checkOut:null,overtime,note:String(body.note||'').trim().slice(0,500)}};
}
async function closed(month,year){return!!(await query('SELECT is_closed FROM dbo.attendance_periods WHERE attendance_month=@month AND attendance_year=@year',{month,year})).recordset[0]?.is_closed}
function dayOf(value){const text=value instanceof Date?value.toISOString().slice(0,10):String(value);return Number(text.slice(8,10))}
function dashboardStats(data,month,year,today=new Date()){
 const isCurrentMonth=Number(month)===today.getMonth()+1&&Number(year)===today.getFullYear(),todayDay=today.getDate();
 return{employees:data.length,total_days:data.reduce((s,x)=>s+x.summary.present,0),total_work_hours:data.reduce((s,x)=>s+x.summary.work_hours,0),total_overtime_hours:data.reduce((s,x)=>s+x.summary.overtime_hours,0),present_today:isCurrentMonth?data.filter(x=>['present','business_trip'].includes(x.days[todayDay]?.status)).length:0,leave:data.reduce((s,x)=>s+x.summary.leave,0),unauthorized:data.reduce((s,x)=>s+x.summary.unauthorized,0)};
}
async function list(f={}){
 const month=Number(f.month),year=Number(f.year),search=`%${String(f.search||'').trim()}%`,grade=String(f.job_grade||''),start=`${year}-${String(month).padStart(2,'0')}-01`;
 if(!validPeriod(month,year))return{errors:['Tháng hoặc năm chấm công không hợp lệ.']};
 const tech=(await query(`SELECT id,full_name,job_grade,employee_type,start_date,work_status,CONCAT('KT-',RIGHT('000'+CAST(id AS VARCHAR(10)),3)) employee_code FROM dbo.technicians WHERE COALESCE(work_status,'active')<>'inactive' AND (@grade='' OR job_grade=@grade) AND (full_name LIKE @search OR CONCAT('KT-',RIGHT('000'+CAST(id AS VARCHAR(10)),3)) LIKE @search) ORDER BY full_name`,{grade,search})).recordset;
 const rows=(await query(`SELECT a.id,a.technician_id,CONVERT(CHAR(10),a.attendance_date,23) attendance_date,a.status,CONVERT(CHAR(5),a.check_in,108) check_in,CONVERT(CHAR(5),a.check_out,108) check_out,a.work_hours,a.overtime_hours,a.note FROM dbo.attendance a JOIN dbo.technicians t ON t.id=a.technician_id WHERE a.attendance_date>=@start AND a.attendance_date<DATEADD(month,1,@start) AND COALESCE(t.work_status,'active')<>'inactive' AND (t.start_date IS NULL OR a.attendance_date>=t.start_date)`,{start})).recordset,map={};
 rows.forEach(x=>{(map[x.technician_id]||={})[dayOf(x.attendance_date)]=x});
 const data=tech.map(t=>{const days=map[t.id]||{},v=Object.values(days);return{...t,days,summary:{present:v.filter(x=>['present','business_trip'].includes(x.status)).length,leave:v.filter(x=>x.status==='leave').length,unauthorized:v.filter(x=>x.status==='unauthorized_leave').length,work_hours:Math.round(v.reduce((s,x)=>s+Number(x.work_hours||0),0)*100)/100,overtime_hours:Math.round(v.reduce((s,x)=>s+Number(x.overtime_hours||0),0)*100)/100}}});
 return{data,daysInMonth:new Date(year,month,0).getDate(),isClosed:await closed(month,year),stats:dashboardStats(data,month,year)};
}
async function save(body,actor){
 const checked=validate(body);if(checked.errors.length)return{errors:checked.errors};const v=checked.value,month=Number(v.date.slice(5,7)),year=Number(v.date.slice(0,4));if(await closed(month,year))return{errors:['Tháng chấm công đã chốt.']};
 const technician=(await query(`SELECT TOP 1 id FROM dbo.technicians WHERE id=@id AND COALESCE(work_status,'active')<>'inactive' AND (start_date IS NULL OR start_date<=@date)`,{id:v.technicianId,date:v.date})).recordset[0];
 if(!technician){
  const employee=(await query(`SELECT TOP 1 id,full_name,COALESCE(work_status,'active') work_status,CONVERT(CHAR(10),start_date,23) start_date FROM dbo.technicians WHERE id=@id`,{id:v.technicianId})).recordset[0];
  if(!employee)return{errors:['Không tìm thấy nhân viên chấm công.']};
  if(employee.work_status==='inactive')return{errors:[`${employee.full_name} hiện không hoạt động nên không thể chấm công.`]};
  if(employee.start_date&&v.date<employee.start_date){const [y,m,d]=employee.start_date.split('-');return{errors:[`Không thể chấm công ngày ${v.date.split('-').reverse().join('/')} vì ${employee.full_name} bắt đầu làm việc từ ngày ${d}/${m}/${y}. Vui lòng chọn ngày phù hợp hoặc cập nhật ngày bắt đầu trong hồ sơ kỹ thuật viên.`]}}
  return{errors:['Không thể chấm công cho nhân viên này.']};
 }
 const existing=(await query('SELECT * FROM dbo.attendance WHERE technician_id=@id AND attendance_date=@date',{id:v.technicianId,date:v.date})).recordset[0],work=hours(v.checkIn,v.checkOut);
 const r=await query(`MERGE dbo.attendance t USING(SELECT @id technician_id,@date attendance_date)s ON t.technician_id=s.technician_id AND t.attendance_date=s.attendance_date WHEN MATCHED THEN UPDATE SET status=@status,check_in=CAST(@checkIn AS TIME(0)),check_out=CAST(@checkOut AS TIME(0)),work_hours=@work,overtime_hours=@ot,overtime_approved_by=CASE WHEN @ot>0 THEN @actor ELSE NULL END,overtime_approved_at=CASE WHEN @ot>0 THEN SYSDATETIME() ELSE NULL END,note=@note,updated_by=@actor,updated_at=SYSDATETIME() WHEN NOT MATCHED THEN INSERT(technician_id,attendance_date,status,check_in,check_out,work_hours,overtime_hours,overtime_approved_by,overtime_approved_at,note,created_by) VALUES(@id,@date,@status,CAST(@checkIn AS TIME(0)),CAST(@checkOut AS TIME(0)),@work,@ot,CASE WHEN @ot>0 THEN @actor ELSE NULL END,CASE WHEN @ot>0 THEN SYSDATETIME() ELSE NULL END,@note,@actor) OUTPUT INSERTED.id,INSERTED.technician_id,CONVERT(CHAR(10),INSERTED.attendance_date,23) attendance_date,INSERTED.status,CONVERT(CHAR(5),INSERTED.check_in,108) check_in,CONVERT(CHAR(5),INSERTED.check_out,108) check_out,INSERTED.work_hours,INSERTED.overtime_hours,INSERTED.note;`,{id:v.technicianId,date:v.date,status:v.status,checkIn:v.checkIn,checkOut:v.checkOut,work,ot:v.overtime,actor,note:v.note}),item=r.recordset[0];
 await query('INSERT dbo.attendance_audit_logs(attendance_id,technician_id,attendance_date,old_status,new_status,action_key,actor_id,reason) VALUES(@aid,@id,@date,@old,@status,@action,@actor,@reason)',{aid:item.id,id:v.technicianId,date:v.date,old:existing?.status||null,status:v.status,action:existing?'update':'create',actor,reason:v.note});return{attendance:item};
}
async function bulk(body,actor){const ids=Array.isArray(body.technician_ids)?body.technician_ids:[];if(!ids.length)return{errors:['Vui lòng chọn ít nhất một nhân viên.']};let saved=0;for(const id of ids){const r=await save({...body,technician_id:id},actor);if(r.errors)return r;saved++}return{saved}}
async function period(month,year,value,actor){if(!validPeriod(month,year))return{errors:['Tháng hoặc năm chấm công không hợp lệ.']};await query(`MERGE dbo.attendance_periods t USING(SELECT @month m,@year y)s ON t.attendance_month=s.m AND t.attendance_year=s.y WHEN MATCHED THEN UPDATE SET is_closed=@value,closed_by=CASE WHEN @value=1 THEN @actor ELSE closed_by END,closed_at=CASE WHEN @value=1 THEN SYSDATETIME() ELSE closed_at END,reopened_by=CASE WHEN @value=0 THEN @actor ELSE reopened_by END,reopened_at=CASE WHEN @value=0 THEN SYSDATETIME() ELSE reopened_at END WHEN NOT MATCHED THEN INSERT(attendance_month,attendance_year,is_closed,closed_by,closed_at)VALUES(@month,@year,@value,CASE WHEN @value=1 THEN @actor END,CASE WHEN @value=1 THEN SYSDATETIME() END);`,{month,year,value:value?1:0,actor});return{isClosed:value}}
async function removePeriod(month,year,actor){
 if(!validPeriod(month,year))return{errors:['Tháng hoặc năm chấm công không hợp lệ.']};
 if(await closed(month,year))return{errors:['Tháng chấm công đã chốt. Vui lòng mở khóa trước khi xóa.']};
 const start=`${year}-${String(month).padStart(2,'0')}-01`,pool=await getConnection(),transaction=pool.transaction();
 await transaction.begin();
 try{
  const request=()=>transaction.request().input('start',start).input('actor',actor);
  await request().query(`INSERT dbo.attendance_audit_logs(attendance_id,technician_id,attendance_date,old_status,new_status,action_key,actor_id,reason) SELECT id,technician_id,attendance_date,status,NULL,'delete',@actor,N'Xóa chấm công tháng '+CAST(MONTH(@start) AS NVARCHAR(2))+'/'+CAST(YEAR(@start) AS NVARCHAR(4)) FROM dbo.attendance WHERE attendance_date>=@start AND attendance_date<DATEADD(month,1,@start)`);
  const result=await request().query(`DELETE FROM dbo.attendance WHERE attendance_date>=@start AND attendance_date<DATEADD(month,1,@start)`);
  await transaction.commit();
  return{deleted:result.rowsAffected[0]||0};
 }catch(error){await transaction.rollback();throw error}
}
async function summary(employeeId,month,year){if(!validPeriod(month,year))return{record_count:0,has_data:false,working_days:0,leave_days:0,unauthorized_leave_days:0,overtime_hours:0};const start=`${year}-${String(month).padStart(2,'0')}-01`,r=(await query(`SELECT COUNT(*) record_count,SUM(CASE WHEN a.status IN('present','business_trip') THEN 1 ELSE 0 END) working_days,SUM(CASE WHEN a.status='leave' THEN 1 ELSE 0 END) leave_days,SUM(CASE WHEN a.status='unauthorized_leave' THEN 1 ELSE 0 END) unauthorized_leave_days,SUM(a.overtime_hours) overtime_hours FROM dbo.attendance a JOIN dbo.technicians t ON t.id=a.technician_id WHERE a.technician_id=@employeeId AND a.attendance_date>=@start AND a.attendance_date<DATEADD(month,1,@start) AND (t.start_date IS NULL OR a.attendance_date>=t.start_date)`,{employeeId,start})).recordset[0],recordCount=Number(r.record_count)||0;return{record_count:recordCount,has_data:recordCount>0,working_days:Number(r.working_days)||0,leave_days:Number(r.leave_days)||0,unauthorized_leave_days:Number(r.unauthorized_leave_days)||0,overtime_hours:Number(r.overtime_hours)||0}}
module.exports={statuses,validDate,validPeriod,timeMinutes,hours,validate,dashboardStats,list,save,bulk,period,removePeriod,summary};
