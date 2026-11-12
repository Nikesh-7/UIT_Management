const prisma = require('../config/database');

const VALID_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'LEAVE'];

function parseDate(value) {
    if (!value) return new Date().toISOString().slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

    const date = new Date(`${value}T00:00:00.000Z`);

    return date.toISOString().slice(0, 10) === value ? date : null;
}

function validId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

async function checkSubjectPermission(req, subjectId) {
    if (req.user.role === 'ADMIN') return true;

    if (req.user.role !== 'STAFF') return false;

    const staff = await prisma.staffProfile.findUnique({
        where: { userId: req.user.id }
    });

    if (!staff) return false;

    const subject = await prisma.subject.findUnique({
        where: { id: subjectId },
        select: { staffId: true }
    });

    return subject && subject.staffId === staff.id;
}

// MARK ATTENDANCE
const markAttendance = async (req, res) => {
    try {
        const studentId = validId(req.body.studentId);
        const subjectId = validId(req.body.subjectId);
        const attendanceDate = parseDate(req.body.attendanceDate);
        const status = req.body.status;

        if (!studentId || !subjectId || !attendanceDate ||
            !VALID_STATUSES.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Valid studentId, subjectId, date and status are required.'
            });
        }

        if (!(await checkSubjectPermission(req, subjectId))) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to manage this subject.'
            });
        }

        const [student, subject] = await Promise.all([
            prisma.studentProfile.findUnique({ where: { id: studentId } }),
            prisma.subject.findUnique({ where: { id: subjectId } })
        ]);

        if (!student || !subject) {
            return res.status(404).json({
                success: false,
                message: 'Student or subject not found.'
            });
        }

        const date = new Date(attendanceDate);

        const attendance = await prisma.attendance.upsert({
            where: {
                studentId_subjectId_attendanceDate: {
                    studentId,
                    subjectId,
                    attendanceDate: date
                }
            },
            update: {
                status,
                remarks: req.body.remarks || null
            },
            create: {
                studentId,
                subjectId,
                attendanceDate: date,
                status,
                remarks: req.body.remarks || null
            }
        });

        res.status(200).json({
            success: true,
            message: 'Attendance saved successfully.',
            data: attendance
        });
    } catch (error) {
        console.error('Mark attendance error:', error);
        res.status(500).json({
            success: false,
            message: 'Unable to save attendance.'
        });
    }
};

// BULK ATTENDANCE
const markBulkAttendance = async (req, res) => {
    try {
        const subjectId = validId(req.body.subjectId);
        const attendanceDate = parseDate(req.body.attendanceDate);
        const records = req.body.records;

        if (!subjectId || !attendanceDate ||
            !Array.isArray(records) || records.length === 0 ||
            records.length > 500) {
            return res.status(400).json({
                success: false,
                message: 'Valid subject, date and 1-500 attendance records are required.'
            });
        }

        if (!(await checkSubjectPermission(req, subjectId))) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to manage this subject.'
            });
        }

        const ids = records.map(record => validId(record.studentId));

        if (ids.some(id => !id) ||
            new Set(ids).size !== ids.length ||
            records.some(record => !VALID_STATUSES.includes(record.status))) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or duplicate student IDs or attendance statuses.'
            });
        }

        const students = await prisma.studentProfile.findMany({
            where: { id: { in: ids } },
            select: { id: true }
        });

        if (students.length !== ids.length) {
            return res.status(400).json({
                success: false,
                message: 'One or more students do not exist.'
            });
        }

        const date = new Date(attendanceDate);

        const results = await prisma.$transaction(
            records.map(record =>
                prisma.attendance.upsert({
                    where: {
                        studentId_subjectId_attendanceDate: {
                            studentId: Number(record.studentId),
                            subjectId,
                            attendanceDate: date
                        }
                    },
                    update: {
                        status: record.status,
                        remarks: record.remarks || null
                    },
                    create: {
                        studentId: Number(record.studentId),
                        subjectId,
                        attendanceDate: date,
                        status: record.status,
                        remarks: record.remarks || null
                    }
                })
            )
        );

        res.status(200).json({
            success: true,
            message: 'Bulk attendance saved successfully.',
            count: results.length,
            data: results
        });
    } catch (error) {
        console.error('Bulk attendance error:', error);
        res.status(500).json({
            success: false,
            message: 'Unable to save bulk attendance.'
        });
    }
};

