const executor = require('../queries/executor');
const utils = require('../core/utils');

/**
 * Executes the metric_compare node.
 * Fetches Full Funnel Data (Sessions, Orders, CVR).
 * Populates context.derived with a unified funnel view.
 * @param {Object} node 
 * @param {Object} context 
 */
async function execute(node, context) {
    const { brand_id } = context.brand;
    // Flat schema support
    const params = node.params || {};
    const inputMetrics = node.metrics || params.metrics; // "metrics": ["orders", "sessions"]

    // We will compute: Sessions, Orders, CVR.
    // Use inputMetrics if provided, else default to full funnel
    const targetMetrics = inputMetrics || ['sessions', 'orders', 'cvr'];

    // 1. Time Windows
    const alertTime = context.alert.current_window || context.alert.timestamp || new Date().toISOString();
    const [currentStart, currentEnd] = utils.parseWindow(alertTime);

    const baselineWindow = context.alert.baseline_window || 'avg_prev_3_days_same_hour';
    const [baselineStart, baselineEnd] = utils.parseWindow(baselineWindow, currentStart);

    console.log(`[MetricCompare] Full Funnel Analysis`);

    // 2. Execute Queries (OVERALL_SUMMARY is sufficient for high level)
    const currentData = await executor.executeTemplate(brand_id, 'OVERALL_SUMMARY', [currentStart, currentEnd]);
    const baselineData = await executor.executeTemplate(brand_id, 'OVERALL_SUMMARY', [baselineStart, baselineEnd]);

    const cur = currentData[0] || {};
    const base = baselineData[0] || {};

    // 3. Compute Funnel Context
    const metrics = ['sessions', 'orders', 'cvr'];
    // Note: 'cvr' is pre-calculated in template as (orders/sessions)*100

    context.derived = context.derived || {};
    context.derived.funnel = {};

    metrics.forEach(m => {
        const cVal = Number(cur[m]) || 0;
        const bVal = Number(base[m]) || 0;
        const pctChange = bVal === 0 ? 0 : ((cVal - bVal) / bVal) * 100;

        context.derived.funnel[m] = {
            current: cVal,
            baseline: bVal,
            pct_change: pctChange
        };

        // Flatten for easy branch access (optional, but helps "sessions_delta_pct" style)
        context.derived[`${m}_delta_pct`] = pctChange;
    });

    // Special Check: ATC Analysis?
    // If schema supported 'total_atc_sessions', we would add it here.
    // Assuming standard schema has it or we skip.
    // For now, implicit support if it's in the query result.

    return {
        status: 'success',
        next: node.next
    };
}

module.exports = { execute };
