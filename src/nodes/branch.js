const Logger = require('../core/logger');
const logger = Logger.create('Node:Branch');

/**
 * Executes the branch node.
 * Routes based on complex conditions (AND/OR logic).
 * @param {Object} node 
 * @param {Object} context 
 */
async function execute(node, context) {
    const { rules, default_next } = node.params;
    // rules structure: [ { if: "condition_string", next: "node_id" }, ... ]
    // or legacy: { conditions: [...] }

    // Support legacy structure for backward compat if needed, but per prompt we harden it.
    // Let's support a robust "rules" array where "if" is a string expression or object.

    // Simplification: We will parse a string like "sessions_delta_pct > 15 AND orders_delta_pct >= -5"
    // For safety and determinism (no eval), we implement a simple parser for this specific grammar.

    // If params.conditions exists (legacy), use that. Else use params.rules.
    const ruleList = node.params.rules || (node.params.conditions ? node.params.conditions.map(c => ({
        if: c, // passing raw condition object to evaluator if it handles it
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

    return {
        status: 'success',
        next: default_next
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
    // Shortcuts for common context paths
    if (field === 'sessions_delta_pct') return 'derived.sessions.pct_change'; // Alias mapping if needed
    // Or assume defined in 'derived' if not fully qualified
    if (!field.includes('.')) {
        // Try looking in derived first
        return `derived.${field}`; // or `derived.${field}.pct_change`?
        // Let's stick to full paths or mapped derived values.
        // The prompt example used "sessions_delta_pct". 
        // We will enable metric_compare to put these flat in derived or we flatten them here.
        // For now, let's assume getByPath handles standard context paths: "derived.metrics.sessions.pct_change"
    }
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
