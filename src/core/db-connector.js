const mysql = require('mysql2/promise');
require('dotenv').config();

const pools = new Map();

/**
 * Get or create a connection pool for a specific brand.
 * @param {number} brandId 
 * @returns {Promise<mysql.Pool>}
 */
async function getPool(brandId) {
    if (pools.has(brandId)) {
        return pools.get(brandId);
    }

    const host = process.env.DB_HOST;
    const user = process.env.DB_USER;
    const password = process.env.DB_PASSWORD;
    const dbName = process.env[`DB_NAME_${brandId}`];
    const sslCa = process.env.DB_SSL_CA_PATH;

    if (!host || !user || !password || !dbName) {
        throw new Error(`Missing database credentials for brand ${brandId}`);
    }

    console.log(`[DB-Connector] Connecting to Brand ${brandId} -> DB: ${dbName} @ ${host}`);

    const pool = mysql.createPool({
        host,
        user,
        password,
        database: dbName,
        ssl: { rejectUnauthorized: false },
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        timezone: '+00:00' // Force UTC
    });

    pools.set(brandId, pool);
    return pool;
}

/**
 * Execute a query with parameters against a specific brand's database.
 * @param {number} brandId 
 * @param {string} sql 
 * @param {Array} params 
 * @returns {Promise<[Array, Array]>}
 */
async function executeQuery(brandId, sql, params = []) {
    const pool = await getPool(brandId);
    return await pool.execute(sql, params);
}

module.exports = {
    executeQuery,
    getPool
};
