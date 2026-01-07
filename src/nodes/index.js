const validation = require('./validation');
const metric_compare = require('./metric-compare');
const branch = require('./branch');
const recursiveDimensionBreakdown = require('./recursive-dimension-breakdown');
const drillDown = require('./drill-down');
const composite = require('./composite');
// Terminal nodes
const insight = require('./insight');
const suppression = require('./suppression');
const confidence = require('./confidence');
const defer = require('./defer');

const NODE_REGISTRY = {
    'validation': validation,
    'metric_compare': metric_compare,
    'branch': branch,
    'recursive_dimension_breakdown': recursiveDimensionBreakdown,
    'drill_down': drillDown,
    'composite': composite,
    'insight': insight,
    'suppression': suppression,
    'confidence': confidence,
    'defer': defer
};

/**
 * Get executable for node type.
 * @param {string} type 
 */
function getNodeExecutor(type) {
    return NODE_REGISTRY[type];
}

module.exports = {
    getNodeExecutor
};
