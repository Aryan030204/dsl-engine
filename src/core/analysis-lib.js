const executor = require('../queries/executor');
const Logger = require('./logger');

const logger = Logger.create('Lib:Analysis');

const TEMPLATE_MAP = {
    'payment_gateway': 'PAYMENT_GATEWAY_DISTRIBUTION',
    'payment_failure_rate': 'PAYMENT_GATEWAY_PENDING_RATE',
    'discount_usage': 'DISCOUNT_USAGE_DISTRIBUTION',
    'discount_code': 'DISCOUNT_CODE_BREAKDOWN',
    'product': 'PRODUCT_CONVERSION_CONTRIBUTION',
    'product_id': 'PRODUCT_CONVERSION_CONTRIBUTION', // Added mapping
    'price_bucket': 'PRODUCT_PRICE_BUCKET_DISTRIBUTION',
    'aov_bucket': 'AOV_DISTRIBUTION',
    'customer_type': 'NEW_VS_RETURNING_CUSTOMERS',
    'time_clustering': 'ORDER_FAILURE_TIME_CLUSTER',
    // New Dimensions
    'city': 'GEO_DISTRIBUTION',
    'utm_source': 'UTM_SOURCE_DISTRIBUTION',
    'utm_campaign': 'UTM_CAMPAIGN_DISTRIBUTION'
};

/**
 * Analyzes a single dimension between two time periods.
 * @param {number} brandId 
 * @param {string} dimension 
 * @param {Object} timeContext { cStart, cEnd, bStart, bEnd }
 * @param {Array} filters [{ column, value }]
 */
async function analyzeDimension(brandId, dimension, timeContext, filters = []) {
    logger.info(`Analyzing Dimension: ${dimension}`, { filters });

    const { cStart, cEnd, bStart, bEnd } = timeContext;

    // 1. Template Resolution
    const template = TEMPLATE_MAP[dimension] || 'DIMENSION_DISTRIBUTION';
    const isGeneric = !TEMPLATE_MAP[dimension];

    let cParams = [cStart, cEnd], bParams = [bStart, bEnd];
    if (isGeneric) {
        cParams = [dimension, cStart, cEnd, cStart, cEnd];
        bParams = [dimension, bStart, bEnd, bStart, bEnd];
    }

    try {
        // 2. Fetch Data
        const [cRaw, bRaw] = await Promise.all([
            executor.executeTemplate(brandId, template, cParams, filters),
            executor.executeTemplate(brandId, template, bParams, filters)
        ]);

        // 3. Normalize
        const cNorm = normalizeRows(cRaw);
        const bNorm = normalizeRows(bRaw);
        const bMap = new Map(bNorm.map(r => [r.value, r]));

        const findings = [];

        // 4. Compare & Impact
        for (const cRow of cNorm) {
            const bRow = bMap.get(cRow.value);
            if (!bRow) continue;

            const result = analyzeSegment(dimension, cRow, bRow);
            if (result) {
                findings.push(result);
            }
        }

        // Sort by impact
        findings.sort((a, b) => b.impact_score - a.impact_score);
        return findings;

    } catch (e) {
        logger.error(`Error analyzing dimension ${dimension}`, e);
        return [];
    }
}

// --- Helpers (Extracted from old breakdown node) ---

function normalizeRows(rows) {
    return rows.map(r => {
        const key = Object.keys(r).find(k => k !== 'count' && k !== 'order_count' && k !== 'percentage' && k !== 'pending_rate') || 'unknown';
        return {
            value: r[key],
            count: Number(r.count || r.order_count || 0),
            rate: r.pending_rate !== undefined ? Number(r.pending_rate) : undefined
        };
    });
}

function analyzeSegment(dim, cRow, bRow) {
    let impact = 0;
    let description = '';

    // A. Rate Logic
    if (cRow.rate !== undefined && bRow.rate !== undefined) {
        const diff = cRow.rate - bRow.rate;
        if (diff > 5) {
            impact = diff;
            description = `Rate increased from ${bRow.rate.toFixed(1)}% to ${cRow.rate.toFixed(1)}%`;
            return { dimension: dim, value: cRow.value, change: description, impact_score: impact };
        }
    }

    // B. Volume Logic
    if (bRow.count > 10) {
        const volDiff = cRow.count - bRow.count;
        const pctChange = (volDiff / bRow.count) * 100;
        if (pctChange < -15) {
            impact = Math.abs(pctChange);
            description = `Volume dropped ${pctChange.toFixed(1)}% (${bRow.count} -> ${cRow.count})`;
            return { dimension: dim, value: cRow.value, change: description, impact_score: impact };
        }
    }

    return null;
}

module.exports = { analyzeDimension };
