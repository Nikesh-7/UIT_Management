require('dotenv').config();

const app = require('./app');

const PORT = process.env.PORT || 3000;

// Validate environment variables
if (!process.env.DATABASE_URL) {
    throw new Error(
        'DATABASE_URL is required. Configure backend/.env.'
    );
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error(
        'JWT_SECRET must be configured with at least 32 characters.'
    );
}

// Start server
app.listen(PORT, () => {
    console.log('================================');
    console.log(' COLLEGE MANAGEMENT SYSTEM');
    console.log('================================');
    console.log(`Server running on port ${PORT}`);
    console.log(`URL: http://localhost:${PORT}`);
    console.log('Allowed frontend origins:');
    console.log(' - http://localhost:5173');
    console.log(' - http://localhost:5180');
    console.log('================================');
});
