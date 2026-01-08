/**
 * Executes the insight node.
 * Generates nuanced, confidence-aware output.
 * @param {Object} node 
 * @param {Object} context 
 */
async function execute(node, context) {
    const params = node.params || {};
    const template = node.template || params.template;
    const results = context.analysis_results || {};
    const causes = results.root_causes || [];
    const confidence = results.confidence || 0.5;

    // 1. Classification
    let classification = 'investigating';
    if (causes.length > 0 && confidence > 0.6) classification = 'actionable';
    else if (confidence < 0.4) classification = 'inconclusive';

    // 2. Summary Generation (Nuanced based on confidence)
    let summary = '';
    const topCause = causes[0];

    if (topCause) {
        // Nuanced Language Mapping
        let prefix = '';
        if (confidence > 0.8) {
            prefix = 'CVR drop driven by';
        } else if (confidence > 0.6) {
            prefix = 'CVR drop likely associated with';
        } else {
            prefix = 'CVR drop potentially related to';
        }

        if (results.mixed_factors) {
            summary = `CVR drop appears to be driven by mixed factors, primarily ${topCause.dimension} (${topCause.value}).`;
        } else {
            summary = `${prefix} ${topCause.dimension} (${topCause.value}).`;
        }
    } else {
        summary = 'CVR drop observed, but analysis of available dimensions was inconclusive.';
        classification = 'inconclusive';
    }

    // 3. Details & Evidence
    const details = causes.map(c =>
        `${utils.formatLabel(c.dimension)} '${c.value}': ${c.change}`
    );

    // 4. Limitations (Transparency)
    // Dynamic limitations based on what happened
    const limitations = [
        'Analysis limited to granularities defined in workflow'
    ];

    if (confidence < 0.6) {
        limitations.push('Low confidence signal - findings may be noise or secondary factors');
    }
    if (results.mixed_factors) {
        limitations.push('Multiple contributing factors detected - causality is complex');
    }
    // Check for schema/data limits if flagged in context
    if (context.metadata?.partial_data) {
        limitations.push('Warning: Analysis performed on partial/incomplete window');
    }

    context.final_insight = {
        status: 'success',
        classification,
        root_causes: causes,
        insight: {
            summary,
            conclusion: generateConclusion(causes, confidence, results.mixed_factors),
            details,
            limitations,
            confidence
        }
    };

    return { status: 'done' };
}

function generateConclusion(causes, confidence, mixed) {
    if (!causes || causes.length === 0) {
        return "The analysis did not identify a statistically significant primary cause for the observed drop. This suggests the issue may be systemic, or related to a dimension not covered in the current workflow (e.g. Traffic Source, Site Speed).";
    }

    const top = causes[0];
    const dimLabel = utils.formatLabel(top.dimension);
    let narrative = "";

    // Primary Driver Narrative
    if (top.dimension === 'payment_gateway') {
        narrative = `The drop is primarily caused by a failure in the ${top.value} payment gateway.`;
    } else if (top.dimension === 'discount_code') {
        narrative = `The drop is heavily influenced by a collapse in the usage of the '${top.value}' discount code.`;
    } else if (top.dimension === 'product_id' || top.dimension === 'product') {
        narrative = `A distinct decline in sales for specific products (notably ${top.value}) is the main driver.`;
    } else {
        narrative = `The analysis identified ${dimLabel} ('${top.value}') as the primary contributing factor.`;
    }

    // Impact Context
    narrative += ` This factor experienced a massive ${top.change.split('(')[0].trim().replace('Volume', 'volume')} impact which correlates strongly with the overall metric drop.`;

    // Secondary Factors
    if (causes.length > 1) {
        const second = causes[1];
        if (second.impact_score > 50) {
            narrative += ` Additionally, significant declines were observed in ${utils.formatLabel(second.dimension)} (${second.value}), suggesting a potential compounding issue.`;
        }
    }

    return narrative;
}

const utils = {
    formatLabel: (s) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

module.exports = { execute };
