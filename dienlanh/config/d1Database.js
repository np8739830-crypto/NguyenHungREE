const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
const apiToken = process.env.CLOUDFLARE_D1_API_TOKEN;

function assertConfigured() {
    const missing = [
        ['CLOUDFLARE_ACCOUNT_ID', accountId],
        ['CLOUDFLARE_D1_DATABASE_ID', databaseId],
        ['CLOUDFLARE_D1_API_TOKEN', apiToken]
    ].filter(([, value]) => !value).map(([key]) => key);
    if (missing.length) throw new Error(`Cloudflare D1 chưa được cấu hình: ${missing.join(', ')}`);
}

function splitStatements(source) {
    const statements = [];
    let current = '';
    let quoted = false;
    for (let index = 0; index < source.length; index += 1) {
        const character = source[index];
        if (character === "'") {
            if (quoted && source[index + 1] === "'") {
                current += "''";
                index += 1;
                continue;
            }
            quoted = !quoted;
        }
        if (character === ';' && !quoted) {
            if (current.trim()) statements.push(current.trim());
            current = '';
        } else {
            current += character;
        }
    }
    if (current.trim()) statements.push(current.trim());
    return statements;
}

function translateDateFunctions(statement) {
    return statement
        .replace(/\b(?:GETDATE|SYSDATETIME|SYSUTCDATETIME)\s*\(\s*\)/gi, 'CURRENT_TIMESTAMP')
        .replace(/DATEADD\s*\(\s*(day|hour|minute|second|month|year)\s*,\s*([+-]?\d+)\s*,\s*([^()]+?)\s*\)/gi,
            (_, unit, amount, expression) => `datetime(${expression.trim()}, '${Number(amount) >= 0 ? '+' : ''}${Number(amount)} ${unit}')`)
        .replace(/CONVERT\s*\(\s*date\s*,\s*([^,()]+)\s*,\s*23\s*\)/gi, 'date($1)')
        .replace(/CONVERT\s*\(\s*CHAR\s*\(\s*10\s*\)\s*,\s*([^,()]+)\s*,\s*23\s*\)/gi, "strftime('%Y-%m-%d',$1)")
        .replace(/CONVERT\s*\(\s*CHAR\s*\(\s*5\s*\)\s*,\s*([^,()]+)\s*,\s*108\s*\)/gi, "substr($1,1,5)")
        .replace(/CAST\s*\(\s*([^()]+?)\s+AS\s+date\s*\)/gi, 'date($1)')
        .replace(/CAST\s*\(\s*([^()]+?)\s+AS\s+TIME\s*\(\s*0\s*\)\s*\)/gi, '$1');
}

