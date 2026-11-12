const express = require('express');
const router = express.Router();

const {
    createMaterial,
    getAllMaterials,
    getMaterialById,
    updateMaterial,
    deleteMaterial
} = require('../controllers/studyMaterialController');

const {
    authenticateToken,
    authorizeRoles
} = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.post('/', authorizeRoles('STAFF'), createMaterial);
router.get('/', getAllMaterials);
router.get('/:id', getMaterialById);
router.put('/:id', authorizeRoles('ADMIN', 'STAFF'), updateMaterial);
router.delete('/:id', authorizeRoles('ADMIN', 'STAFF'), deleteMaterial);

module.exports = router;
