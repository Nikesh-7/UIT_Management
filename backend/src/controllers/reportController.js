const prisma = require('../config/database');

const getProfile = async (user) => {
    if (user.role === 'STUDENT') {
        return prisma.studentProfile.findUnique({
            where: { userId: user.id }
        });
    }

    if (user.role === 'STAFF') {
        return prisma.staffProfile.findUnique({
            where: { userId: user.id }
        });
    }

    return null;
};

// Dashboard statistics
const getDashboardReport = async (req, res) => {
    try {
        if (req.user.role === 'ADMIN') {
            const [
                students,
                staff,
                departments,
                subjects,
                assignments,
                attendanceRecords,
                presentRecords
            ] = await Promise.all([
                prisma.studentProfile.count(),
                prisma.staffProfile.count(),
                prisma.department.count(),
                prisma.subject.count(),
                prisma.assignment.count(),
                prisma.attendance.count(),
                prisma.attendance.count({
                    where: { status: 'PRESENT' }
                })
            ]);

            return res.json({
                success: true,
                data: {
                    totalStudents: students,
                    totalStaff: staff,
                    totalDepartments: departments,
                    totalSubjects: subjects,
                    totalAssignments: assignments,
                    totalAttendanceRecords: attendanceRecords,
                    presentAttendanceRecords: presentRecords,
                    attendancePercentage: attendanceRecords
                        ? Number(((presentRecords / attendanceRecords) * 100).toFixed(2))
                        : 0
                }
            });
        }

        if (req.user.role === 'STAFF') {
            const profile = await getProfile(req.user);

            if (!profile) {
                return res.status(404).json({
                    success: false,
                    message: 'Staff profile not found.'
                });
            }

            const [
                subjects,
                assignments,
                attendanceRecords,
                materials
            ] = await Promise.all([
                prisma.subject.count({
                    where: { staffId: profile.id }
                }),
                prisma.assignment.count({
                    where: { createdById: profile.id }
                }),
                prisma.attendance.count({
                    where: { subject: { staffId: profile.id } }
                }),
                prisma.studyMaterial.count({
                    where: { uploadedById: profile.id }
                })
            ]);

            return res.json({
                success: true,
                data: {
                    assignedSubjects: subjects,
                    createdAssignments: assignments,
                    attendanceRecords,
                    uploadedMaterials: materials
                }
            });
        }

        const profile = await getProfile(req.user);

        if (!profile) {
            return res.status(404).json({
                success: false,
                message: 'Student profile not found.'
            });
        }

        const [
            attendanceRecords,
            presentRecords,
            assignments,
            submissions,
            marks
        ] = await Promise.all([
            prisma.attendance.count({
                where: { studentId: profile.id }
            }),
            prisma.attendance.count({
                where: { studentId: profile.id, status: 'PRESENT' }
            }),
            prisma.assignment.count({
                where: {
                    subject: {
                        enrollments: { some: { studentId: profile.id } }
                    }
                }
            }),
            prisma.assignmentSubmission.count({
                where: { studentId: profile.id }
            }),
            prisma.mark.findMany({
                where: { studentId: profile.id },
                select: { score: true, exam: { select: { maxMarks: true } } }
            })
        ]);

        const totalMarks = marks.reduce((sum, item) => sum + item.score, 0);
        const maximumMarks = marks.reduce((sum, item) => sum + item.exam.maxMarks, 0);

        return res.json({
            success: true,
            data: {
                attendanceRecords,
                presentRecords,
                attendancePercentage: attendanceRecords
                    ? Number(((presentRecords / attendanceRecords) * 100).toFixed(2))
                    : 0,
                totalAssignments: assignments,
                submittedAssignments: submissions,
                totalMarks,
                maximumMarks,
                academicPercentage: maximumMarks
                    ? Number(((totalMarks / maximumMarks) * 100).toFixed(2))
                    : 0
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate dashboard report.'
        });
    }
};

// Student academic report
const getStudentReport = async (req, res) => {
    try {
        const studentId = Number(req.params.studentId);

        if (!Number.isInteger(studentId) || studentId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid student ID.'
            });
        }

        let profile;

        if (req.user.role === 'STUDENT') {
            profile = await getProfile(req.user);

            if (!profile || profile.id !== studentId) {
                return res.status(403).json({
                    success: false,
                    message: 'You can view only your own report.'
                });
            }
        } else {
            profile = await prisma.studentProfile.findUnique({
                where: { id: studentId },
                include: { user: true, department: true }
            });
        }

        if (!profile) {
            return res.status(404).json({
                success: false,
                message: 'Student not found.'
            });
        }

        if (req.user.role === 'STAFF') {
            const staff = await getProfile(req.user);

            if (!staff) {
                return res.status(404).json({
                    success: false,
                    message: 'Staff profile not found.'
                });
            }

            const assignedSubjects = await prisma.subject.findMany({
                where: { staffId: staff.id },
                select: { id: true }
            });

            const subjectIds = assignedSubjects.map(subject => subject.id);

            const enrollment = await prisma.enrollment.findFirst({
                where: {
                    studentId,
                    subjectId: { in: subjectIds }
                }
            });

            if (!enrollment) {
                return res.status(403).json({
                    success: false,
                    message: 'This student is not enrolled in your assigned subjects.'
                });
            }
        }

        const [
            student,
            attendance,
            marks,
            submissions
        ] = await Promise.all([
            prisma.studentProfile.findUnique({
                where: { id: studentId },
                include: {
                    user: { select: { id: true, name: true, email: true } },
                    department: true,
                    enrollments: { include: { subject: true } }
                }
            }),
            prisma.attendance.findMany({
                where: { studentId },
                include: { subject: true },
                orderBy: { attendanceDate: 'desc' }
            }),
            prisma.mark.findMany({
                where: { studentId },
                include: {
                    exam: {
                        include: { subject: true }
                    }
                }
            }),
            prisma.assignmentSubmission.findMany({
                where: { studentId },
                include: {
                    assignment: {
                        select: { id: true, title: true, dueDate: true }
                    }
                }
            })
        ]);

        const present = attendance.filter(
            record => record.status === 'PRESENT'
        ).length;

        const totalMarks = marks.reduce(
            (sum, item) => sum + item.score, 0
        );

        const maximumMarks = marks.reduce(
            (sum, item) => sum + item.exam.maxMarks, 0
        );

        res.json({
            success: true,
            data: {
                student,
                attendance: {
                    total: attendance.length,
                    present,
                    percentage: attendance.length
                        ? Number(((present / attendance.length) * 100).toFixed(2))
                        : 0,
                    records: attendance
                },
                academic: {
                    totalMarks,
                    maximumMarks,
                    percentage: maximumMarks
                        ? Number(((totalMarks / maximumMarks) * 100).toFixed(2))
                        : 0,
                    results: marks
                },
                submissions
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate student report.'
        });
    }
};

