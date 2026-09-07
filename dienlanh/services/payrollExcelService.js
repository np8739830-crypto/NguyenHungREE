const ExcelJS = require('exceljs');

const COMPANY = 'CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ NGUYỄN HÙNG';
const NAVY = '17365D', BLUE = '2F75B5', LIGHT_BLUE = 'D9EAF7', PALE = 'F4F8FC', WHITE = 'FFFFFF', GOLD = 'FFF2CC';
const moneyFormat = '#,##0 "₫"';
const statusLabels = { created:'Đã tạo', advanced:'Đã tạm ứng', pending_payment:'Chờ thanh toán', paid:'Đã thanh toán', warning:'Có cảnh báo', locked:'Đã khóa', unpaid:'Chưa thanh toán' };
const number = value => Number(value) || 0;
const sum = (rows, field) => rows.reduce((total, row) => total + number(row[field]), 0);

function border() { return { top:{style:'thin',color:{argb:'FFB8C6D1'}}, left:{style:'thin',color:{argb:'FFB8C6D1'}}, bottom:{style:'thin',color:{argb:'FFB8C6D1'}}, right:{style:'thin',color:{argb:'FFB8C6D1'}} }; }
function fill(color) { return { type:'pattern', pattern:'solid', fgColor:{argb:`FF${color}`} }; }
function periodText(month, year) { return month && year ? `THÁNG ${String(month).padStart(2,'0')}/${year}` : month ? `THÁNG ${String(month).padStart(2,'0')} - TẤT CẢ NĂM` : year ? `NĂM ${year}` : 'TẤT CẢ CÁC KỲ'; }
function formulaSum(column, firstRow, lastRow, result) { return { formula:lastRow>=firstRow?`SUM(${column}${firstRow}:${column}${lastRow})`:'0', result }; }

function title(sheet, period, endColumn) {
    sheet.mergeCells(`A1:${endColumn}1`); sheet.getCell('A1').value=COMPANY;
    sheet.mergeCells(`A2:${endColumn}2`); sheet.getCell('A2').value='BẢNG LƯƠNG NHÂN VIÊN';
    sheet.mergeCells(`A3:${endColumn}3`); sheet.getCell('A3').value=period;
    ['A1','A2','A3'].forEach((address,index)=>{const cell=sheet.getCell(address);cell.alignment={horizontal:'center',vertical:'middle'};cell.font={bold:true,size:index===1?20:index===0?13:12,color:{argb:`FF${index===1?NAVY:BLUE}`}}});
    sheet.getRow(1).height=24;sheet.getRow(2).height=32;sheet.getRow(3).height=22;
}
function styleHeader(row) { row.height=31;row.eachCell(cell=>{cell.fill=fill(NAVY);cell.font={bold:true,color:{argb:`FF${WHITE}`}};cell.alignment={horizontal:'center',vertical:'middle',wrapText:true};cell.border=border()}); }
function styleBody(sheet, firstRow, lastRow, columns) {
    for(let rowNumber=firstRow;rowNumber<=lastRow;rowNumber++){
        const row=sheet.getRow(rowNumber);row.height=25;
        row.eachCell({includeEmpty:true},cell=>{cell.border=border();cell.alignment={vertical:'middle',horizontal:'center',wrapText:true};if((rowNumber-firstRow)%2===1)cell.fill=fill(PALE)});
        row.getCell(3).alignment={vertical:'middle',horizontal:'left',wrapText:true};
        columns.forEach(column=>row.getCell(column).numFmt=moneyFormat);
    }
}

