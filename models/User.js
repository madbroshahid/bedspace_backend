const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['Tenant', 'Landlord', 'Admin', 'admin', 'tenant', 'landlord'],
        default: 'Tenant',
        lowercase: true
    },
    tenantId: { type: String, unique: true, sparse: true }, // Unique tenant ID
    assignedListing: {
        listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' },
        assignedAt: { type: Date }
    }
});

module.exports = mongoose.model('User', userSchema);
