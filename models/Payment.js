const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tenantId: { type: String, required: true }, // Track by tenantId
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: false }, // Not required now
    amount: { type: Number, required: true },
    month: { type: String, required: true }, // e.g. '2025-06'
    status: { type: String, enum: ['Pending', 'Paid'], default: 'Pending' },
    paidAt: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Payment', paymentSchema);
