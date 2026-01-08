const analysisLib = require('../core/analysis-lib');
const utils = require('../core/utils');
const Logger = require('../core/logger');

const logger = Logger.create('Node:Breakdown');

async function execute(node, context) {
    const params = node.params || {};
    const dimensions = node.dimensions || params.dimensions;
    const { brand_id } = context.brand;

    // --- Phase 1: Context Setup ---
    const alertTime = context.alert.current_window || context.alert.timestamp || new Date().toISOString();
    const [cStart, cEnd] = utils.parseWindow(alertTime);
    const baselineWindow = context.alert.baseline_window || 'avg_prev_3_days_same_hour';
    const [bStart, bEnd] = utils.parseWindow(baselineWindow, cStart);

    const timeContext = { cStart, cEnd, bStart, bEnd };
    let allRootCauses = [];

    // --- Phase 2: Dimension Loop (Using Shared Lib) ---
    for (const dim of dimensions) {
        // No filters for initial breakdown
        const findings = await analysisLib.analyzeDimension(brand_id, dim, timeContext, []);
        allRootCauses.push(...findings);
    }

    // --- Phase 3: Analytical Safeguards & Stopping ---
    allRootCauses.sort((a, b) => b.impact_score - a.impact_score);

    // Safeguard 1: Dominance Check
    const totalDropPct = Math.abs(context.derived?.orders_delta_pct || 100);
    const validCauses = allRootCauses.filter(c => {
        const relativeImpact = (c.impact_score / totalDropPct) * 100;
        return relativeImpact > 20 || c.impact_score > 40;
    });

    if (validCauses.length === 0) {
        logger.info('  No Dominant Root Causes found (all signals too weak).');
    } else {
        const top = validCauses[0];
        const isDominant = top.impact_score > 60 || (validCauses.length === 1 && top.impact_score > 40);

        if (!isDominant && validCauses.length > 1) {
            logger.info('  Mixed Factors detected (No single dominant cause).');
            context.analysis_results.mixed_factors = true;
        } else {
            logger.info(`  Dominant cause confirmed: ${top.value} (Impact: ${top.impact_score.toFixed(1)})`);
        }
    }

    context.analysis_results.root_causes = validCauses;

    return { status: 'success', next: node.next };
}

module.exports = { execute };
