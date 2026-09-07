// Backwards-compatible database entry point.
// Keep connection logic in config/database.js so routes and scripts share one pool.
module.exports = require('./config/database');
