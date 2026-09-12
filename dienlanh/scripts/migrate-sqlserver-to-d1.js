require('dotenv').config({ override: true });

const { getConnection } = require('../config/database');

const applyChanges = process.argv.includes('--apply');
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
const apiToken = process.env.CLOUDFLARE_D1_API_TOKEN;

function requireD1Configuration() {
    const missing = [
        ['CLOUDFLARE_ACCOUNT_ID', accountId],
        ['CLOUDFLARE_D1_DATABASE_ID', databaseId],
        ['CLOUDFLARE_D1_API_TOKEN', apiToken]
    ].filter(([, value]) => !value).map(([key]) => key);
    if (missing.length) throw new Error(`Thiếu biến môi trường: ${missing.join(', ')}`);
}

function quoteIdentifier(value) {
    return `"${String(value).replace(/"/g, '""')}"`;
}

function sqliteType(sqlType) {
    const type = String(sqlType).toLowerCase();
    if (['tinyint', 'smallint', 'int', 'bigint', 'bit'].includes(type)) return 'INTEGER';
    if (['decimal', 'numeric', 'money', 'smallmoney', 'float', 'real'].includes(type)) return 'REAL';
    if (['binary', 'varbinary', 'image', 'timestamp', 'rowversion'].includes(type)) return 'BLOB';
    return 'TEXT';
}

function sqliteDefault(value) {
    if (!value) return '';
    let normalized = String(value).trim();
    while (normalized.startsWith('(') && normalized.endsWith(')')) normalized = normalized.slice(1, -1).trim();
    normalized = normalized
        .replace(/^N'/, "'")
        .replace(/GETDATE\(\)|SYSDATETIME\(\)|SYSUTCDATETIME\(\)/gi, 'CURRENT_TIMESTAMP')
        .replace(/NEWID\(\)/gi, "lower(hex(randomblob(16)))");
    if (/^(NULL|CURRENT_TIMESTAMP|-?\d+(?:\.\d+)?|'(?:[^']|'')*'|lower\(hex\(randomblob\(16\)\)\))$/i.test(normalized)) {
        return ` DEFAULT ${normalized}`;
    }
    return '';
}

function normalizeValue(value) {
    if (value instanceof Date) return value.toISOString();
    if (Buffer.isBuffer(value)) return value.toString('base64');
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'boolean') return value ? 1 : 0;
    return value;
}

async function d1Query(sql, params = []) {
    const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
        {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ sql, params })
        }
    );
    const payload = await response.json();
    if (!response.ok || !payload.success || payload.result?.some(item => item.success === false)) {
        throw new Error(payload.errors?.[0]?.message || payload.result?.find(item => item.error)?.error || `D1 HTTP ${response.status}`);
    }
    return payload.result?.[0] || { results: [] };
}

async function loadMetadata(connection) {
    const columns = (await connection.request().query(`
        USE DienLanhNguyenHung;
        SELECT t.name table_name, c.column_id, c.name column_name, ty.name data_type,
               c.is_nullable, c.is_identity, dc.definition default_definition
        FROM sys.tables t
        JOIN sys.schemas s ON s.schema_id=t.schema_id
        JOIN sys.columns c ON c.object_id=t.object_id
        JOIN sys.types ty ON ty.user_type_id=c.user_type_id
        LEFT JOIN sys.default_constraints dc ON dc.parent_object_id=c.object_id AND dc.parent_column_id=c.column_id
        WHERE s.name='dbo'
        ORDER BY t.name,c.column_id;
    `)).recordset;
    const primaryKeys = (await connection.request().query(`
        USE DienLanhNguyenHung;
        SELECT t.name table_name,c.name column_name,ic.key_ordinal
        FROM sys.key_constraints kc
        JOIN sys.tables t ON t.object_id=kc.parent_object_id
        JOIN sys.index_columns ic ON ic.object_id=t.object_id AND ic.index_id=kc.unique_index_id
        JOIN sys.columns c ON c.object_id=t.object_id AND c.column_id=ic.column_id
        WHERE kc.type='PK'
        ORDER BY t.name,ic.key_ordinal;
    `)).recordset;
    const foreignKeys = (await connection.request().query(`
        USE DienLanhNguyenHung;
        SELECT pt.name table_name,pc.name column_name,rt.name referenced_table,rc.name referenced_column,
               fk.delete_referential_action_desc delete_action
        FROM sys.foreign_key_columns fkc
        JOIN sys.foreign_keys fk ON fk.object_id=fkc.constraint_object_id
        JOIN sys.tables pt ON pt.object_id=fkc.parent_object_id
        JOIN sys.columns pc ON pc.object_id=pt.object_id AND pc.column_id=fkc.parent_column_id
        JOIN sys.tables rt ON rt.object_id=fkc.referenced_object_id
        JOIN sys.columns rc ON rc.object_id=rt.object_id AND rc.column_id=fkc.referenced_column_id;
    `)).recordset;
    const indexes = (await connection.request().query(`
        USE DienLanhNguyenHung;
        SELECT t.name table_name,i.name index_name,i.is_unique,c.name column_name,ic.key_ordinal
        FROM sys.indexes i
        JOIN sys.tables t ON t.object_id=i.object_id
        JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.key_ordinal>0
        JOIN sys.columns c ON c.object_id=t.object_id AND c.column_id=ic.column_id
        WHERE i.is_primary_key=0 AND i.is_hypothetical=0 AND i.name IS NOT NULL
        ORDER BY t.name,i.name,ic.key_ordinal;
    `)).recordset;
    return { columns, primaryKeys, foreignKeys, indexes };
}

