/**
 * Executes the composite node.
 * Runs a sub-chain of nodes. (Simplified to just passing through for now)
 * @param {Object} node 
 * @param {Object} context 
 */
async function execute(node, context) {
    // In full implementation, this might spawn a mini-engine loop
    // For now, we assume it's a structural grouper that just points to 'start' of sub-flow
    // But since our engine loop uses 'next', a composite node in this flat structure
    // might just be a no-op that points to the first child.

    return {
        status: 'success',
        next: node.params.start_node_id
    };
}

module.exports = { execute };
