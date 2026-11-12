const express = require('express');
const router = express.Router();

const {
    getDashboardReport,
    getStudentReport,
    getAttendanceReport,
    getExamReport,
    getAssignmentReport
} = require('../controllers/reportController');

const {
    authenticateToken,
    authorizeRoles
} = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.get('/dashboard', getDashboardReport);
router.get('/student/:studentId', authorizeRoles('ADMIN', 'STAFF', 'STUDENT'), getStudentReport);
router.get('/attendance', authorizeRoles('ADMIN', 'STAFF'), getAttendanceReport);
router.get('/exams', authorizeRoles('ADMIN', 'STAFF'), getExamReport);
router.get('/assignments', authorizeRoles('ADMIN', 'STAFF'), getAssignmentReport);

module.exports = router;