// GET ALL ATTENDANCE WITH FILTERS
const getAllAttendance = async (req, res) => {
    try {
        const where = {};

        if (req.query.studentId) {
            const id = validId(req.query.studentId);
            if (!id) return res.status(400).json({ success: false, message: 'Invalid student ID.' });
            where.studentId = id;
        }

        if (req.query.subjectId) {
            const id = validId(req.query.subjectId);
            if (!id) return res.status(400).json({ success: false, message: 'Invalid subject ID.' });
            where.subjectId = id;

            if (!(await checkSubjectPermission(req, id))) {
                return res.status(403).json({ success: false, message: 'Access denied.' });
            }
        } else if (req.user.role === 'STAFF') {
            const staff = await prisma.staffProfile.findUnique({
                where: { userId: req.user.id },
                select: { id: true }
            });

            if (!staff) return res.status(403).json({ success: false, message: 'Staff profile not found.' });

            where.subject = { staffId: staff.id };
        }

        if (req.query.date) {
            const date = parseDate(req.query.date);
            if (!date) return res.status(400).json({ success: false, message: 'Invalid date.' });

            where.attendanceDate = new Date(date);
        }

        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

        const [data, total] = await Promise.all([
            prisma.attendance.findMany({
                where,
                include: {
                    student: {
                        include: {
                            user: { select: { id: true, name: true, email: true } }
                        }
                    },
                    subject: {
                        select: { id: true, name: true, code: true }
                    }
                },
                orderBy: { attendanceDate: 'desc' },
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma.attendance.count({ where })
        ]);

        res.json({
            success: true,
            count: data.length,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            data
        });
    } catch (error) {
        console.error('Get attendance error:', error);
        res.status(500).json({ success: false, message: 'Unable to retrieve attendance.' });
    }
};

// GET ATTENDANCE BY STUDENT
const getStudentAttendance = async (req, res) => {
    try {
        const studentId = validId(req.params.studentId);

        if (!studentId) {
            return res.status(400).json({ success: false, message: 'Invalid student ID.' });
        }

        if (req.user.role === 'STUDENT') {
            const profile = await prisma.studentProfile.findUnique({
                where: { userId: req.user.id },
                select: { id: true }
            });

            if (!profile || profile.id !== studentId) {
                return res.status(403).json({ success: false, message: 'You can only view your own attendance.' });
            }
        } else if (req.user.role === 'STAFF') {
            const staff = await prisma.staffProfile.findUnique({
                where: { userId: req.user.id },
                select: { id: true }
            });

            if (!staff) return res.status(403).json({ success: false, message: 'Staff profile not found.' });
        }

        const where = { studentId };

        if (req.user.role === 'STAFF') {
            const staff = await prisma.staffProfile.findUnique({
                where: { userId: req.user.id },
                select: { id: true }
            });

            where.subject = { staffId: staff.id };
        }

        const records = await prisma.attendance.findMany({
            where,
            include: {
                subject: { select: { id: true, name: true, code: true } }
            },
            orderBy: { attendanceDate: 'desc' }
        });

        const total = records.length;
        const present = records.filter(r =>
            r.status === 'PRESENT' || r.status === 'LATE'
        ).length;

        res.json({
            success: true,
            summary: {
                total,
                present,
                absent: records.filter(r => r.status === 'ABSENT').length,
                late: records.filter(r => r.status === 'LATE').length,
                leave: records.filter(r => r.status === 'LEAVE').length,
                percentage: total ? Number(((present / total) * 100).toFixed(2)) : 0
            },
            data: records
        });
    } catch (error) {
        console.error('Student attendance error:', error);
        res.status(500).json({ success: false, message: 'Unable to retrieve student attendance.' });
    }
};

// GET ATTENDANCE BY SUBJECT
const getSubjectAttendance = async (req, res) => {
    try {
        const subjectId = validId(req.params.subjectId);

        if (!subjectId) {
            return res.status(400).json({ success: false, message: 'Invalid subject ID.' });
        }

        if (!(await checkSubjectPermission(req, subjectId))) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }

        const records = await prisma.attendance.findMany({
            where: { subjectId },
            include: {
                student: {
                    include: {
                        user: { select: { id: true, name: true, email: true } }
                    }
                }
            },
            orderBy: { attendanceDate: 'desc' }
        });

        res.json({
            success: true,
            count: records.length,
            data: records
        });
    } catch (error) {
        console.error('Subject attendance error:', error);
        res.status(500).json({ success: false, message: 'Unable to retrieve subject attendance.' });
    }
};

// UPDATE ATTENDANCE
const updateAttendance = async (req, res) => {
    try {
        const id = validId(req.params.id);
        const { status, remarks } = req.body;

        if (!id || !VALID_STATUSES.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Valid attendance ID and status are required.'
            });
        }

        const existing = await prisma.attendance.findUnique({ where: { id } });

        if (!existing) {
            return res.status(404).json({ success: false, message: 'Attendance record not found.' });
        }

        if (!(await checkSubjectPermission(req, existing.subjectId))) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }

        const updated = await prisma.attendance.update({
            where: { id },
            data: {
                status,
                ...(remarks !== undefined ? { remarks } : {})
            }
        });

        res.json({
            success: true,
            message: 'Attendance updated successfully.',
            data: updated
        });
    } catch (error) {
        console.error('Update attendance error:', error);
        res.status(500).json({ success: false, message: 'Unable to update attendance.' });
    }
};

