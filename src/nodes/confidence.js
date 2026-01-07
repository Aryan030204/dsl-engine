/**
 * Executes the confidence node.
 * Calculates evidence-based confidence score.
 * @param {Object} node 
 * @param {Object} context 
 */
async function execute(node, context) {
    let score = 0.5; // Base confidence

    const results = context.analysis_results || {};
    const causes = results.root_causes || [];

    // 1. Evidence of Root Cause
    if (causes.length > 0) {
        const topCause = causes[0];

        // Strong Signal: Top cause has high impact
        if (topCause.impact_score > 50) {
            score += 0.3;
        } else if (topCause.impact_score > 20) {
            score += 0.15;
        }

        // Clarity Signal: Single dominant cause vs messy mix
        if (causes.length === 1) {
            score += 0.1;
        } else {
            // If top cause is much bigger than second cause
            if (causes[1] && topCause.impact_score > (causes[1].impact_score * 2)) {
                score += 0.1;
            }
        }
    } else {
        // No specific root cause found
        score -= 0.2;
    }

    // 2. Data Sufficiency (Mock heuristic)
    // In real engine, check if queries returned ample rows
    // e.g. if total orders < 10, confidence implies low
    const orders = context.derived?.funnel?.orders?.current || 0;
    if (orders < 50) {
        score -= 0.1; // Low volume penalty
    }

    // Cap at 0-1
    score = Math.min(Math.max(score, 0.1), 0.99);

    context.analysis_results.confidence = Number(score.toFixed(2));

    return {
        status: 'success',
        next: node.next
    };
}

module.exports = { execute };
