const Context = require('./context');
const Validator = require('./validator');
const NodeRegistry = require('../nodes/index');

/**
 * Main Engine Entry Point.
 * Executes a DSL workflow for a given alert.
 * 
 * @param {Object} input - { alert, brand, workflow }
 * @returns {Promise<Object>} Final structured output
 */
async function executeWorkflow({ alert, brand, workflow }) {
    // 1. Validate Workflow
    const validationErrors = Validator.validateWorkflow(workflow);
    if (validationErrors.length > 0) {
        return {
            status: 'error',
            type: 'workflow_validation_error',
            message: validationErrors.join('; ')
        };
    }

    // 2. Build Context
    const context = Context.createExecutionContext(alert, brand, workflow);

    // 3. Execution Loop
    // Find initial node (convention: type 'validation' or explicit 'start' flag, here assuming first 'validation' node)
    let currentNodeId = workflow.nodes.find(n => n.type === 'validation').id;
    let steps = 0;
    const MAX_STEPS = 50; // Safety brake

    try {
        while (currentNodeId && steps < MAX_STEPS) {
            const node = workflow.nodes.find(n => n.id === currentNodeId);
            if (!node) {
                throw new Error(`Node ${currentNodeId} not found in workflow`);
            }

            const executor = NodeRegistry.getNodeExecutor(node.type);
            if (!executor) {
                throw new Error(`No executor for node type ${node.type}`);
            }

            console.log(`[Engine] Executing node ${node.id} (${node.type})`);
            const result = await executor.execute(node, context);

            if (result.status === 'done') {
                break;
            } else if (result.status === 'success') {
                currentNodeId = result.next;
            } else if (result.status === 'suppressed' || result.status === 'deferred') {
                // Nodes like validation might return early status
                return {
                    status: result.status,
                    reason: result.reason
                };
            } else {
                // Unknown status
                throw new Error(`Unknown result status from node ${node.id}: ${result.status}`);
            }

            steps++;
        }

        if (steps >= MAX_STEPS) {
            throw new Error('Workflow execution exceeded max steps');
        }

        // 4. Return Final Output
        if (context.final_insight) {
            const output = {
                ...context.final_insight,
                brand_id: context.brand.brand_id,
                metric: context.alert.metric,
                metadata: context.metadata
            };
            return output;
        } else {
            // Fallback if no final insight generated
            return {
                status: 'error',
                type: 'execution_error',
                message: 'Workflow finished without generating insight'
            };
        }

    } catch (error) {
        console.error('[Engine] Execution failed:', error);
        return {
            status: 'error',
            type: 'execution_exception',
            message: error.message
        };
    }
}

module.exports = {
    executeWorkflow
};
