const mongoose = require('mongoose');

const executionSchema = new mongoose.Schema({
    workflow_id: { type: String, required: true, index: true },
    workflow_version: { type: Number, required: true },
    brand_id: { type: Number, required: true, index: true },
    alert_payload: { type: Object, required: true },
    result: { type: Object },
    executed_by: { type: String, required: true },
    executed_at: { type: Date, default: Date.now },
    execution_time_ms: { type: Number },
    status: { type: String, enum: ['success', 'error', 'suppressed', 'deferred'], default: 'success' }
});

module.exports = mongoose.model('WorkflowExecution', executionSchema);
