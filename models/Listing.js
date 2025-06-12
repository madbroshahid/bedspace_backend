const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    photo: { type: String }, // S3 object key
    url: { type: String },   // S3 public URL
    landlord: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // assigned tenant
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Listing', listingSchema);
