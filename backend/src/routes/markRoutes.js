const express = require('express');
const router = express.Router();

const {
    saveMark,
    getAllMarks,
    getStudentResults,
    updateMark,
    deleteMark
} = require('../controllers/markController');

const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.post('/', authorizeRoles('ADMIN', 'STAFF'), saveMark);
router.get('/', getAllMarks);
router.get('/student/:studentId', getStudentResults);
router.put('/:id', authorizeRoles('ADMIN', 'STAFF'), updateMark);
router.delete('/:id', authorizeRoles('ADMIN', 'STAFF'), deleteMark);

module.exports = router;
