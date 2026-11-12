const express = require('express');
const router = express.Router();

const {
    createAssignment,
    getAllAssignments,
    getAssignmentById,
    updateAssignment,
    deleteAssignment
} = require('../controllers/assignmentController');

const {
    authenticateToken,
    authorizeRoles
} = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.post('/', authorizeRoles('STAFF'), createAssignment);
router.get('/', getAllAssignments);
router.get('/:id', getAssignmentById);
router.put('/:id', authorizeRoles('ADMIN', 'STAFF'), updateAssignment);
router.delete('/:id', authorizeRoles('ADMIN', 'STAFF'), deleteAssignment);

module.exports = router;
