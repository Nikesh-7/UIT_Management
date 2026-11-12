const express = require('express');
const router = express.Router();

const {
    createExam,
    getAllExams,
    getExamById,
    updateExam,
    deleteExam
} = require('../controllers/examController');

const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.post('/', authorizeRoles('ADMIN', 'STAFF'), createExam);
router.get('/', getAllExams);
router.get('/:id', getExamById);
router.put('/:id', authorizeRoles('ADMIN', 'STAFF'), updateExam);
router.delete('/:id', authorizeRoles('ADMIN', 'STAFF'), deleteExam);

module.exports = router;
