const router=require('express').Router();
const {authenticateToken,authorizeRoles}=require('../middleware/authMiddleware');
const {getEnrollments,createEnrollment,deleteEnrollment}=require('../controllers/enrollmentController');
router.use(authenticateToken,authorizeRoles('ADMIN'));
router.get('/',getEnrollments);
router.post('/',createEnrollment);
router.delete('/:id',deleteEnrollment);
module.exports=router;
