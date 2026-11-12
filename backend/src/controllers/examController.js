const prisma = require('../config/database');

const VALID_TYPES = ['INTERNAL', 'SEMESTER', 'PRACTICAL', 'MODEL'];

const canManageSubject = async (user, subjectId) => {
    if (user.role === 'ADMIN') return true;

    if (user.role !== 'STAFF') return false;

    const staff = await prisma.staffProfile.findUnique({
        where: { userId: user.id }
    });

    if (!staff) return false;

    const subject = await prisma.subject.findFirst({
        where: {
            id: subjectId,
            staffId: staff.id
        }
    });

    return !!subject;
};

// CREATE EXAM
const createExam = async (req, res) => {
    try {
        const { name, type, subjectId, examDate, maxMarks, academicYear } = req.body;

        if (!name || !type || !subjectId || !examDate || maxMarks === undefined) {
            return res.status(400).json({
                success: false,
                message: 'All required fields must be provided.'
            });
        }

        if (!VALID_TYPES.includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid examination type.'
            });
        }

        const subjectID = Number(subjectId);
        const maximum = Number(maxMarks);
        const date = new Date(examDate);

        if (!Number.isInteger(subjectID) || subjectID <= 0 ||
            !Number.isFinite(maximum) || maximum <= 0 ||
            Number.isNaN(date.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid subject, maximum marks or examination date.'
            });
        }

        if (!(await canManageSubject(req.user, subjectID))) {
            return res.status(403).json({
                success: false,
                message: 'You cannot manage this subject.'
            });
        }

        const exam = await prisma.exam.create({
            data: {
                name: name.trim(),
                type,
                subjectId: subjectID,
                examDate: date,
                maxMarks: maximum,
                academicYear: academicYear || null
            },
            include: {
                subject: true
            }
        });

        res.status(201).json({
            success: true,
            message: 'Examination created successfully.',
            data: exam
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Failed to create examination.'
        });
    }
};

// GET ALL EXAMS
const getAllExams = async (req, res) => {
    try {
        const where = {};

        if (req.query.subjectId) {
            where.subjectId = Number(req.query.subjectId);
        }

        if (req.user.role === 'STAFF') {
            const staff = await prisma.staffProfile.findUnique({
                where: { userId: req.user.id }
            });

            if (!staff) {
                return res.status(403).json({
                    success: false,
                    message: 'Staff profile not found.'
                });
            }

            where.subject = { staffId: staff.id };
        }

        if (req.user.role === 'STUDENT') {
            const student = await prisma.studentProfile.findUnique({
                where: { userId: req.user.id }
            });

            if (!student) {
                return res.status(403).json({
                    success: false,
                    message: 'Student profile not found.'
                });
            }

            where.subject = {
                enrollments: {
                    some: { studentId: student.id }
                }
            };
        }

        const exams = await prisma.exam.findMany({
            where,
            include: {
                subject: true,
                _count: { select: { marks: true } }
            },
            orderBy: { examDate: 'desc' }
        });

        res.json({
            success: true,
            count: exams.length,
            data: exams
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve examinations.'
        });
    }
};

// GET EXAM BY ID
const getExamById = async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid examination ID.'
            });
        }

        const exam = await prisma.exam.findUnique({
            where: { id },
            include: {
                subject: true,
                _count: { select: { marks: true } }
            }
        });

        if (!exam) {
            return res.status(404).json({
                success: false,
                message: 'Examination not found.'
            });
        }

        if (req.user.role === 'STAFF' &&
            !(await canManageSubject(req.user, exam.subjectId))) {
            return res.status(403).json({
                success: false,
                message: 'Access denied.'
            });
        }

        if (req.user.role === 'STUDENT') {
            const student = await prisma.studentProfile.findUnique({
                where: { userId: req.user.id }
            });

            const enrollment = student
                ? await prisma.enrollment.findUnique({
                    where: {
                        studentId_subjectId: {
                            studentId: student.id,
                            subjectId: exam.subjectId
                        }
                    }
                })
                : null;

            if (!enrollment) {
                return res.status(403).json({
                    success: false,
                    message: 'You are not enrolled in this subject.'
                });
            }
        }

        res.json({ success: true, data: exam });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve examination.'
        });
    }
};

// UPDATE EXAM
const updateExam = async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid examination ID.'
            });
        }

        const existing = await prisma.exam.findUnique({
            where: { id }
        });

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Examination not found.'
            });
        }

        if (!(await canManageSubject(req.user, existing.subjectId))) {
            return res.status(403).json({
                success: false,
                message: 'Access denied.'
            });
        }

        const data = {};

        if (req.body.name !== undefined) {
            if (typeof req.body.name !== 'string' || !req.body.name.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid examination name.'
                });
            }
            data.name = req.body.name.trim();
        }

        if (req.body.type !== undefined) {
            if (!VALID_TYPES.includes(req.body.type)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid examination type.'
                });
            }
            data.type = req.body.type;
        }

        if (req.body.examDate !== undefined) {
            const date = new Date(req.body.examDate);

            if (Number.isNaN(date.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid examination date.'
                });
            }

            data.examDate = date;
        }

        if (req.body.maxMarks !== undefined) {
            const maximum = Number(req.body.maxMarks);

            if (!Number.isFinite(maximum) || maximum <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid maximum marks.'
                });
            }

            const hasExcessMarks = await prisma.mark.count({
                where: {
                    examId: id,
                    score: { gt: maximum }
                }
            });

            if (hasExcessMarks) {
                return res.status(400).json({
                    success: false,
                    message: 'Maximum marks cannot be lower than existing scores.'
                });
            }

            data.maxMarks = maximum;
        }

        if (req.body.academicYear !== undefined) {
            data.academicYear = req.body.academicYear || null;
        }

        const updated = await prisma.exam.update({
            where: { id },
            data
        });

        res.json({
            success: true,
            message: 'Examination updated successfully.',
            data: updated
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Failed to update examination.'
        });
    }
};

// DELETE EXAM
const deleteExam = async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid examination ID.'
            });
        }

        const exam = await prisma.exam.findUnique({
            where: { id }
        });

        if (!exam) {
            return res.status(404).json({
                success: false,
                message: 'Examination not found.'
            });
        }

        if (!(await canManageSubject(req.user, exam.subjectId))) {
            return res.status(403).json({
                success: false,
                message: 'Access denied.'
            });
        }

        await prisma.exam.delete({ where: { id } });

        res.json({
            success: true,
            message: 'Examination and its associated marks deleted successfully.'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete examination.'
        });
    }
};

module.exports = {
    createExam,
    getAllExams,
    getExamById,
    updateExam,
    deleteExam
};