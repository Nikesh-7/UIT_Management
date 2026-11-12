const prisma = require('../config/database');

const canManageSubject = async (user, subjectId) => {
    if (user.role === 'ADMIN') return true;

    if (user.role !== 'STAFF') return false;

    const staff = await prisma.staffProfile.findUnique({
        where: { userId: user.id }
    });

    if (!staff) return false;

    const subject = await prisma.subject.findFirst({
        where: { id: subjectId, staffId: staff.id }
    });

    return !!subject;
};

// ADD OR UPDATE STUDENT MARK
const saveMark = async (req, res) => {
    try {
        const examId = Number(req.body.examId);
        const studentId = Number(req.body.studentId);
        const score = Number(req.body.score);

        if (!Number.isInteger(examId) || examId <= 0 ||
            !Number.isInteger(studentId) || studentId <= 0 ||
            req.body.score === undefined ||
            !Number.isFinite(score) || score < 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid exam ID, student ID and score are required.'
            });
        }

        const exam = await prisma.exam.findUnique({
            where: { id: examId }
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
                message: 'You cannot enter marks for this subject.'
            });
        }

        if (score > exam.maxMarks) {
            return res.status(400).json({
                success: false,
                message: `Score cannot exceed ${exam.maxMarks}.`
            });
        }

        const enrollment = await prisma.enrollment.findUnique({
            where: {
                studentId_subjectId: {
                    studentId,
                    subjectId: exam.subjectId
                }
            }
        });

        if (!enrollment) {
            return res.status(400).json({
                success: false,
                message: 'Student is not enrolled in this subject.'
            });
        }

        const mark = await prisma.mark.upsert({
            where: {
                examId_studentId: {
                    examId,
                    studentId
                }
            },
            update: {
                score,
                remarks: req.body.remarks || null
            },
            create: {
                examId,
                studentId,
                score,
                remarks: req.body.remarks || null
            },
            include: {
                exam: true,
                student: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true
                            }
                        }
                    }
                }
            }
        });

        res.status(201).json({
            success: true,
            message: 'Student marks saved successfully.',
            data: mark
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Failed to save student marks.'
        });
    }
};

// GET ALL MARKS
const getAllMarks = async (req, res) => {
    try {
        const where = {};

        if (req.query.examId) {
            where.examId = Number(req.query.examId);
        }

        if (req.query.studentId) {
            where.studentId = Number(req.query.studentId);
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

            where.exam = {
                subject: { staffId: staff.id }
            };
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

            where.studentId = student.id;
        }

        const marks = await prisma.mark.findMany({
            where,
            include: {
                exam: {
                    include: { subject: true }
                },
                student: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({
            success: true,
            count: marks.length,
            data: marks
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve marks.'
        });
    }
};

// GET STUDENT RESULT
const getStudentResults = async (req, res) => {
    try {
        const studentId = Number(req.params.studentId);

        if (!Number.isInteger(studentId) || studentId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid student ID.'
            });
        }

        if (req.user.role === 'STUDENT') {
            const ownProfile = await prisma.studentProfile.findUnique({
                where: { userId: req.user.id }
            });

            if (!ownProfile || ownProfile.id !== studentId) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only view your own results.'
                });
            }
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
        }

        const marks = await prisma.mark.findMany({
            where: {
                studentId,
                ...(req.user.role === 'STAFF' ? {
                    exam: {
                        subject: {
                            staff: {
                                userId: req.user.id
                            }
                        }
                    }
                } : {})
            },
            include: {
                exam: {
                    include: {
                        subject: true
                    }
                }
            },
            orderBy: {
                exam: { examDate: 'desc' }
            }
        });

        const results = marks.map(mark => ({
            markId: mark.id,
            exam: mark.exam.name,
            examType: mark.exam.type,
            subject: mark.exam.subject.name,
            score: mark.score,
            maxMarks: mark.exam.maxMarks,
            percentage: Number(
                ((mark.score / mark.exam.maxMarks) * 100).toFixed(2)
            ),
            remarks: mark.remarks
        }));

        const totalMarks = marks.reduce((sum, mark) => sum + mark.score, 0);
        const maximumMarks = marks.reduce((sum, mark) => sum + mark.exam.maxMarks, 0);

        res.json({
            success: true,
            summary: {
                totalExams: marks.length,
                totalMarks,
                maximumMarks,
                averagePercentage: maximumMarks
                    ? Number(((totalMarks / maximumMarks) * 100).toFixed(2))
                    : 0
            },
            data: results
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve student results.'
        });
    }
};

// UPDATE MARK
const updateMark = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const score = Number(req.body.score);

        if (!Number.isInteger(id) || id <= 0 ||
            req.body.score === undefined ||
            !Number.isFinite(score) || score < 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid mark ID and score are required.'
            });
        }

        const existing = await prisma.mark.findUnique({
            where: { id },
            include: { exam: true }
        });

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Mark record not found.'
            });
        }

        if (!(await canManageSubject(req.user, existing.exam.subjectId))) {
            return res.status(403).json({
                success: false,
                message: 'Access denied.'
            });
        }

        if (score > existing.exam.maxMarks) {
            return res.status(400).json({
                success: false,
                message: 'Score exceeds maximum marks.'
            });
        }

        const updated = await prisma.mark.update({
            where: { id },
            data: {
                score,
                remarks: req.body.remarks === undefined
                    ? existing.remarks
                    : (req.body.remarks || null)
            }
        });

        res.json({
            success: true,
            message: 'Marks updated successfully.',
            data: updated
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Failed to update marks.'
        });
    }
};

// DELETE MARK
const deleteMark = async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid mark ID.'
            });
        }

        const mark = await prisma.mark.findUnique({
            where: { id },
            include: { exam: true }
        });

        if (!mark) {
            return res.status(404).json({
                success: false,
                message: 'Mark record not found.'
            });
        }

        if (!(await canManageSubject(req.user, mark.exam.subjectId))) {
            return res.status(403).json({
                success: false,
                message: 'Access denied.'
            });
        }

        await prisma.mark.delete({ where: { id } });

        res.json({
            success: true,
            message: 'Mark deleted successfully.'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete mark.'
        });
    }
};

module.exports = {
    saveMark,
    getAllMarks,
    getStudentResults,
    updateMark,
    deleteMark
};