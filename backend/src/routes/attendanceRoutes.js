const express = require('express');
const router = express.Router();

const {
    markAttendance,
    markBulkAttendance,
    getAllAttendance,
    getStudentAttendance,
    getSubjectAttendance,
    updateAttendance,
    getAttendanceReport,
    deleteAttendance
} = require('../controllers/attendanceController');

const {
    authenticateToken,
    authorizeRoles
} = require('../middleware/authMiddleware');

router.use(authenticateToken);

// Admin and Staff
router.post('/', authorizeRoles('ADMIN', 'STAFF'), markAttendance);
router.post('/bulk', authorizeRoles('ADMIN', 'STAFF'), markBulkAttendance);

router.get('/', authorizeRoles('ADMIN', 'STAFF'), getAllAttendance);
router.get('/report', authorizeRoles('ADMIN', 'STAFF'), getAttendanceReport);
router.get('/student/:studentId', authorizeRoles('ADMIN', 'STAFF', 'STUDENT'), getStudentAttendance);
router.get('/subject/:subjectId', authorizeRoles('ADMIN', 'STAFF'), getSubjectAttendance);

router.put('/:id', authorizeRoles('ADMIN', 'STAFF'), updateAttendance);
router.delete('/:id', authorizeRoles('ADMIN'), deleteAttendance);

module.exports = router;