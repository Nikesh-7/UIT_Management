const router=require('express').Router();
const {authenticateToken,authorizeRoles}=require('../middleware/authMiddleware');
const {getSubjects,createSubject,updateSubject,deleteSubject}=require('../controllers/subjectController');
router.use(authenticateToken);
router.get('/',getSubjects);
router.post('/',authorizeRoles('ADMIN'),createSubject);
router.put('/:id',authorizeRoles('ADMIN'),updateSubject);
router.delete('/:id',authorizeRoles('ADMIN'),deleteSubject);
module.exports=router;
