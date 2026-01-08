const mongoose = require('mongoose');

const workflowSchema = new mongoose.Schema({
    brand_id: { type: Number, required: true, index: true },
    workflow_id: { type: String, required: true, index: true },
    version: { type: Number, required: true, default: 1 },

    // New fields from user sample
    workflow_type: { type: String },
    description: { type: String },

    trigger: { type: Object }, // Stores { type, metric, condition, window }
    context: { type: Object }, // Stores { brand_id_template, baseline_window, etc }

    nodes: { type: Array, required: true }, // The core graph

    // Legacy fields made optional or removed based on sample
    // name: { type: String }, 
    // supported_metric: { type: String },

    status: { type: String, enum: ['active', 'archived'], default: 'active' },
    created_by: { type: String, required: true },
    created_at: { type: Date, default: Date.now }
});

// Ensure unique version per workflow per brand
workflowSchema.index({ brand_id: 1, workflow_id: 1, version: 1 }, { unique: true });

module.exports = mongoose.model('Workflow', workflowSchema);
