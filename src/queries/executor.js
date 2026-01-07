const db = require('../core/db-connector');
const templates = require('./templates');

/**
 * Execute a named query template.
 * @param {number} brandId 
 * @param {string} templateName 
 * @param {Array} params 
 * @returns {Promise<Array>} Query results
 */
const MAX_QUERIES_PER_REQUEST = parseInt(process.env.ENGINE_MAX_QUERIES || '20', 10);
const QUERY_TIMEOUT_MS = parseInt(process.env.ENGINE_QUERY_TIMEOUT_MS || '5000', 10);

// Simple in-memory counter for current request scope (simplified for this context)
//Ideally, context should be passed here, but to keep signature simple, we assume global trust or pass "context.metadata" in params if needed.
// For strict architectural purity, we'll enforce this in the engine loop or passing a context object. 
// However, seeing as `executeTemplate` takes `brandId` and `templateName`, we'll add `timeout` logic here safely.
// Budgeting is best handled in the Engine loop or by passing a budget tracker.

/**
 * Execute a named query template.
 * @param {number} brandId 
 * @param {string} templateName 
 * @param {Array} params 
 * @param {Array} filters - Optional [{ column, value }]
 * @returns {Promise<Array>} Query results
 */
async function executeTemplate(brandId, templateName, params, filters = []) {
    const sql = templates.getTemplate(templateName, filters);

    // Merge filter values into params
    // Filters are injected into WHERE clause, which usually comes AFTER date placeholders (indices 0, 1)
    // BUT our template injection puts them at the end of WHERE.
    // We need to match the placeholder order.
    // Standard template: "WHERE date >= ? AND date < ? [AND col = ?] GROUP BY..."
    // So filter values come AFTER date params.
    const filterValues = filters.map(f => f.value);
    const finalParams = [...params, ...filterValues];

    // 2. Log Operation
    console.log(`[QueryExecutor] Executing Template: ${templateName}`, JSON.stringify(finalParams));

    try {
        // Enforce Timeout
        const result = await Promise.race([
            db.executeQuery(brandId, sql, params),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`Query timeout after ${QUERY_TIMEOUT_MS}ms`)), QUERY_TIMEOUT_MS)
            )
        ]);

        const [rows] = result;
        return rows;
    } catch (error) {
        console.error(`Error executing template "${templateName}" for brand ${brandId}:`, error);
        throw error;
    }
}

module.exports = {
    executeTemplate
};
