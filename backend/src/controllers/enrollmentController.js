const prisma = require('../config/database');

const getEnrollments = async (req,res) => {
  try {
    const rows = await prisma.enrollment.findMany({
      include: {
        student: { include: { user: { select: { id:true, name:true, email:true } } } },
        subject: { include: { department: { select: { name:true, code:true } } } }
      },
      orderBy: { id:'desc' }
    });
    res.json({ success:true, count:rows.length, data:rows });
  } catch(e) { console.error('Get enrollments:',e); res.status(500).json({success:false,message:'Unable to load enrollments.'}); }
};
const createEnrollment = async (req,res) => {
  try {
    const studentId=Number(req.body.studentId), subjectId=Number(req.body.subjectId);
    if(!Number.isInteger(studentId)||studentId<=0||!Number.isInteger(subjectId)||subjectId<=0)
      return res.status(400).json({success:false,message:'A valid student and subject are required.'});
    const [student,subject]=await Promise.all([
      prisma.studentProfile.findUnique({where:{id:studentId}}),
      prisma.subject.findUnique({where:{id:subjectId}})
    ]);
    if(!student||!subject) return res.status(404).json({success:false,message:'Student or subject not found.'});
    const enrollment=await prisma.enrollment.create({
      data:{studentId,subjectId},
      include:{student:{include:{user:{select:{name:true,email:true}}}},subject:true}
    });
    res.status(201).json({success:true,message:'Student enrolled successfully.',data:enrollment});
  } catch(e) {
    if(e.code==='P2002') return res.status(409).json({success:false,message:'This student is already enrolled in the subject.'});
    console.error('Create enrollment:',e);res.status(500).json({success:false,message:'Unable to create enrollment.'});
  }
};
const deleteEnrollment=async(req,res)=>{
  try{await prisma.enrollment.delete({where:{id:Number(req.params.id)}});res.json({success:true,message:'Enrollment removed.'});}
  catch(e){if(e.code==='P2025')return res.status(404).json({success:false,message:'Enrollment not found.'});res.status(500).json({success:false,message:'Unable to remove enrollment.'});}
};
module.exports={getEnrollments,createEnrollment,deleteEnrollment};
