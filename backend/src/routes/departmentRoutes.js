const express = require('express');
const router = express.Router();

const {
    createDepartment,
    getAllDepartments,
    getDepartmentById,
    updateDepartment,
    deleteDepartment
} = require('../controllers/departmentController');

const {
    authenticateToken,
    authorizeRoles
} = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.post('/', authorizeRoles('ADMIN'), createDepartment);
router.get('/', authorizeRoles('ADMIN', 'STAFF'), getAllDepartments);
router.get('/:id', authorizeRoles('ADMIN'), getDepartmentById);
router.put('/:id', authorizeRoles('ADMIN'), updateDepartment);
router.delete('/:id', authorizeRoles('ADMIN'), deleteDepartment);

module.exports = router;