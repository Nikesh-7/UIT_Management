const prisma = require('../config/database');

const getStudentProfile = async (userId) => {
    return prisma.studentProfile.findUnique({
        where: { userId }
    });
};

const getStaffProfile = async (userId) => {
    return prisma.staffProfile.findUnique({
        where: { userId }
    });
};

// Student submits or updates an assignment submission
const submitAssignment = async (req, res) => {
    try {
        const { assignmentId, content, fileUrl } = req.body;

        if (!Number.isInteger(Number(assignmentId)) || Number(assignmentId) <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid assignment ID is required.'
            });
        }

        if ((!content || !content.trim()) && (!fileUrl || !fileUrl.trim())) {
            return res.status(400).json({
                success: false,
                message: 'Provide submission content or a file URL.'
            });
        }

        const student = await getStudentProfile(req.user.id);

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student profile not found.'
            });
        }

        const assignment = await prisma.assignment.findUnique({
            where: { id: Number(assignmentId) }
        });

        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found.'
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

        const submission = await prisma.assignmentSubmission.upsert({
            where: {
                assignmentId_studentId: {
                    assignmentId: assignment.id,
                    studentId: student.id
                }
            },
            create: {
                assignmentId: assignment.id,
                studentId: student.id,
                content: content ? content.trim() : null,
                fileUrl: fileUrl ? fileUrl.trim() : null
            },
            update: {
                content: content ? content.trim() : null,
                fileUrl: fileUrl ? fileUrl.trim() : null,
                submittedAt: new Date()
            },
            include: {
                assignment: {
                    select: { id: true, title: true, dueDate: true }
                }
            }
        });

        res.status(201).json({
            success: true,
            message: 'Assignment submitted successfully.',
            data: submission
        });
    } catch (error) {
        console.error('Submit assignment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit assignment.'
        });
    }
};

// Student views their own submissions
const getMySubmissions = async (req, res) => {
    try {
        const student = await getStudentProfile(req.user.id);

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student profile not found.'
            });
        }

        const submissions = await prisma.assignmentSubmission.findMany({
            where: { studentId: student.id },
            include: {
                assignment: {
                    include: {
                        subject: {
                            select: { id: true, name: true, code: true }
                        }
                    }
                }
            },
            orderBy: { submittedAt: 'desc' }
        });

        res.json({
            success: true,
            count: submissions.length,
            data: submissions
        });
    } catch (error) {
        console.error('Get my submissions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve submissions.'
        });
    }
};

// Staff/admin views submissions for an assignment
const getAssignmentSubmissions = async (req, res) => {
    try {
        const assignmentId = Number(req.params.assignmentId);

        if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid assignment ID.'
            });
        }

        const assignment = await prisma.assignment.findUnique({
            where: { id: assignmentId }
        });

        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found.'
            });
        }

        if (req.user.role === 'STAFF') {
            const staff = await getStaffProfile(req.user.id);

            if (!staff || assignment.createdById !== staff.id) {
                return res.status(403).json({
                    success: false,
                    message: 'You cannot access this assignment.'
                });
            }
        }

        const submissions = await prisma.assignmentSubmission.findMany({
            where: { assignmentId },
            include: {
                student: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true }
                        }
                    }
                }
            },
            orderBy: { submittedAt: 'desc' }
        });

        res.json({
            success: true,
            count: submissions.length,
            data: submissions
        });
    } catch (error) {
        console.error('Get assignment submissions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve assignment submissions.'
        });
    }
};

// Staff/admin grades a submission
const gradeSubmission = async (req, res) => {
    try {
        const submissionId = Number(req.params.id);
        const { marks, feedback } = req.body;

        if (!Number.isInteger(submissionId) || submissionId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid submission ID.'
            });
        }

        if (marks === undefined || marks === null ||
            !Number.isFinite(Number(marks)) || Number(marks) < 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid non-negative marks are required.'
            });
        }

        const submission = await prisma.assignmentSubmission.findUnique({
            where: { id: submissionId },
            include: {
                assignment: {
                    include: { subject: true }
                }
            }
        });

        if (!submission) {
            return res.status(404).json({
                success: false,
                message: 'Submission not found.'
            });
        }

        if (req.user.role === 'STAFF') {
            const staff = await getStaffProfile(req.user.id);

            if (!staff || submission.assignment.subject.staffId !== staff.id) {
                return res.status(403).json({
                    success: false,
                    message: 'You cannot grade this submission.'
                });
            }
        }

        const updated = await prisma.assignmentSubmission.update({
            where: { id: submissionId },
            data: {
                marks: Number(marks),
                feedback: feedback || null
            }
        });

        res.json({
            success: true,
            message: 'Submission graded successfully.',
            data: updated
        });
    } catch (error) {
        console.error('Grade submission:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to grade submission.'
        });
    }
};

module.exports = {
    submitAssignment,
    getMySubmissions,
    getAssignmentSubmissions,
    gradeSubmission
};
