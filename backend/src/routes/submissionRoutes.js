const express = require('express');
const router = express.Router();

const {
    submitAssignment,
    getMySubmissions,
    getAssignmentSubmissions,
    gradeSubmission
} = require('../controllers/submissionController');

const {
    authenticateToken,
    authorizeRoles
} = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.post('/', authorizeRoles('STUDENT'), submitAssignment);

router.get('/my', authorizeRoles('STUDENT'), getMySubmissions);

router.get(
    '/assignment/:assignmentId',
    authorizeRoles('ADMIN', 'STAFF'),
    getAssignmentSubmissions
);

router.put(
    '/:id/grade',
    authorizeRoles('ADMIN', 'STAFF'),
    gradeSubmission
);

module.exports = router;
