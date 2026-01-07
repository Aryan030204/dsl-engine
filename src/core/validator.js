/**
 * Validates the structure of a DSL workflow.
 * @param {Object} workflow 
 * @returns {Array<string>} List of validation errors, empty if valid.
 */
function validateWorkflow(workflow) {
    const errors = [];

    if (!workflow.id) errors.push('Workflow missing "id"');
    if (!workflow.version) errors.push('Workflow missing "version"');
    if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
        errors.push('Workflow missing "nodes" array');
        return errors;
    }

    if (workflow.nodes.length === 0) {
        errors.push('Workflow must have at least one node');
    }

    const nodeIds = new Set(workflow.nodes.map(n => n.id));
    const entryNode = workflow.nodes.find(n => n.type === 'validation'); // Convention: Start with validation

    if (!entryNode) {
        // Strict rule: must have a validation node to check data sufficiency
        // errors.push('Workflow must have a node of type "validation"'); 
        // Relaxed for now, but generally good practice.
    }

    workflow.nodes.forEach(node => {
        if (!node.id) errors.push(`Node missing "id": ${JSON.stringify(node)}`);
        if (!node.type) errors.push(`Node ${node.id} missing "type"`);

        // Basic connectivity check
        if (node.next) {
            if (!nodeIds.has(node.next)) {
                errors.push(`Node ${node.id} points to non-existent next node "${node.next}"`);
            }
        }
    });

    return errors;
}

module.exports = {
    validateWorkflow
};
