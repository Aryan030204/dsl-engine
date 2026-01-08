const express = require('express');
const bodyParser = require('body-parser');
const engine = require('./core/engine');
const { connectMongo } = require('./core/mongo-connector');
const Workflow = require('./models/Workflow');
const WorkflowExecution = require('./models/WorkflowExecution');
const { validateWorkflow } = require('./core/workflow-validator');
require('dotenv').config({ path: ['../.env', '.env'] });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json({ limit: '10mb' }));

// Initialize MongoDB
connectMongo();

/**
 * Health Check
 */
app.get('/health', (req, res) => {
    res.json({ status: 'ok', engine: 'active' });
});

/**
 * POST /api/workflows
 * Create a new workflow.
 */
app.post('/api/workflows', async (req, res) => {
    try {
        let { brand_id, workflow_id, workflow_type, description, trigger, context, nodes, created_by } = req.body;

        // Fallbacks for user convenience (fixes nested brand_id issue)
        if (!brand_id && context && context.brand_id) {
            brand_id = context.brand_id; // Extract from context if missing at top level
        }

        if (!created_by) {
            created_by = 'api_user'; // Default if not provided
        }

        if (!brand_id || !workflow_id || !nodes) {
            console.log('[API] Missing fields:', { brand_id, workflow_id, hasNodes: !!nodes });
            return res.status(400).json({ status: 'error', message: 'Missing required fields: brand_id, workflow_id, nodes' });
        }

        // 2. Validate Workflow Graph
        try {
            validateWorkflow({ nodes, trigger, context });
        } catch (vErr) {
            return res.status(400).json({ status: 'error', message: `Invalid workflow: ${vErr.message}` });
        }

        // 3. Versioning Strategy
        const lastVersion = await Workflow.findOne({ brand_id, workflow_id }).sort({ version: -1 }).lean();
        const newVersion = lastVersion ? lastVersion.version + 1 : 1;

        // 4. Create Document
        const workflow = new Workflow({
            brand_id,
            workflow_id,
            version: newVersion,
            workflow_type,
            description,
            trigger,
            context,
            nodes,
            created_by,
            status: 'active'
        });

        await workflow.save();

        console.log(`[API] Created workflow ${workflow_id} v${newVersion}`);
        res.json({ status: 'success', workflow_id, version: newVersion });

    } catch (error) {
        console.error('[API] Create Workflow Error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * POST /api/workflows/run
 * Execute a stored workflow.
 */
app.post('/api/workflows/run', async (req, res) => {
    try {
        const { brand_id, workflow_id, alert_payload, run_by } = req.body;

        if (!brand_id || !workflow_id || !alert_payload) {
            return res.status(400).json({ status: 'error', message: 'Missing fields' });
        }

        // 1. Fetch Workflow
        const workflow = await Workflow.findOne({ brand_id, workflow_id, status: 'active' }).sort({ version: -1 }).lean();

        if (!workflow) {
            return res.status(404).json({ status: 'error', message: 'Workflow not found or inactive' });
        }

        console.log(`[API] Workflow Found: ID=${workflow.workflow_id} Ver=${workflow.version}`);

        // 2. Re-Validate (Defensive)
        try {
            validateWorkflow({ nodes: workflow.nodes }); // Pass as object since validator handles flat nodes in wrapping logic if needed, but validator expects Object with nodes array.
        } catch (vErr) {
            return res.status(500).json({ status: 'error', message: `Stored workflow is invalid: ${vErr.message}` });
        }

        // 3. Execute
        const startTime = Date.now();

        const enginePayload = {
            id: workflow.workflow_id,
            version: workflow.version,
            nodes: workflow.nodes,
            trigger: workflow.trigger,
            context: workflow.context
        };

        const result = await engine.executeWorkflow({
            alert: alert_payload,
            brand: { brand_id },
            workflow: enginePayload
        });
        const duration = Date.now() - startTime;

        // 4. Log Execution
        const log = new WorkflowExecution({
            workflow_id,
            workflow_version: workflow.version,
            brand_id,
            alert_payload,
            result,
            executed_by: run_by || 'system',
            execution_time_ms: duration,
            status: result.status === 'success' ? 'success' : 'error'
        });
        await log.save();

        // 5. Response
        res.json({
            status: 'success',
            workflow_id,
            version: workflow.version,
            analysis_result: result.analysis_results || result
        });

    } catch (error) {
        console.error('[API] Run Workflow Error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * POST /analyze (Legacy/Direct)
 */
app.post('/analyze', async (req, res) => {
    try {
        const { alert, brand, workflow } = req.body;

        if (!alert || !brand || !workflow) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required fields: alert, brand, or workflow'
            });
        }

        console.log(`[API] Received direct analysis request for Brand:${brand.brand_id}`);

        const result = await engine.executeWorkflow({ alert, brand, workflow });
        res.json(result);

    } catch (error) {
        console.error('[API] Execution failed:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * Start Server
 */
app.listen(PORT, () => {
    console.log(`\n--- DSL Engine API listening on port ${PORT} ---`);
    console.log(`[Mongo] Enabled`);
    console.log(`Endpoints:`);
    console.log(`  POST /api/workflows`);
    console.log(`  POST /api/workflows/run`);
    console.log(`  POST /analyze (Legacy)`);
});
