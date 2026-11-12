const prisma = require('../config/database');

const createAssignment = async (req, res) => {
    try {
        const { title, description, subjectId, dueDate } = req.body;

        if (!title || !subjectId || !dueDate) {
            return res.status(400).json({
                success: false,
                message: 'Title, subjectId and dueDate are required.'
            });
        }

        const parsedSubjectId = Number(subjectId);
        const parsedDate = new Date(dueDate);

        if (!Number.isInteger(parsedSubjectId) || parsedSubjectId <= 0 ||
            isNaN(parsedDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid subjectId or dueDate.'
            });
        }

        const staff = await prisma.staffProfile.findUnique({
            where: { userId: req.user.id }
        });

        if (!staff) {
            return res.status(403).json({
                success: false,
                message: 'A staff profile is required to create assignments.'
            });
        }

        const subject = await prisma.subject.findUnique({
            where: { id: parsedSubjectId }
        });

        if (!subject) {
            return res.status(404).json({
                success: false,
                message: 'Subject not found.'
            });
        }

        if (subject.staffId !== staff.id) {
            return res.status(403).json({
                success: false,
                message: 'You can create assignments only for your assigned subjects.'
            });
        }

        const assignment = await prisma.assignment.create({
            data: {
                title: title.trim(),
                description,
                subjectId: parsedSubjectId,
                createdById: staff.id,
                dueDate: parsedDate
            },
            include: {
                subject: true,
                createdBy: {
                    include: { user: { select: { name: true, email: true } } }
                }
            }
        });

        return res.status(201).json({
            success: true,
            message: 'Assignment created successfully.',
            data: assignment
        });
    } catch (error) {
        console.error('Create assignment:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create assignment.'
        });
    }
};

const getAllAssignments = async (req, res) => {
    try {
        const where = {};
        const subjectId = req.query.subjectId
            ? Number(req.query.subjectId)
            : undefined;

        if (subjectId !== undefined) {
            if (!Number.isInteger(subjectId) || subjectId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid subjectId.'
                });
            }
            where.subjectId = subjectId;
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
                enrollments: { some: { studentId: student.id } }
            };
        }

        const assignments = await prisma.assignment.findMany({
            where,
            include: {
                subject: true,
                createdBy: {
                    include: { user: { select: { name: true } } }
                }
            },
            orderBy: { dueDate: 'asc' }
        });

        return res.json({
            success: true,
            count: assignments.length,
            data: assignments
        });
    } catch (error) {
        console.error('Get assignments:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve assignments.'
        });
    }
};

const getAssignmentById = async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid assignment ID.'
            });
        }

        const assignment = await prisma.assignment.findUnique({
            where: { id },
            include: {
                subject: true,
                createdBy: {
                    include: { user: { select: { name: true } } }
                }
            }
        });

        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found.'
            });
        }

        if (req.user.role === 'STAFF') {
            const staff = await prisma.staffProfile.findUnique({
                where: { userId: req.user.id }
            });

            if (!staff || assignment.subject.staffId !== staff.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied.'
                });
            }
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

            const enrollment = await prisma.enrollment.findUnique({
                where: {
                    studentId_subjectId: {
                        studentId: student.id,
                        subjectId: assignment.subjectId
                    }
                }
            });

            if (!enrollment) {
                return res.status(403).json({
                    success: false,
                    message: 'You are not enrolled in this subject.'
                });
            }
        }

        return res.json({
            success: true,
            data: assignment
        });
    } catch (error) {
        console.error('Get assignment:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve assignment.'
        });
    }
};

const updateAssignment = async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid assignment ID.'
            });
        }

        const existing = await prisma.assignment.findUnique({
            where: { id },
            include: { subject: true }
        });

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found.'
            });
        }

        if (req.user.role === 'STAFF') {
            const staff = await prisma.staffProfile.findUnique({
                where: { userId: req.user.id }
            });

            if (!staff || existing.subject.staffId !== staff.id) {
                return res.status(403).json({
                    success: false,
                    message: 'You can update only your own subject assignments.'
                });
            }
        }

        const data = {};

        if (req.body.title !== undefined) {
            if (typeof req.body.title !== 'string' || !req.body.title.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Title cannot be empty.'
                });
            }
            data.title = req.body.title.trim();
        }

        if (req.body.description !== undefined) {
            data.description = req.body.description;
        }

        if (req.body.dueDate !== undefined) {
            const date = new Date(req.body.dueDate);

            if (isNaN(date.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid dueDate.'
                });
            }

            data.dueDate = date;
        }

        const updated = await prisma.assignment.update({
            where: { id },
            data,
            include: { subject: true }
        });

        return res.json({
            success: true,
            message: 'Assignment updated successfully.',
            data: updated
        });
    } catch (error) {
        console.error('Update assignment:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update assignment.'
        });
    }
};

const deleteAssignment = async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid assignment ID.'
            });
        }

        const existing = await prisma.assignment.findUnique({
            where: { id },
            include: { subject: true }
        });

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found.'
            });
        }

        if (req.user.role === 'STAFF') {
            const staff = await prisma.staffProfile.findUnique({
                where: { userId: req.user.id }
            });

            if (!staff || existing.subject.staffId !== staff.id) {
                return res.status(403).json({
                    success: false,
                    message: 'You can delete only your own subject assignments.'
                });
            }
        }

        await prisma.assignment.delete({ where: { id } });

        return res.json({
            success: true,
            message: 'Assignment deleted successfully.'
        });
    } catch (error) {
        console.error('Delete assignment:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete assignment.'
        });
    }
};

module.exports = {
    createAssignment,
    getAllAssignments,
    getAssignmentById,
    updateAssignment,
    deleteAssignment
};