// Attendance report
const getAttendanceReport = async (req, res) => {
    try {
        const where = {};

        if (req.user.role === 'STUDENT') {
            const profile = await getProfile(req.user);

            if (!profile) {
                return res.status(404).json({
                    success: false,
                    message: 'Student profile not found.'
                });
            }

            where.studentId = profile.id;
        }

        if (req.user.role === 'STAFF') {
            const profile = await getProfile(req.user);

            if (!profile) {
                return res.status(404).json({
                    success: false,
                    message: 'Staff profile not found.'
                });
            }

            where.subject = { staffId: profile.id };
        }

        if (req.query.subjectId) {
            const subjectId = Number(req.query.subjectId);

            if (!Number.isInteger(subjectId) || subjectId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid subject ID.'
                });
            }

            where.subjectId = subjectId;
        }

        if (req.query.date) {
            const date = new Date(req.query.date);

            if (Number.isNaN(date.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid date.'
                });
            }

            const start = new Date(date);
            start.setHours(0, 0, 0, 0);

            const end = new Date(date);
            end.setHours(23, 59, 59, 999);

            where.attendanceDate = {
                gte: start,
                lte: end
            };
        }

        const records = await prisma.attendance.findMany({
            where,
            include: {
                student: {
                    include: {
                        user: { select: { name: true, email: true } }
                    }
                },
                subject: true
            },
            orderBy: { attendanceDate: 'desc' }
        });

        const summary = {
            total: records.length,
            present: records.filter(r => r.status === 'PRESENT').length,
            absent: records.filter(r => r.status === 'ABSENT').length,
            late: records.filter(r => r.status === 'LATE').length,
            leave: records.filter(r => r.status === 'LEAVE').length
        };

        res.json({
            success: true,
            summary,
            data: records
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate attendance report.'
        });
    }
};

// Examination report
const getExamReport = async (req, res) => {
    try {
        const where = {};

        if (req.user.role === 'STUDENT') {
            const profile = await getProfile(req.user);

            if (!profile) {
                return res.status(404).json({
                    success: false,
                    message: 'Student profile not found.'
                });
            }

            where.studentId = profile.id;
        }

        if (req.user.role === 'STAFF') {
            const profile = await getProfile(req.user);

            if (!profile) {
                return res.status(404).json({
                    success: false,
                    message: 'Staff profile not found.'
                });
            }

            where.exam = {
                subject: { staffId: profile.id }
            };
        }

        const marks = await prisma.mark.findMany({
            where,
            include: {
                student: {
                    include: {
                        user: { select: { name: true, email: true } }
                    }
                },
                exam: {
                    include: { subject: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({
            success: true,
            count: marks.length,
            data: marks.map(mark => ({
                id: mark.id,
                student: mark.student,
                exam: mark.exam,
                score: mark.score,
                maximumMarks: mark.exam.maxMarks,
                percentage: mark.exam.maxMarks
                    ? Number(((mark.score / mark.exam.maxMarks) * 100).toFixed(2))
                    : 0
            }))
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate examination report.'
        });
    }
};

// Assignment report
const getAssignmentReport = async (req, res) => {
    try {
        const where = {};

        if (req.user.role === 'STAFF') {
            const profile = await getProfile(req.user);

            if (!profile) {
                return res.status(404).json({
                    success: false,
                    message: 'Staff profile not found.'
                });
            }

            where.createdById = profile.id;
        }

        if (req.user.role === 'STUDENT') {
            const profile = await getProfile(req.user);

            if (!profile) {
                return res.status(404).json({
                    success: false,
                    message: 'Student profile not found.'
                });
            }

            where.subject = {
                enrollments: { some: { studentId: profile.id } }
            };
        }

        const assignments = await prisma.assignment.findMany({
            where,
            include: {
                subject: true,
                _count: { select: { submissions: true } },
                submissions: req.user.role === 'STUDENT'
                    ? { where: { studentId: (await getProfile(req.user)).id } }
                    : false
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({
            success: true,
            count: assignments.length,
            data: assignments.map(item => ({
                id: item.id,
                title: item.title,
                subject: item.subject,
                dueDate: item.dueDate,
                totalSubmissions: item._count.submissions,
                mySubmissionStatus: req.user.role === 'STUDENT'
                    ? item.submissions.length ? 'SUBMITTED' : 'NOT SUBMITTED'
                    : undefined
            }))
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate assignment report.'
        });
    }
};

module.exports = {
    getDashboardReport,
    getStudentReport,
    getAttendanceReport,
    getExamReport,
    getAssignmentReport
};
