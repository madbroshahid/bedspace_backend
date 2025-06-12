const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');

// Middleware to check admin role and localhost
function authAdminAndLocalhost(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No token provided' });
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
        // Check for admin role
        if (decoded.role !== 'Admin') return res.status(403).json({ message: 'Forbidden' });
        // Check if request is from localhost
        const ip = req.ip || req.connection.remoteAddress;
        if (!(ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1')) {
            return res.status(403).json({ message: 'Admin creation only allowed from localhost' });
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

// User registration
router.post('/register', async (req, res, next) => {
    try {
        const { role } = req.body;
        if (role === 'Admin' || role === 'Landlord') {
            // Allow first admin creation without token if no admin exists
            if (role === 'Admin') {
                const adminCount = await User.countDocuments({ role: { $in: ['Admin', 'admin'] } });
                if (adminCount === 0) {
                    return next(); // Allow creation
                }
            }
            // Only admin from localhost can create admin/landlord
            return authAdminAndLocalhost(req, res, async () => {
                next();
            });
        }
        // Tenant registration is open
        next();
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
}, async (req, res) => {
    try {
        const { email, password, role } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already in use' });
        }
        let tenantId;
        if (role === 'Tenant') {
            tenantId = uuidv4();
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ email, password: hashedPassword, role, tenantId });
        await user.save();
        res.status(201).json({ message: 'User registered', tenantId: user.tenantId });
    } catch (err) {
        console.error('Registration error:', err); // Log detailed error
        res.status(500).json({ message: 'Server error', error: err.message }); // Return error message
    }
});

// User login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET || 'secretkey',
            { expiresIn: '1d' }
        );
        res.json({ token });
    } catch (err) {
        console.error('Login error:', err); // Log detailed error
        res.status(500).json({ message: 'Server error', error: err.message }); // Return error message
    }
});

// Admin: Get all users
router.get('/users', authAdmin, async (req, res) => {
    try {
        const users = await User.find({}, '-password');
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Admin: Add user (same as register, but only for Admin)
router.post('/users', authAdmin, async (req, res) => {
    try {
        const { email, password, role } = req.body;
        if (!email || !password || !role) return res.status(400).json({ message: 'Missing fields' });
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: 'Email already in use' });
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ email, password: hashedPassword, role });
        await user.save();
        res.status(201).json({ message: 'User created' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Admin: Update user
router.put('/users/:id', authAdmin, async (req, res) => {
    try {
        const { email, password, role } = req.body;
        const update = {};
        if (email) update.email = email;
        if (role) update.role = role;
        if (password) update.password = await bcrypt.hash(password, 10);
        const user = await User.findByIdAndUpdate(req.params.id, update, { new: true, select: '-password' });
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Admin: Delete user
router.delete('/users/:id', authAdmin, async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ message: 'User deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Admin: Update tenant by tenantId
router.put('/users/tenant/:tenantId', authAdmin, async (req, res) => {
    try {
        const { email, password } = req.body;
        const update = {};
        if (email) update.email = email;
        if (password) update.password = await bcrypt.hash(password, 10);
        const user = await User.findOneAndUpdate({ tenantId: req.params.tenantId, role: 'Tenant' }, update, { new: true, select: '-password' });
        if (!user) return res.status(404).json({ message: 'Tenant not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Admin: Delete tenant by tenantId
router.delete('/users/tenant/:tenantId', authAdmin, async (req, res) => {
    try {
        const user = await User.findOneAndDelete({ tenantId: req.params.tenantId, role: 'Tenant' });
        if (!user) return res.status(404).json({ message: 'Tenant not found' });
        res.json({ message: 'Tenant deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router;