function groupBy(items, key) {
    return items.reduce((groups, item) => {
        const value = item[key];
        (groups[value] ||= []).push(item);
        return groups;
    }, {});
}

function buildSchema(metadata) {
    const columnsByTable = groupBy(metadata.columns, 'table_name');
    const primaryByTable = groupBy(metadata.primaryKeys, 'table_name');
    const foreignByTable = groupBy(metadata.foreignKeys, 'table_name');
    const statements = [];
    for (const [table, columns] of Object.entries(columnsByTable)) {
        const primary = primaryByTable[table] || [];
        const definitions = columns.map(column => {
            const isSingleIntegerPrimary = primary.length === 1 && primary[0].column_name === column.column_name && sqliteType(column.data_type) === 'INTEGER';
            if (isSingleIntegerPrimary) {
                return `${quoteIdentifier(column.column_name)} INTEGER PRIMARY KEY${column.is_identity ? ' AUTOINCREMENT' : ''}`;
            }
            return `${quoteIdentifier(column.column_name)} ${sqliteType(column.data_type)}${column.is_nullable ? '' : ' NOT NULL'}${sqliteDefault(column.default_definition)}`;
        });
        if (primary.length > 1) definitions.push(`PRIMARY KEY (${primary.map(item => quoteIdentifier(item.column_name)).join(', ')})`);
        for (const fk of foreignByTable[table] || []) {
            const action = ['CASCADE', 'SET_NULL', 'SET_DEFAULT'].includes(fk.delete_action) ? fk.delete_action.replace('_', ' ') : 'NO ACTION';
            definitions.push(`FOREIGN KEY (${quoteIdentifier(fk.column_name)}) REFERENCES ${quoteIdentifier(fk.referenced_table)} (${quoteIdentifier(fk.referenced_column)}) ON DELETE ${action}`);
        }
        statements.push({ table, sql: `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(table)} (\n  ${definitions.join(',\n  ')}\n)` });
    }
    const indexesByName = groupBy(metadata.indexes, 'index_name');
    const indexStatements = Object.values(indexesByName).map(items => {
        const first = items[0];
        return `CREATE ${first.is_unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS ${quoteIdentifier(first.index_name)} ON ${quoteIdentifier(first.table_name)} (${items.map(item => quoteIdentifier(item.column_name)).join(', ')})`;
    });
    return { tables: Object.keys(columnsByTable), columnsByTable, statements, indexStatements };
}

function dependencyOrder(tables, foreignKeys) {
    const remaining = new Set(tables);
    const completed = new Set();
    const ordered = [];
    while (remaining.size) {
        const ready = [...remaining].filter(table => foreignKeys.filter(fk => fk.table_name === table).every(fk => fk.referenced_table === table || completed.has(fk.referenced_table) || !remaining.has(fk.referenced_table)));
        const selected = ready.length ? ready : [[...remaining][0]];
        for (const table of selected) {
            ordered.push(table);
            completed.add(table);
            remaining.delete(table);
        }
    }
    return ordered;
}

async function migrateRows(connection, schema, metadata) {
    let total = 0;
    for (const table of dependencyOrder(schema.tables, metadata.foreignKeys)) {
        const rows = (await connection.request().query(`SELECT * FROM dbo.${quoteIdentifier(table)}`)).recordset;
        if (!rows.length) {
            console.log(`DATA ${table}: 0`);
            continue;
        }
        const columns = schema.columnsByTable[table].map(item => item.column_name);
        // D1 limits the number of bound SQL variables in one statement.
        // Size each batch from the table width and keep some headroom.
        const batchSize = Math.max(1, Math.min(25, Math.floor(90 / columns.length)));
        for (let offset = 0; offset < rows.length; offset += batchSize) {
            const batch = rows.slice(offset, offset + batchSize);
            const placeholders = batch.map(() => `(${columns.map(() => '?').join(',')})`).join(',');
            const params = batch.flatMap(row => columns.map(column => normalizeValue(row[column])));
            await d1Query(`INSERT OR REPLACE INTO ${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(',')}) VALUES ${placeholders}`, params);
        }
        total += rows.length;
        console.log(`DATA ${table}: ${rows.length}`);
    }
    return total;
}

async function main() {
    requireD1Configuration();
    const connection = await getConnection();
    const metadata = await loadMetadata(connection);
    const schema = buildSchema(metadata);
    console.log(`PLAN TABLES=${schema.tables.length} MODE=${applyChanges ? 'APPLY' : 'DRY_RUN'}`);
    if (!applyChanges) return;

    for (const statement of schema.statements) {
        await d1Query(statement.sql);
        console.log(`SCHEMA ${statement.table}`);
    }
    const migratedRows = await migrateRows(connection, schema, metadata);
    for (const statement of schema.indexStatements) await d1Query(statement);

    const remoteTables = await d1Query("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    console.log(`DONE TABLES=${remoteTables.results.length} ROWS=${migratedRows}`);
}

main().catch(error => {
    console.error(`MIGRATION_FAILED=${error.message}`);
    process.exitCode = 1;
});
