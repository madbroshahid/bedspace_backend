const express = require('express');
const router = express.Router();
const multer = require('multer');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_yourkey');
const Listing = require('../models/Listing');
const AWS = require('aws-sdk');
const multerS3 = require('multer-s3');

// S3 configuration for MinIO
const s3 = new AWS.S3({
    endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
    accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    s3ForcePathStyle: true, // needed for MinIO
    signatureVersion: 'v4',
});

const BUCKET = process.env.MINIO_BUCKET || 'bedspace-photos';

// Ensure bucket exists (create if not)
s3.headBucket({ Bucket: BUCKET }, function(err, data) {
    if (err && err.statusCode === 404) {
        s3.createBucket({ Bucket: BUCKET }, function(err, data) {
            if (err) console.error('Error creating bucket:', err);
        });
    }
});

// Multer S3 storage
const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: BUCKET,
        acl: 'public-read',
        key: function (req, file, cb) {
            cb(null, Date.now() + '-' + file.originalname);
        }
    })
});

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

// Get all listings (public)
router.get('/', async (req, res) => {
    try {
        const listings = await Listing.find();
        const listingsWithUrl = listings.map(listing => {
            let url = listing.url;
            if (!url && listing.photo) {
                url = `${process.env.MINIO_ENDPOINT || 'http://localhost:9000'}/${process.env.MINIO_BUCKET || 'bedspace-photos'}/${listing.photo}`;
            }
            return { ...listing.toObject(), url };
        });
        res.json(listingsWithUrl);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get a single listing by ID (public)
router.get('/:id', async (req, res) => {
    try {
        const listing = await Listing.findById(req.params.id);
        if (!listing) return res.status(404).json({ message: 'Listing not found' });
        let url = listing.url;
        if (!url && listing.photo) {
            url = `${process.env.MINIO_ENDPOINT || 'http://localhost:9000'}/${process.env.MINIO_BUCKET || 'bedspace-photos'}/${listing.photo}`;
        }
        res.json({ ...listing.toObject(), url });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Create a new listing (landlord or admin only)
router.post('/', authLandlordOrAdmin, upload.single('photo'), async (req, res) => {
    try {
        const { title, description, price } = req.body;
        let photo, url;
        if (req.file) {
            photo = req.file.key;
            url = req.file.location;
        }
        const listing = new Listing({
            title,
            description,
            price,
            photo,
            url,
            landlord: req.user.userId
        });
        await listing.save();
        res.status(201).json(listing);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Update a listing by ID (landlord or admin only)
router.put('/:id', authLandlordOrAdmin, upload.single('photo'), async (req, res) => {
    try {
        const { title, description, price } = req.body;
        const update = { title, description, price };
        if (req.file) {
            update.photo = req.file.key;
            update.url = req.file.location;
        }
        const listing = await Listing.findOneAndUpdate(
            { _id: req.params.id, landlord: req.user.userId },
            update,
            { new: true }
        );
        if (!listing) return res.status(404).json({ message: 'Listing not found or not authorized' });
        res.json(listing);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete a listing by ID (landlord or admin only)
router.delete('/:id', authLandlordOrAdmin, async (req, res) => {
    try {
        const listing = await Listing.findOneAndDelete({ _id: req.params.id, landlord: req.user.userId });
        if (!listing) return res.status(404).json({ message: 'Listing not found or not authorized' });
        res.json({ message: 'Listing deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Create Stripe payment intent for booking
router.post('/:id/book', async (req, res) => {
    try {
        const listing = await Listing.findById(req.params.id);
        if (!listing) return res.status(404).json({ message: 'Listing not found' });
        const { amount } = req.body;
        // amount should be in cents
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount || Math.round(listing.price * 100),
            currency: 'usd',
            metadata: { listingId: listing._id.toString() }
        });
        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (err) {
        res.status(500).json({ message: 'Stripe error', error: err.message });
    }
});

// Payment success route (webhook simulation or client callback)
router.post('/payment/success', async (req, res) => {
    // You can verify payment here or just acknowledge
    res.json({ message: 'Payment successful' });
});

module.exports = router;
