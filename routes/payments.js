const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Listing = require('../models/Listing');
const User = require('../models/User');
const Payment = require('../models/Payment');

// Middleware to check landlord or admin role
function authLandlordOrAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No token provided' });
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
        if (decoded.role !== 'Landlord' && decoded.role !== 'Admin') {
            return res.status(403).json({ message: 'Forbidden' });
        }
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
    }
}

// Middleware to check admin role
function authAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No token provided' });
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
        if (decoded.role !== 'Admin') return res.status(403).json({ message: 'Forbidden' });
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
    }
}

// Middleware to check tenant role
function authTenant(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No token provided' });
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
        if (decoded.role !== 'Tenant') return res.status(403).json({ message: 'Forbidden' });
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
    }
}

// Assign a property to a tenant (Landlord/Admin only)
router.post('/assign', authLandlordOrAdmin, async (req, res) => {
    try {
        const { listingId, tenantId } = req.body;
        const listing = await Listing.findById(listingId);
        if (!listing) return res.status(404).json({ message: 'Listing not found' });
        const tenant = await User.findOne({ tenantId });
        if (!tenant || tenant.role !== 'Tenant') return res.status(400).json({ message: 'Invalid tenant' });
        listing.tenant = tenant._id;
        await listing.save();
        // Update tenant's assignedListing
        tenant.assignedListing = { listingId: listing._id, assignedAt: new Date() };
        await tenant.save();
        res.json({ message: 'Tenant assigned to property', listing });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Tenant makes a payment for a month (by tenantId)
router.post('/pay', authTenant, async (req, res) => {
    try {
        const { tenantId, amount, month } = req.body;
        const tenant = await User.findOne({ tenantId });
        if (!tenant || String(tenant._id) !== req.user.userId) {
            return res.status(403).json({ message: 'Not authorized for this tenantId' });
        }
        const payment = new Payment({
            tenant: tenant._id,
            tenantId,
            amount,
            month,
            status: 'Paid',
            paidAt: new Date()
        });
        await payment.save();
        res.json({ message: 'Payment recorded', payment });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Landlord/Admin: Track monthly payments for a tenantId
router.get('/payments/tenant/:tenantId', authLandlordOrAdmin, async (req, res) => {
    try {
        const payments = await Payment.find({ tenantId: req.params.tenantId }).populate('tenant', 'email');
        res.json(payments);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Admin: Full access to modify/delete payments
router.put('/payments/:paymentId', authAdmin, async (req, res) => {
    try {
        const update = req.body;
        if (update.password) delete update.password;
        const payment = await Payment.findByIdAndUpdate(req.params.paymentId, update, { new: true });
        if (!payment) return res.status(404).json({ message: 'Payment not found' });
        res.json(payment);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

router.delete('/payments/:paymentId', authAdmin, async (req, res) => {
    try {
        const payment = await Payment.findByIdAndDelete(req.params.paymentId);
        if (!payment) return res.status(404).json({ message: 'Payment not found' });
        res.json({ message: 'Payment deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Landlord/Admin: Get all tenants assigned to landlord's properties and their payment status, filter by month
router.get('/landlord/tenants-payments', authLandlordOrAdmin, async (req, res) => {
    try {
        const { month } = req.query; // e.g. '2025-06'
        // Find all listings for this landlord
        const listings = await Listing.find({ landlord: req.user.userId }).populate('tenant', 'email tenantId assignedListing');
        // Collect all tenantIds
        const tenantIds = listings.filter(l => l.tenant).map(l => l.tenant.tenantId);
        // Get all payments for these tenantIds, filter by month if provided
        const paymentQuery = { tenantId: { $in: tenantIds } };
        if (month) paymentQuery.month = month;
        const payments = await Payment.find(paymentQuery);
        // Group payments by tenantId
        const paymentsByTenant = {};
        payments.forEach(p => {
            if (!paymentsByTenant[p.tenantId]) paymentsByTenant[p.tenantId] = [];
            paymentsByTenant[p.tenantId].push(p);
        });
        // Build response
        const result = listings.filter(l => l.tenant).map(l => {
            const assignedInfo = l.tenant.assignedListing || {};
            return {
                tenantId: l.tenant.tenantId,
                email: l.tenant.email,
                listingId: l._id,
                listingTitle: l.title,
                assignedAt: assignedInfo.assignedAt,
                assignedListing: assignedInfo.listingId,
                payments: paymentsByTenant[l.tenant.tenantId] || [],
                assignmentNote: !paymentsByTenant[l.tenant.tenantId] || paymentsByTenant[l.tenant.tenantId].length === 0
                    ? `Tenant assigned on ${assignedInfo.assignedAt ? assignedInfo.assignedAt.toISOString().split('T')[0] : 'N/A'} to listing ${l.title}`
                    : undefined
            };
        });
        res.json(result);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router;
