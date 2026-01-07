const express = require('express');
const bodyParser = require('body-parser');
const engine = require('./core/engine');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json({ limit: '10mb' }));

/**
 * Health Check
 */
app.get('/health', (req, res) => {
    res.json({ status: 'ok', engine: 'active' });
});

/**
 * POST /analyze
 * Executes the DSL Engine for a given workflow and alert context.
 * 
 * Body: {
 *   alert: Object,
 *   brand: Object,
 *   workflow: Object
 * }
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

        console.log(`[API] Received analysis request for Brand:${brand.brand_id} Metric:${alert.metric}`);

        // Execute Engine
        const result = await engine.executeWorkflow({ alert, brand, workflow });

        // HTTP Code based on result status
        let status = 200;
        if (result.status === 'error') status = 500;

        res.status(status).json(result);

    } catch (error) {
        console.error('[API] Execution failed:', error);
        res.status(500).json({
            status: 'error',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * Start Server
 */
app.listen(PORT, () => {
    console.log(`\n--- DSL Engine API listening on port ${PORT} ---`);
    console.log(`Test endpoint: POST http://localhost:${PORT}/analyze`);
});