function buildPayrollSheet(workbook, rows, month, year) {
    const sheet=workbook.addWorksheet('Bảng lương',{views:[{state:'frozen',xSplit:4,ySplit:8,topLeftCell:'E9',activeCell:'A9'}],pageSetup:{orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,paperSize:9,margins:{left:.25,right:.25,top:.4,bottom:.4,header:.2,footer:.2}}});
    sheet.properties.defaultRowHeight=22;sheet.headerFooter.oddFooter='Trang &P / &N';title(sheet,periodText(month,year),'P');
    const summaries=[['A5','B5','Tổng nhân viên','A6','B6'],['C5','E5','Tổng quỹ lương','C6','E6'],['F5','H5','Tổng doanh thu','F6','H6'],['I5','K5','Tổng tạm ứng','I6','K6'],['L5','M5','Tổng đã thanh toán','L6','M6'],['N5','P5','Còn phải trả','N6','P6']];
    summaries.forEach(([a,b,label,c,d])=>{sheet.mergeCells(`${a}:${b}`);sheet.mergeCells(`${c}:${d}`);const labelCell=sheet.getCell(a),valueCell=sheet.getCell(c);labelCell.value=label;labelCell.fill=fill(BLUE);labelCell.font={bold:true,color:{argb:`FF${WHITE}`}};valueCell.fill=fill(LIGHT_BLUE);valueCell.font={bold:true,size:14,color:{argb:`FF${NAVY}`}};[labelCell,valueCell].forEach(cell=>{cell.alignment={horizontal:'center',vertical:'middle'};cell.border=border()})});
    const first=9,last=first+rows.length-1,totalRow=first+rows.length;
    const totals={F:sum(rows,'revenue_amount'),G:sum(rows,'productivity_salary'),H:sum(rows,'base_salary'),I:sum(rows,'allowance'),J:sum(rows,'bonus'),K:sum(rows,'deduction'),L:sum(rows,'advance_total'),M:sum(rows,'paid_total'),N:sum(rows,'net_salary'),O:sum(rows,'balance_due')};
    sheet.getCell('A6').value={formula:rows.length?`COUNTA(B${first}:B${last})`:'0',result:rows.length};
    sheet.getCell('C6').value=formulaSum('N',first,last,totals.N);sheet.getCell('F6').value=formulaSum('F',first,last,totals.F);sheet.getCell('I6').value=formulaSum('L',first,last,totals.L);sheet.getCell('L6').value=formulaSum('M',first,last,totals.M);sheet.getCell('N6').value=formulaSum('O',first,last,totals.O);
    ['C6','F6','I6','L6','N6'].forEach(address=>sheet.getCell(address).numFmt=moneyFormat);
    const headers=['STT','Mã NV','Họ và tên','Loại nhân viên','Ngày công','Doanh thu','Mức năng suất','Lương cơ bản','Phụ cấp','Thưởng','Phạt/Khấu trừ','Tạm ứng','Đã thanh toán','Thực nhận','Còn phải trả','Trạng thái'];
    sheet.getRow(8).values=headers;styleHeader(sheet.getRow(8));
    rows.forEach((item,index)=>sheet.addRow([index+1,item.employee_code,item.employee_name,`${item.job_grade==='technician'?'Bậc thợ điện lạnh':'Phụ điện lạnh'}${item.employee_type==='probation'?' - Thử việc':' - Chính thức'}`,number(item.working_days),number(item.revenue_amount),number(item.productivity_salary),number(item.base_salary),number(item.allowance),number(item.bonus),number(item.deduction),number(item.advance_total),number(item.paid_total),number(item.net_salary),number(item.balance_due),statusLabels[item.status]||item.status]));
    styleBody(sheet,first,last,[6,7,8,9,10,11,12,13,14,15]);
    const total=sheet.getRow(totalRow);sheet.mergeCells(`A${totalRow}:D${totalRow}`);total.getCell(1).value='TỔNG CỘNG';total.getCell(5).value=formulaSum('E',first,last,sum(rows,'working_days'));
    Object.entries(totals).forEach(([column,result])=>{sheet.getCell(`${column}${totalRow}`).value=formulaSum(column,first,last,result);sheet.getCell(`${column}${totalRow}`).numFmt=moneyFormat});
    total.eachCell({includeEmpty:true},cell=>{cell.fill=fill(GOLD);cell.font={bold:true,color:{argb:`FF${NAVY}`}};cell.border=border();cell.alignment={horizontal:'center',vertical:'middle',wrapText:true}});total.height=28;
    sheet.autoFilter={from:{row:8,column:1},to:{row:Math.max(8,last),column:16}};
    const widths=[7,13,25,23,12,18,18,17,16,15,17,16,17,17,17,18];sheet.columns.forEach((column,index)=>column.width=widths[index]);
    sheet.getColumn(3).alignment={horizontal:'left'};sheet.getColumn(16).alignment={horizontal:'center'};
    sheet.addConditionalFormatting({ref:`O${first}:O${Math.max(first,last)}`,rules:[{type:'cellIs',operator:'greaterThan',formulae:[0],style:{font:{color:{argb:'FF9C0006'},bold:true},fill:{type:'pattern',pattern:'solid',bgColor:{argb:'FFFFC7CE'}}}}]});
    return sheet;
}

