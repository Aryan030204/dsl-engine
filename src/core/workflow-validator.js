/**
 * Validates a workflow JSON structure.
 * Enforces schema, node types, connectivity, and constraints.
 */

const ALLOWED_NODE_TYPES = new Set([
    'metric_compare',
    'branch',
    'recursive_dimension_breakdown',
    'drill_down',
    'suppression',
    'defer',
    'confidence',
    'insight',
    'composite',
    'validation' // Added validation as it's required/used by engine
]);

const MAX_NODES = process.env.MAX_NODES || 50;
const MAX_DEPTH = process.env.MAX_DEPTH || 20;

function validateWorkflow(json) {
    if (!json || typeof json !== 'object') {
        throw new Error('Workflow JSON must be an object');
    }

    // if (!json.start_node) {
    //     throw new Error('Missing "start_node" in workflow JSON');
    // }

    if (!json.nodes || !Array.isArray(json.nodes)) {
        throw new Error('Workflow "nodes" must be an array');
    }

    if (json.nodes.length === 0) {
        throw new Error('Workflow must have at least one node');
    }

    if (json.nodes.length > MAX_NODES) {
        throw new Error(`Workflow exceeds maximum node limit of ${MAX_NODES}`);
    }

    // Map for fast lookup
    const nodeMap = new Map();
    json.nodes.forEach(n => {
        if (!n.id) throw new Error('All nodes must have an "id" property');
        if (nodeMap.has(n.id)) throw new Error(`Duplicate node id "${n.id}"`);
        nodeMap.set(n.id, n);
    });

    let startNodeId = json.start_node;

    if (!startNodeId) {
        const valNode = json.nodes.find(n => n.type === 'validation');
        if (valNode) {
            startNodeId = valNode.id;
        } else {
            // Optional: Default to first node if no validation?
            // startNodeId = json.nodes[0].id;
            throw new Error('Missing "start_node" and no "validation" node found');
        }
    }

    if (!nodeMap.has(startNodeId)) {
        throw new Error(`Start node "${startNodeId}" not found in nodes`);
    }

    // 1. Validate individual nodes
    json.nodes.forEach(node => {
        if (!node.type) {
            throw new Error(`Node "${node.id}" missing "type"`);
        }
        if (!ALLOWED_NODE_TYPES.has(node.type)) {
            throw new Error(`Node "${node.id}" has invalid type "${node.type}"`);
        }

        // Validate 'next' pointers
        if (node.next) {
            if (typeof node.next === 'string') {
                if (!nodeMap.has(node.next)) {
                    throw new Error(`Node "${node.id}" points to non-existent next node "${node.next}"`);
                }
            } else if (typeof node.next === 'object') {
                // Branch node support (uncommon in simple DSLs but good to support)
                // If it's a branch node, it might use specific logic, but usually 'next' is a string.
                // If 'branch' node uses 'next_true' / 'next_false', check those instead.
            }
        }

        // Specific checks for Branch nodes
        if (node.type === 'branch') {
            if (node.routes) {
                for (const route of Object.values(node.routes)) {
                    if (!nodeMap.has(route)) {
                        throw new Error(`Branch node "${node.id}" points to non-existent route "${route}"`);
                    }
                }
            }
        }
    });

    // 2. Cycle Detection & Reachability (Basic DFS)
    const visited = new Set();
    const recursionStack = new Set();

    function dfs(nodeId, depth) {
        if (depth > MAX_DEPTH) {
            throw new Error(`Max workflow depth exceeded at node "${nodeId}"`);
        }
        if (recursionStack.has(nodeId)) {
            throw new Error(`Infinite loop detected involving node "${nodeId}"`);
        }
        if (visited.has(nodeId)) return;

        visited.add(nodeId);
        recursionStack.add(nodeId);

        const node = nodeMap.get(nodeId);

        // Follow 'next'
        if (node.next && typeof node.next === 'string') {
            dfs(node.next, depth + 1);
        }

        // Follow branch routes
        if (node.type === 'branch' && node.routes) {
            for (const nextId of Object.values(node.routes)) {
                dfs(nextId, depth + 1);
            }
        }

        recursionStack.delete(nodeId);
    }

    dfs(startNodeId, 0);

    return true;
}

module.exports = { validateWorkflow };
