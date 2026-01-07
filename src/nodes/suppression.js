/**
 * Executes the suppression node.
 * Terminates workflow with suppression status.
 * @param {Object} node 
 * @param {Object} context 
 */
async function execute(node, context) {
    const { reason } = node.params;

    context.final_insight = {
        status: 'suppressed',
        reason: reason || 'unknown'
    };

    return {
        status: 'done'
    };
}

module.exports = { execute };