function buildDetailSheet(workbook, rows, month, year) {
    const sheet=workbook.addWorksheet('Chi tiết tính lương',{views:[{state:'frozen',xSplit:2,ySplit:5,topLeftCell:'C6'}],pageSetup:{orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0}});title(sheet,`CHI TIẾT TÍNH LƯƠNG - ${periodText(month,year)}`,'S');
    const headers=['Mã NV','Họ tên','Loại NV','Doanh thu','Ngày công','Ngày chuẩn','Mức năng suất','Lương cơ bản','Ăn trưa','Xăng xe','Điện thoại','Phụ cấp','Thưởng','Phạt/KT','Tạm ứng','Đã thanh toán','Thực nhận','Còn phải trả','Cách tính / Ghi chú'];sheet.getRow(5).values=headers;styleHeader(sheet.getRow(5));
    rows.forEach((item,index)=>{const rowNumber=6+index,allowanceResult=number(item.allowance);const row=sheet.addRow([item.employee_code,item.employee_name,item.job_grade==='technician'?'Bậc thợ điện lạnh':'Phụ điện lạnh',number(item.revenue_amount),number(item.working_days),number(item.standard_days),number(item.productivity_salary),number(item.base_salary),number(item.meal_allowance),number(item.fuel_allowance),number(item.phone_allowance),{formula:`SUM(I${rowNumber}:K${rowNumber})`,result:allowanceResult},number(item.bonus),number(item.deduction),number(item.advance_total),number(item.paid_total),number(item.net_salary),number(item.balance_due),`${item.job_grade==='technician'?'Lương theo mức năng suất':'Lương cơ bản theo ngày công'} + phụ cấp + thưởng + tăng ca - phạt/khấu trừ. ${item.warning_message||''}`]);row.getCell(19).alignment={horizontal:'left',vertical:'middle',wrapText:true}});
    const first=6,last=first+rows.length-1,totalRow=first+rows.length;styleBody(sheet,first,last,[4,7,8,9,10,11,12,13,14,15,16,17,18]);
    sheet.mergeCells(`A${totalRow}:C${totalRow}`);sheet.getCell(`A${totalRow}`).value='TỔNG CỘNG';
    for(const column of ['D','G','H','I','J','K','L','M','N','O','P','Q','R']){const field={D:'revenue_amount',G:'productivity_salary',H:'base_salary',I:'meal_allowance',J:'fuel_allowance',K:'phone_allowance',L:'allowance',M:'bonus',N:'deduction',O:'advance_total',P:'paid_total',Q:'net_salary',R:'balance_due'}[column];sheet.getCell(`${column}${totalRow}`).value=formulaSum(column,first,last,sum(rows,field));sheet.getCell(`${column}${totalRow}`).numFmt=moneyFormat}
    sheet.getRow(totalRow).eachCell({includeEmpty:true},cell=>{cell.fill=fill(GOLD);cell.font={bold:true,color:{argb:`FF${NAVY}`}};cell.border=border();cell.alignment={horizontal:'center',vertical:'middle',wrapText:true}});
    sheet.autoFilter={from:{row:5,column:1},to:{row:Math.max(5,last),column:19}};
    const widths=[13,25,22,18,11,11,18,17,14,14,14,16,15,16,16,17,17,17,50];sheet.columns.forEach((column,index)=>column.width=widths[index]);
    return sheet;
}

async function createPayrollWorkbook(rows,{month,year}={}) {
    const workbook=new ExcelJS.Workbook();workbook.creator='NGUYỄN HÙNG';workbook.company=COMPANY;workbook.subject='Bảng lương nhân viên';workbook.created=new Date();workbook.calcProperties.fullCalcOnLoad=true;workbook.calcProperties.forceFullCalc=true;workbook.calcProperties.calcMode='auto';
    buildPayrollSheet(workbook,rows,Number(month)||null,Number(year)||null);buildDetailSheet(workbook,rows,Number(month)||null,Number(year)||null);
    return workbook;
}
module.exports={createPayrollWorkbook,periodText,moneyFormat};
