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

// MOCK DATA STORE
const MOCK_DATA = {
    'OVERALL_SUMMARY': [
        { sessions: 1500, orders: 45, cvr: 3.0 } // Baseline-ish
    ]
};

/**
 * Execute a named query template.
 * @param {number} brandId 
 * @param {string} templateName 
 * @param {Array} params 
 * @param {Array} filters - Optional [{ column, value }]
 * @returns {Promise<Array>} Query results
 */
async function executeTemplate(brandId, templateName, params, filters = []) {
    // 0. Mock Mode Interception
    if (process.env.MOCK_DB_MODE === 'true') {
        console.log(`[QueryExecutor] MOCK MODE: Returning fake data for ${templateName}`);

        // Return dynamic mock data to trigger specific rules?
        // Let's alternate based on params to simulate "current" vs "baseline" drop
        // If param[0] (start date) is recent, return LOW values.

        if (templateName === 'OVERALL_SUMMARY') {
            const dateParam = new Date(params[0]);
            const now = new Date();
            // If date is > 7 days ago, assume it's current/recent window? Or check relative to "now".
            // Simpler: Use a toggle or random if date parsing is flaky.
            // But usually Baseline is "previous day". Current is "today".

            // Let's assume params[0] < today-2days is Baseline.
            const isBaseline = (now - dateParam) > (2 * 86400 * 1000);

            if (isBaseline) {
                // High Baseline
                return [{ sessions: 2000, orders: 100, cvr: 5.0, total_sales: 10000 }];
            } else {
                // Low Current (Drop!)
                // Sessions dropped 50% (1000), Orders dropped 70% (30)
                return [{ sessions: 1000, orders: 30, cvr: 3.0, total_sales: 4500 }];
            }
        }

        // Mock for New Granular Dimensions
        if (templateName === 'UTM_SOURCE_DISTRIBUTION') {
            const dateParam = new Date(params[0] || params[1]); // varies by invocation
            const now = new Date();
            const isBaseline = (now - dateParam) > (2 * 86400 * 1000);

            if (isBaseline) {
                return [
                    { source: 'Zepto', count: 800, percentage: 40 },
                    { source: 'Facebook', count: 1200, percentage: 60 }
                ];
            } else {
                // Zepto Crashed!
                return [
                    { source: 'Zepto', count: 50, percentage: 10 },
                    { source: 'Facebook', count: 1100, percentage: 90 }
                ];
            }
        }

        if (templateName === 'UTM_CAMPAIGN_DISTRIBUTION') {
            // Context likely filtered by Source=Zepto if drilling down
            // But if raw, let's just show a drop.
            const dateParam = new Date(params[0] || params[1]);
            const now = new Date();
            const isBaseline = (now - dateParam) > (2 * 86400 * 1000);
            if (isBaseline) return [{ campaign: 'Alliance', count: 800 }];
            else return [{ campaign: 'Alliance', count: 50 }]; // Drop
        }

        if (templateName === 'GEO_DISTRIBUTION') {
            return [
                { city: 'Mumbai', count: 500 },
                { city: 'Bangalore', count: 450 }
            ]; // Stable
        }

        if (templateName === 'DIMENSION_DISTRIBUTION' || templateName === 'PRODUCT_CONVERSION_CONTRIBUTION') {
            const dateParam = new Date(params[1]); // Generic template uses [dim, start, end...]
            const now = new Date();
            const isBaseline = (now - dateParam) > (2 * 86400 * 1000);

            if (isBaseline) {
                // High Baseline
                return [
                    { dimension_value: 'Direct', count: 1000, percentage: 50 },
                    { dimension_value: 'Social', count: 1000, percentage: 50 }
                ];
            } else {
                // Low Current (Drop in Direct)
                return [
                    { dimension_value: 'Direct', count: 500, percentage: 40 }, // -50%
                    { dimension_value: 'Social', count: 950, percentage: 60 }  // Flat
                ];
            }
        }

        return [];
    }

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
        console.log(`[QueryExecutor] Template "${templateName}" returned ${rows.length} rows.`);
        return rows;
    } catch (error) {
        console.error(`Error executing template "${templateName}" for brand ${brandId}:`, error);
        throw error;
    }
}

module.exports = {
    executeTemplate
};
