const express = require('express');
const router = express.Router();

const {
    authenticateToken,
    authorizeRoles
} = require('../middleware/authMiddleware');

// Admin dashboard
router.get(
    '/admin',
    authenticateToken,
    authorizeRoles('ADMIN'),
    (req, res) => {
        res.json({
            success: true,
            message: 'Welcome to Admin Dashboard'
        });
    }
);

// Staff dashboard
router.get(
    '/staff',
    authenticateToken,
    authorizeRoles('STAFF'),
    (req, res) => {
        res.json({
            success: true,
            message: 'Welcome to Staff Dashboard'
        });
    }
);

// Student dashboard
router.get(
    '/student',
    authenticateToken,
    authorizeRoles('STUDENT'),
    (req, res) => {
        res.json({
            success: true,
            message: 'Welcome to Student Dashboard'
        });
    }
);

module.exports = router;