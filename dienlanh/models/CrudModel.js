const { query } = require('../config/database');

function id(value) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error('Invalid database identifier');
    return value;
}

class CrudModel {
    constructor(table) { this.table = id(table); }
    async all(where = '1=1', params = {}, orderBy = 'id DESC') { return (await query(`SELECT * FROM ${this.table} WHERE ${where} ORDER BY ${orderBy}`, params)).recordset; }
    async find(itemId) { return (await query(`SELECT * FROM ${this.table} WHERE id = @id`, { id: itemId })).recordset[0] || null; }
    async create(data) {
        const keys = Object.keys(data).filter(key => data[key] !== undefined); keys.forEach(id);
        if (!keys.length) throw new Error('No data supplied');
        const result = await query(`INSERT INTO ${this.table} (${keys.join(', ')}) OUTPUT INSERTED.id VALUES (${keys.map(key => `@${key}`).join(', ')})`, data);
        return result.recordset[0].id;
    }
}
module.exports = CrudModel;
