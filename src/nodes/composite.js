/**
 * Executes the composite node.
 * Runs a sub-chain of nodes. (Simplified to just passing through for now)
 * @param {Object} node 
 * @param {Object} context 
 */
async function execute(node, context) {
    const params = node.params || {};
    // User schema uses "steps": ["node_1", "node_2"]
    const steps = node.steps || params.steps;

    let nextNode = node.next; // Default fallthrough

    if (steps && Array.isArray(steps) && steps.length > 0) {
        // In a flat graph, "executing steps" usually means jumping to the first one.
        // The last one in the chain should point back to 'next', but that's hard to enforce dynamically without graph rewriting.
        // For now, let's assume the user wired the 'next' of the steps correctly or we just jump to start.
        nextNode = steps[0];
    } else if (params.start_node_id) {
        nextNode = params.start_node_id;
    }

    return {
        status: 'success',
        next: nextNode
    };
}

module.exports = { execute };
