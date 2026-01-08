const Logger = require('../core/logger');
const logger = Logger.create('Node:Branch');

/**
 * Executes the branch node.
 * Routes based on complex conditions (AND/OR logic).
 * @param {Object} node 
 * @param {Object} context 
 */
async function execute(node, context) {
    const params = node.params || {};
    const rules = node.rules || params.rules;
    const default_next = node.default_next || params.default_next;

    // rules structure: [ { if: "condition_string", next: "node_id" }, ... ]

    // Compatibility with legacy "conditions"
    const ruleList = rules || (params.conditions ? params.conditions.map(c => ({
        if: c,
        next: c.next
    })) : []);

    for (const rule of ruleList) {
        let matched = false;

        if (typeof rule.if === 'string') {
            matched = evaluateExpression(rule.if, context);
        } else if (typeof rule.if === 'object') {
            // Legacy object support ({ field, op, value })
            matched = evaluateCondition(rule.if, context);
        }

        if (matched) {
            return {
                status: 'success',
                next: rule.next
            };
        }
    }

    // Default Path
    if (default_next) {
        // If default is an object with action: terminate
        if (typeof default_next === 'object' && default_next.action === 'terminate') {
            return {
                status: 'terminate',
                reason: default_next.reason
            };
        }

        return {
            status: 'success',
            next: default_next
        };
    }

    return {
        status: 'terminate',
        reason: 'No matching rule and no default path'
    };
}

/**
 * Evaluates a string expression like "A > 10 AND B < 5"
 */
function evaluateExpression(expr, context) {
    // 1. Split by AND / OR
    // Simple implementation: Support AND only or OR only for now, or simple split.
    // Prompt asks for "Compound conditions (AND, OR)".

    if (expr.includes(' OR ')) {
        const parts = expr.split(' OR ');
        return parts.some(part => evaluateExpression(part.trim(), context));
    }

    if (expr.includes(' AND ')) {
        const parts = expr.split(' AND ');
        return parts.every(part => evaluateExpression(part.trim(), context));
    }

    // Leaf condition: "field op value"
    // e.g. "sessions_delta_pct > 15"
    const match = expr.match(/^([\w\._]+)\s*(>=|<=|>|<|==|!=)\s*([-\w\.]+)$/);
    if (!match) {
        console.warn(`[Branch] Invalid expression format: ${expr}`);
        return false;
    }

    const [_, field, op, value] = match;

    const contextVal = getByPath(context, resolveAlias(field));
    const targetVal = isNaN(Number(value)) ? getByPath(context, resolveAlias(value)) : Number(value);

    return compare(contextVal, op, targetVal);
}

function resolveAlias(field) {
    // Shortcuts for common context paths can go here
    // But since metric_compare produces flat keys, we can just return the field.
    // If we wanted to map "cvr" to "alert.metric", we could do it here.
    return field;
}

function evaluateCondition(cond, context) {
    const val = getByPath(context, cond.field);
    return compare(val, cond.op, cond.value);
}

function compare(a, op, b) {
    if (a === undefined || b === undefined) return false;
    switch (op) {
        case '>': return a > b;
        case '>=': return a >= b;
        case '<': return a < b;
        case '<=': return a <= b;
        case '==': return a == b;
        case '!=': return a != b;
        default: return false;
    }
}

function getByPath(obj, path) {
    // Support flat access "sessions_delta_pct" if it exists in derived directly
    if (obj.derived && obj.derived[path] !== undefined) return obj.derived[path];

    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

module.exports = { execute };