function translateOutput(statement) {
    let returning = '';
    const outputPattern = /\s+OUTPUT\s+([\s\S]+?)\s+(?=VALUES\s*\(|WHERE\b)/i;
    const match = statement.match(outputPattern);
    if (!match) return statement;
    returning = match[1]
        .replace(/\bINSERTED\./gi, '')
        .replace(/\bDELETED\./gi, '')
        .trim();
    statement = statement.replace(outputPattern, ' ');
    return `${statement} RETURNING ${returning}`;
}

function translateSql(sqlText) {
    let statement = String(sqlText).trim();
    if (/^MERGE\s+(?:dbo\.)?attendance\s+/i.test(statement)) {
        return `INSERT INTO attendance(technician_id,attendance_date,status,check_in,check_out,work_hours,overtime_hours,overtime_approved_by,overtime_approved_at,note,created_by)
            VALUES(@id,@date,@status,@checkIn,@checkOut,@work,@ot,CASE WHEN @ot>0 THEN @actor ELSE NULL END,CASE WHEN @ot>0 THEN CURRENT_TIMESTAMP ELSE NULL END,@note,@actor)
            ON CONFLICT(technician_id,attendance_date) DO UPDATE SET status=excluded.status,check_in=excluded.check_in,check_out=excluded.check_out,work_hours=excluded.work_hours,overtime_hours=excluded.overtime_hours,overtime_approved_by=excluded.overtime_approved_by,overtime_approved_at=excluded.overtime_approved_at,note=excluded.note,updated_by=@actor,updated_at=CURRENT_TIMESTAMP
            RETURNING id,technician_id,attendance_date,status,check_in,check_out,work_hours,overtime_hours,note`;
    }
    if (/^MERGE\s+(?:dbo\.)?attendance_periods\s+/i.test(statement)) {
        return `INSERT INTO attendance_periods(attendance_month,attendance_year,is_closed,closed_by,closed_at)
            VALUES(@month,@year,@value,CASE WHEN @value=1 THEN @actor END,CASE WHEN @value=1 THEN CURRENT_TIMESTAMP END)
            ON CONFLICT(attendance_month,attendance_year) DO UPDATE SET is_closed=excluded.is_closed,closed_by=CASE WHEN @value=1 THEN @actor ELSE closed_by END,closed_at=CASE WHEN @value=1 THEN CURRENT_TIMESTAMP ELSE closed_at END,reopened_by=CASE WHEN @value=0 THEN @actor ELSE reopened_by END,reopened_at=CASE WHEN @value=0 THEN CURRENT_TIMESTAMP ELSE reopened_at END`;
    }
    if (/^MERGE\s+(?:dbo\.)?payroll_revenue\s+/i.test(statement)) {
        return `INSERT INTO payroll_revenue(technician_id,revenue_month,revenue_year,revenue_amount,source,note,created_by)
            VALUES(@employeeId,@month,@year,@amount,'manual',@note,@actor)
            ON CONFLICT(technician_id,revenue_month,revenue_year) DO UPDATE SET revenue_amount=excluded.revenue_amount,note=excluded.note,updated_at=CURRENT_TIMESTAMP`;
    }
    const outerTop = statement.match(/^SELECT\s+TOP\s*\(?\s*(\d+)\s*\)?\s+/i);
    statement = statement
        .replace(/\bdbo\./gi, '')
        .replace(/\[([^\]]+)\]/g, '"$1"')
        .replace(/\bN'/g, "'")
        .replace(/\s+WITH\s*\(\s*(?:UPDLOCK|HOLDLOCK)(?:\s*,\s*(?:UPDLOCK|HOLDLOCK))*\s*\)/gi, '')
        .replace(/\bSELECT\s+TOP\s*\(?\s*\d+\s*\)?\s+/gi, 'SELECT ')
        .replace(/\bINSERT\s+(?!INTO\b)(["A-Za-z_]["A-Za-z0-9_]*)\s*\(/gi, 'INSERT INTO $1 (')
        .replace(/OFFSET\s+(@\w+|\d+)\s+ROWS\s+FETCH\s+NEXT\s+(@\w+|\d+)\s+ROWS\s+ONLY/gi, 'LIMIT $2 OFFSET $1')
        .replace(/\bISNULL\s*\(/gi, 'IFNULL(')
        .replace(/RIGHT\s*\(\s*('(?:[^']|'')*')\s*\+\s*CAST\s*\(\s*([^()]+?)\s+AS\s+VARCHAR\s*\(\s*\d+\s*\)\s*\)\s*,\s*(\d+)\s*\)/gi,
            'substr($1 || CAST($2 AS TEXT), -$3)')
        .replace(/LEFT\s*\(\s*('(?:[^']|'')*')\s*\+\s*CAST\s*\(\s*([^()]+?)\s+AS\s+VARCHAR\s*\(\s*\d+\s*\)\s*\)\s*,\s*(\d+)\s*\)/gi,
            'substr($1 || CAST($2 AS TEXT), 1, $3)');
    statement = translateDateFunctions(statement);
    statement = translateOutput(statement);
    if (outerTop && !/\bLIMIT\s+\d+\s*$/i.test(statement)) statement += ` LIMIT ${outerTop[1]}`;
    return statement;
}

function bindParameters(statement, parameters) {
    const values = [];
    const sql = statement.replace(/@(\w+)/g, (_, key) => {
        if (!Object.prototype.hasOwnProperty.call(parameters, key)) throw new Error(`Thiếu tham số D1: ${key}`);
        const raw = parameters[key];
        values.push(raw instanceof Date ? raw.toISOString() : typeof raw === 'boolean' ? (raw ? 1 : 0) : raw ?? null);
        return '?';
    });
    return { sql, params: values };
}

async function requestD1(sql, params = []) {
    assertConfigured();
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            const response = await fetch(
                `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
                {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sql, params })
                }
            );
            const payload = await response.json();
            const failed = payload.result?.find(item => item.success === false || item.error);
            if (!response.ok || !payload.success || failed) {
                const error = new Error(payload.errors?.[0]?.message || failed?.error || `Cloudflare D1 HTTP ${response.status}`);
                error.status = response.status;
                throw error;
            }
            return payload.result?.[0] || { results: [], meta: {} };
        } catch (error) {
            const retryable = !error.status || error.status === 429 || error.status >= 500;
            if (!retryable || attempt === 2) throw error;
        }
    }
}

async function query(sqlText, parameters = {}) {
    const statements = splitStatements(sqlText).filter(statement => !/^USE\s+/i.test(statement));
    let recordset = [];
    const rowsAffected = [];
    for (let statement of statements) {
        if (/^SELECT\s+SCOPE_IDENTITY\(\)/i.test(statement)) continue;
        statement = translateSql(statement);
        const bound = bindParameters(statement, parameters);
        const result = await requestD1(bound.sql, bound.params);
        if (Array.isArray(result.results) && result.results.length) recordset = result.results;
        rowsAffected.push(Number(result.meta?.changes || 0));
    }
    return { recordset, rowsAffected };
}

async function getById(table, id) {
    return (await query(`SELECT * FROM ${table} WHERE id=@id`, { id })).recordset[0] || null;
}

async function getAll(table, orderBy = 'id', direction = 'ASC') {
    return (await query(`SELECT * FROM ${table} ORDER BY ${orderBy} ${direction}`)).recordset;
}

async function insert(table, data) {
    const keys = Object.keys(data);
    const result = await query(
        `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(key => `@${key}`).join(',')}) RETURNING id`,
        data
    );
    return result.recordset[0]?.id || null;
}

async function update(table, id, data) {
    const keys = Object.keys(data);
    await query(`UPDATE ${table} SET ${keys.map(key => `${key}=@${key}`).join(',')} WHERE id=@id`, { ...data, id });
    return true;
}

async function remove(table, id) {
    await query(`DELETE FROM ${table} WHERE id=@id`, { id });
    return true;
}

async function count(table, where = '1=1', params = {}) {
    return Number((await query(`SELECT COUNT(*) total FROM ${table} WHERE ${where}`, params)).recordset[0]?.total || 0);
}

async function paginate(table, page = 1, limit = 10, where = '1=1', params = {}, orderBy = 'id', direction = 'DESC') {
    const total = await count(table, where, params);
    const data = (await query(`SELECT * FROM ${table} WHERE ${where} ORDER BY ${orderBy} ${direction} LIMIT @limit OFFSET @offset`, {
        ...params, limit, offset: (page - 1) * limit
    })).recordset;
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function testConnection() {
    try {
        await requestD1('SELECT 1 AS connected');
        return true;
    } catch (error) {
        console.error(`Lỗi kết nối Cloudflare D1: ${error.message}`);
        return false;
    }
}

module.exports = {
    provider: 'd1',
    query,
    getById,
    getAll,
    insert,
    update,
    remove,
    count,
    paginate,
    testConnection,
    requestD1,
    translateSql
};
