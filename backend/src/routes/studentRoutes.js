const express = require('express');
const router = express.Router();

const {
    createStudent,
    getAllStudents,
    getStudentById,
    updateStudent,
    deleteStudent
} = require('../controllers/studentController');

const {
    authenticateToken,
    authorizeRoles
} = require('../middleware/authMiddleware');

router.use(authenticateToken);
router.post('/', authorizeRoles('ADMIN'), createStudent);
router.get('/', authorizeRoles('ADMIN', 'STAFF'), getAllStudents);
router.get('/:id', authorizeRoles('ADMIN'), getStudentById);
router.put('/:id', authorizeRoles('ADMIN'), updateStudent);
router.delete('/:id', authorizeRoles('ADMIN'), deleteStudent);

module.exports = router;
