const analysisLib = require('../core/analysis-lib');
const utils = require('../core/utils');
const Logger = require('../core/logger');

const logger = Logger.create('Node:DrillDown');

async function execute(node, context) {
    const { dimension } = node.params; // Target dimension to drill INTO
    const { brand_id } = context.brand;

    // 1. Identification: What do we drill into?
    const rootCauses = context.analysis_results.root_causes || [];
    if (rootCauses.length === 0) {
        logger.info('No root causes found. Skipping drill-down.');
        return { status: 'success', next: node.next };
    }

    // We drill down into the Top Cause
    const topCause = rootCauses[0];

    // Heuristic: Only drill down if it's significant
    if (topCause.impact_score < 40) {
        logger.info(`Top cause impact too low (${topCause.impact_score}) for drill-down.`);
        return { status: 'success', next: node.next };
    }

    // 2. Filter Construction
    // Map dimension to column name 
    const colMap = {
        'payment_gateway': 'payment_gateway_names',
        'product': '_ITEM1_name',
        'discount_code': 'discount_codes'
    };
    const filterCol = colMap[topCause.dimension] || topCause.dimension;

    const filters = [{ column: filterCol, value: topCause.value }];
    logger.info(`Drilling down: Analyzing '${dimension}' where ${filterCol}='${topCause.value}'`);

    // 3. Analysis
    const alertTime = context.alert.current_window || context.alert.timestamp || new Date().toISOString();
    const [cStart, cEnd] = utils.parseWindow(alertTime);
    const baselineWindow = context.alert.baseline_window || 'avg_prev_3_days_same_hour';
    const [bStart, bEnd] = utils.parseWindow(baselineWindow, cStart);
    const timeContext = { cStart, cEnd, bStart, bEnd };

    const findings = await analysisLib.analyzeDimension(brand_id, dimension, timeContext, filters);

    // 4. Result Merging
    if (findings.length > 0) {
        const drilledCause = findings[0]; // Top factor in drill-down
        // We append it to root causes, but maybe mark it as a child?
        // For flat structure compatibility, we just push it, but Insight Node needs to know the path.

        context.analysis_results.root_causes.push(drilledCause);
        context.analysis_results.drill_down_path = [`${topCause.dimension}=${topCause.value}`];

        logger.info(`  >> Drill-down found specific factor: ${drilledCause.value} (Impact: ${drilledCause.impact_score.toFixed(1)})`);
    } else {
        logger.info('  >> Drill-down yielded no specific sub-factors.');
    }

    return { status: 'success', next: node.next };
}

module.exports = { execute };
