/**
 * Executes the insight node.
 * Generates nuanced, confidence-aware output.
 * @param {Object} node 
 * @param {Object} context 
 */
async function execute(node, context) {
    const { template } = node.params;
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
            details,
            limitations,
            confidence
        }
    };

    return { status: 'done' };
}

const utils = {
    formatLabel: (s) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

module.exports = { execute };
