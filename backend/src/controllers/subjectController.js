const prisma = require('../config/database');

const getSubjects = async (req, res) => {
  try {
    const where = {};
    if (req.user.role === 'STAFF') {
      const staff = await prisma.staffProfile.findUnique({ where: { userId: req.user.id } });
      if (!staff) return res.status(403).json({ success:false, message:'Staff profile not found.' });
      where.staffId = staff.id;
    }
    if (req.user.role === 'STUDENT') {
      const student = await prisma.studentProfile.findUnique({ where: { userId: req.user.id } });
      if (!student) return res.status(403).json({ success:false, message:'Student profile not found.' });
      where.enrollments = { some: { studentId: student.id } };
    }
    const subjects = await prisma.subject.findMany({
      where, include: { department:true, staff:{ include:{ user:{ select:{ id:true,name:true,email:true } } } } },
      orderBy: { name:'asc' }
    });
    res.json({ success:true, count:subjects.length, data:subjects });
  } catch (e) { console.error('Get subjects:',e); res.status(500).json({success:false,message:'Unable to load subjects.'}); }
};

const createSubject = async (req,res) => {
  try {
    const {name,code,credits,departmentId,staffId}=req.body;
    if(!name?.trim()||!code?.trim()||!departmentId) return res.status(400).json({success:false,message:'Name, code and department are required.'});
    const subject=await prisma.subject.create({data:{
      name:name.trim(),code:code.trim().toUpperCase(),credits:Number(credits)||3,
      departmentId:Number(departmentId),staffId:staffId?Number(staffId):null
    },include:{department:true}});
    res.status(201).json({success:true,message:'Subject created successfully.',data:subject});
  } catch(e) { if(e.code==='P2002') return res.status(409).json({success:false,message:'Subject code already exists.'}); console.error(e);res.status(500).json({success:false,message:'Unable to create subject.'});}
};
const updateSubject=async(req,res)=>{
 try{const data={};['name','code'].forEach(k=>{if(req.body[k]!==undefined)data[k]=req.body[k].trim()});if(req.body.credits!==undefined)data.credits=Number(req.body.credits);if(req.body.departmentId!==undefined)data.departmentId=Number(req.body.departmentId);if(req.body.staffId!==undefined)data.staffId=req.body.staffId?Number(req.body.staffId):null;
 const subject=await prisma.subject.update({where:{id:Number(req.params.id)},data,include:{department:true}});res.json({success:true,data:subject});}
 catch(e){if(e.code==='P2025')return res.status(404).json({success:false,message:'Subject not found.'});console.error(e);res.status(500).json({success:false,message:'Unable to update subject.'});}
};
const deleteSubject=async(req,res)=>{try{await prisma.subject.delete({where:{id:Number(req.params.id)}});res.json({success:true,message:'Subject deleted.'});}catch(e){if(e.code==='P2025')return res.status(404).json({success:false,message:'Subject not found.'});res.status(409).json({success:false,message:'Subject cannot be deleted while academic records use it.'});}};
module.exports={getSubjects,createSubject,updateSubject,deleteSubject};
