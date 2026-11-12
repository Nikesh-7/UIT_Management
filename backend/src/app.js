const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// ======================================
// ROUTE IMPORTS
// ======================================

const studyMaterialRoutes = require('./routes/studyMaterialRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const reportRoutes = require('./routes/reportRoutes');
const subjectRoutes = require('./routes/subjectRoutes');
const enrollmentRoutes = require('./routes/enrollmentRoutes');

const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const staffRoutes = require('./routes/staffRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const protectedRoutes = require('./routes/protectedRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const examRoutes = require('./routes/examRoutes');
const markRoutes = require('./routes/markRoutes');
const assignmentRoutes = require('./routes/assignmentRoutes');
const submissionRoutes = require('./routes/submissionRoutes');

// ======================================
// EXPRESS APPLICATION
// ======================================

const app = express();

// ======================================
// SECURITY
// ======================================

app.use(helmet());

// ======================================
// CORS CONFIGURATION
// ======================================

const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5180',
    'http://127.0.0.1:5180'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(
            new Error(`Origin ${origin} is not allowed by CORS.`)
        );
    },

    methods: [
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'OPTIONS'
    ],

    allowedHeaders: [
        'Content-Type',
        'Authorization'
    ]
}));

// ======================================
// BODY PARSING
// ======================================

app.use(express.json({
    limit: '1mb'
}));

app.use(express.urlencoded({
    extended: false,
    limit: '1mb'
}));

// ======================================
// API ROUTES
// ======================================

app.use('/api/auth', authRoutes);

app.use('/api/students', studentRoutes);

app.use('/api/staff', staffRoutes);

app.use('/api/departments', departmentRoutes);

app.use('/api/subjects', subjectRoutes);

app.use('/api/enrollments', enrollmentRoutes);

app.use('/api/protected', protectedRoutes);

app.use('/api/attendance', attendanceRoutes);

app.use('/api/exams', examRoutes);

app.use('/api/marks', markRoutes);

app.use('/api/assignments', assignmentRoutes);

app.use('/api/submissions', submissionRoutes);

app.use('/api/materials', studyMaterialRoutes);

app.use('/api/announcements', announcementRoutes);

app.use('/api/reports', reportRoutes);

// ======================================
// HOME ROUTE
// ======================================

app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Welcome to College Management System'
    });
});

// ======================================
// HEALTH CHECK
// ======================================

app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Backend is running successfully',
        status: 'Healthy'
    });
});

// ======================================
// EXPORT APPLICATION
// ======================================

module.exports = app;