// ATTENDANCE SUMMARY REPORT
const getAttendanceReport = async (req, res) => {
    try {
        const where = {};

        if (req.query.subjectId) {
            const subjectId = validId(req.query.subjectId);

            if (!subjectId) {
                return res.status(400).json({ success: false, message: 'Invalid subject ID.' });
            }

            if (!(await checkSubjectPermission(req, subjectId))) {
                return res.status(403).json({ success: false, message: 'Access denied.' });
            }

            where.subjectId = subjectId;
        } else if (req.user.role === 'STAFF') {
            const staff = await prisma.staffProfile.findUnique({
                where: { userId: req.user.id },
                select: { id: true }
            });

            if (!staff) return res.status(403).json({ success: false, message: 'Staff profile not found.' });

            where.subject = { staffId: staff.id };
        }

        if (req.query.from || req.query.to) {
            const from = req.query.from ? parseDate(req.query.from) : '2000-01-01';
            const to = req.query.to ? parseDate(req.query.to) : new Date().toISOString().slice(0, 10);

            if (!from || !to || from > to) {
                return res.status(400).json({ success: false, message: 'Invalid date range.' });
            }

            where.attendanceDate = {
                gte: new Date(from),
                lte: new Date(to)
            };
        }

        const records = await prisma.attendance.findMany({ where });

        const total = records.length;
        const count = status => records.filter(r => r.status === status).length;
        const present = count('PRESENT') + count('LATE');

        res.json({
            success: true,
            data: {
                totalRecords: total,
                present: count('PRESENT'),
                absent: count('ABSENT'),
                late: count('LATE'),
                leave: count('LEAVE'),
                attendancePercentage: total
                    ? Number(((present / total) * 100).toFixed(2))
                    : 0
            }
        });
    } catch (error) {
        console.error('Attendance report error:', error);
        res.status(500).json({ success: false, message: 'Unable to generate attendance report.' });
    }
};

// DELETE ATTENDANCE (ADMIN ONLY)
const deleteAttendance = async (req, res) => {
    try {
        const id = validId(req.params.id);

        if (!id) return res.status(400).json({ success: false, message: 'Invalid attendance ID.' });

        const existing = await prisma.attendance.findUnique({ where: { id } });

        if (!existing) {
            return res.status(404).json({ success: false, message: 'Attendance record not found.' });
        }

        await prisma.attendance.delete({ where: { id } });

        res.json({ success: true, message: 'Attendance record deleted successfully.' });
    } catch (error) {
        console.error('Delete attendance error:', error);
        res.status(500).json({ success: false, message: 'Unable to delete attendance.' });
    }
};

module.exports = {
    markAttendance,
    markBulkAttendance,
    getAllAttendance,
    getStudentAttendance,
    getSubjectAttendance,
    updateAttendance,
    getAttendanceReport,
    deleteAttendance
};
