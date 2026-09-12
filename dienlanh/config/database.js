// Keep Windows integrated authentication for local development, while allowing
// SQL authentication on Linux/VPS environments.
const authMode = (process.env.DB_AUTH_MODE || (process.platform === 'win32' ? 'trusted' : 'sql')).toLowerCase();
const useTrustedConnection = authMode === 'trusted';
const sql = useTrustedConnection ? require('mssql/msnodesqlv8') : require('mssql');

const server = process.env.DB_SERVER || 'localhost';
const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined;
const serverAddress = port ? `${server},${port}` : server;
const database = process.env.DB_NAME || 'DienLanhNguyenHung';
const user = process.env.DB_USER;
const password = process.env.DB_PASSWORD;
const driver = process.env.DB_ODBC_DRIVER || 'ODBC Driver 17 for SQL Server';
const trustServerCertificate = process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false';
const encrypt = process.env.DB_ENCRYPT === 'true';

const commonConfig = {
    server,
    port,
    database,
    options: {
        encrypt,
        trustServerCertificate,
        enableArithAbort: true
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    },
    connectionTimeout: 15000,
    requestTimeout: 30000
};

const connectionStringParts = [
    `Driver={${driver}}`,
    `Server=${serverAddress}`,
    `Database=${database}`,
    'Trusted_Connection=Yes'
];

if (encrypt) connectionStringParts.push('Encrypt=Yes');
if (trustServerCertificate) connectionStringParts.push('TrustServerCertificate=Yes');

const config = useTrustedConnection
    ? {
        ...commonConfig,
        connectionString: connectionStringParts.join(';') + ';',
        options: { ...commonConfig.options, trustedConnection: true }
    }
    : { ...commonConfig, user, password };

let pool = null;

function attachPoolErrorHandler(activePool) {
    activePool.on('error', err => {
        console.error('❌ Lỗi connection pool SQL Server:', err.message);
        pool = null;
    });
}

async function getConnection() {
    try {
        if (!useTrustedConnection && (!user || !password)) {
            throw new Error('DB_USER and DB_PASSWORD are required when DB_AUTH_MODE=sql');
        }

        if (pool && pool.connected) {
            return pool;
        }

        pool = await sql.connect(config);
        attachPoolErrorHandler(pool);
        console.log(`✅ Kết nối SQL Server thành công (${server}/${database})`);
        return pool;
    } catch (err) {
        pool = null;
        console.error('❌ Lỗi kết nối SQL Server:', err.message);
        throw err;
    }
}

async function query(sqlQuery, params = {}) {
    const conn = await getConnection();
    const request = conn.request();

    // Add parameters
    Object.keys(params).forEach(key => {
        request.input(key, params[key]);
    });

    const result = await request.query(sqlQuery);
    return result;
}

async function executeProcedure(procedureName, params = {}) {
    const conn = await getConnection();
    const request = conn.request();

    Object.keys(params).forEach(key => {
        request.input(key, params[key]);
    });

    const result = await request.execute(procedureName);
    return result;
}

async function getById(table, id) {
    const result = await query(`SELECT * FROM ${table} WHERE id = @id`, { id });
    return result.recordset[0] || null;
}

async function getAll(table, orderBy = 'id', direction = 'ASC') {
    const result = await query(`SELECT * FROM ${table} ORDER BY ${orderBy} ${direction}`);
    return result.recordset;
}

async function insert(table, data) {
    const columns = Object.keys(data).join(', ');
    const values = Object.keys(data).map(key => `@${key}`).join(', ');

    const params = {};
    Object.keys(data).forEach(key => {
        params[key] = data[key];
    });

    const result = await query(
        `INSERT INTO ${table} (${columns}) VALUES (${values}); SELECT SCOPE_IDENTITY() AS id;`,
        params
    );
    return result.recordset[0]?.id || null;
}

async function update(table, id, data) {
    const setClause = Object.keys(data).map(key => `${key} = @${key}`).join(', ');

    const params = { id };
    Object.keys(data).forEach(key => {
        params[key] = data[key];
    });

    await query(`UPDATE ${table} SET ${setClause} WHERE id = @id`, params);
    return true;
}

async function remove(table, id) {
    await query(`DELETE FROM ${table} WHERE id = @id`, { id });
    return true;
}

async function count(table, where = '1=1', params = {}) {
    const result = await query(`SELECT COUNT(*) AS total FROM ${table} WHERE ${where}`, params);
    return result.recordset[0]?.total || 0;
}

async function paginate(table, page = 1, limit = 10, where = '1=1', params = {}, orderBy = 'id', direction = 'DESC') {
    const offset = (page - 1) * limit;

    const countResult = await query(`SELECT COUNT(*) AS total FROM ${table} WHERE ${where}`, params);
    const total = countResult.recordset[0]?.total || 0;

    const dataResult = await query(
        `SELECT * FROM ${table} WHERE ${where} ORDER BY ${orderBy} ${direction} OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`,
        params
    );

    return {
        data: dataResult.recordset,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
    };
}

// Test connection on startup
async function testConnection() {
    try {
        await getConnection();
        return true;
    } catch (err) {
        console.warn('⚠️  Chưa thể kết nối SQL Server. Server sẽ chạy ở chế độ limited.');
        return false;
    }
}

const sqlServerExports = {
    sql,
    getConnection,
    query,
    executeProcedure,
    getById,
    getAll,
    insert,
    update,
    remove,
    count,
    paginate,
    testConnection
};

const shouldUseD1 = process.env.DATABASE_PROVIDER === 'd1' || (
    Boolean(process.env.VERCEL) &&
    Boolean(process.env.CLOUDFLARE_ACCOUNT_ID) &&
    Boolean(process.env.CLOUDFLARE_D1_DATABASE_ID) &&
    Boolean(process.env.CLOUDFLARE_D1_API_TOKEN)
);

module.exports = shouldUseD1 ? require('./d1Database') : sqlServerExports;
