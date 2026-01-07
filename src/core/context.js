/**
 * Creates the initial execution context for a workflow run.
 * @param {Object} alert - The incoming alert object.
 * @param {Object} brand - Brand details.
 * @param {Object} workflow - The DSL workflow definition.
 * @returns {Object} The initialized execution context.
 */
function createExecutionContext(alert, brand, workflow) {
    return {
        alert: { ...alert },
        brand: { ...brand },
        current: {},
        baseline: {},
        derived: {},
        intermediate: {},
        analysis_results: {},
        final_insight: null,
        metadata: {
            workflow_id: workflow.id,
            workflow_version: workflow.version,
            executed_at: new Date().toISOString(),
            trace_id: crypto.randomUUID()
        }
    };
}

module.exports = {
    createExecutionContext
};

const crypto = require('crypto');
