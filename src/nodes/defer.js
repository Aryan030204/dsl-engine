/**
 * Executes the defer node.
 * Terminates workflow with deferred status.
 * @param {Object} node 
 * @param {Object} context 
 */
async function execute(node, context) {
    const { reason } = node.params;

    context.final_insight = {
        status: 'deferred',
        reason: reason || 'insufficient_data'
    };

    return {
        status: 'done'
    };
}

module.exports = { execute };
