const prisma = require('../config/database');

// CREATE STUDENT
const createStudent = async (req, res) => {
    try {
        const {
            name,
            email,
            password,
            rollNumber,
            admissionYear,
            year,
            section,
            phone,
            address,
            departmentId
        } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Name, email and password are required'
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must contain at least 8 characters'
            });
        }

        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'Email already registered'
            });
        }

        const passwordHash = await require('bcryptjs').hash(password, 12);

        const student = await prisma.user.create({
            data: {
                name,
                email,
                passwordHash,
                role: 'STUDENT',
                studentProfile: {
                    create: {
                        rollNumber: rollNumber || null,
                        admissionYear: admissionYear ? Number(admissionYear) : null,
                        year: year ? Number(year) : null,
                        section: section || null,
                        phone: phone || null,
                        address: address || null,
                        departmentId: departmentId
                            ? Number(departmentId)
                            : null
                    }
                }
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                studentProfile: true
            }
        });

        res.status(201).json({
            success: true,
            message: 'Student created successfully',
            data: student
        });

    } catch (error) {
        console.error('Create student error:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to create student'
        });
    }
};


// GET ALL STUDENTS
const getAllStudents = async (req, res) => {
    try {
        const {
            search,
            departmentId,
            year,
            page = 1,
            limit = 20
        } = req.query;

        const pageNumber = Math.max(1, Number(page) || 1);
        const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));

        const where = {
            role: 'STUDENT',
            ...(search && {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    {
                        studentProfile: {
                            rollNumber: {
                                contains: search,
                                mode: 'insensitive'
                            }
                        }
                    }
                ]
            }),
            ...(departmentId && {
                studentProfile: {
                    departmentId: Number(departmentId)
                }
            }),
            ...(year && {
                studentProfile: {
                    year: Number(year)
                }
            })
        };

        // Staff can view only students enrolled in subjects assigned to them.
        if (req.user.role === 'STAFF') {
            const staff = await prisma.staffProfile.findUnique({ where: { userId: req.user.id } });
            if (!staff) {
                return res.status(403).json({ success: false, message: 'Staff profile not found.' });
            }
            where.studentProfile = {
                enrollments: { some: { subject: { staffId: staff.id } } }
            };
        }

        const [students, total] = await Promise.all([
            prisma.user.findMany({
                where,
                select: {
                    id: true,
                    name: true,
                    email: true,
                    createdAt: true,
                    studentProfile: req.user.role === 'ADMIN'
                        ? { include: { department: true } }
                        : {
                            select: {
                                id: true,
                                rollNumber: true,
                                admissionYear: true,
                                year: true,
                                section: true,
                                departmentId: true,
                                department: { select: { id: true, name: true, code: true } }
                            }
                        }
                },
                orderBy: { id: 'desc' },
                skip: (pageNumber - 1) * pageSize,
                take: pageSize
            }),
            prisma.user.count({ where })
        ]);

        res.json({
            success: true,
            data: students,
            pagination: {
                total,
                page: pageNumber,
                limit: pageSize,
                totalPages: Math.ceil(total / pageSize)
            }
        });

    } catch (error) {
        console.error('Get students error:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to retrieve students'
        });
    }
};


// GET STUDENT BY ID
const getStudentById = async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid student ID'
            });
        }

        const student = await prisma.user.findFirst({
            where: {
                id,
                role: 'STUDENT'
            },
            select: {
                id: true,
                name: true,
                email: true,
                createdAt: true,
                studentProfile: {
                    include: {
                        department: true
                    }
                }
            }
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        res.json({
            success: true,
            data: student
        });

    } catch (error) {
        console.error('Get student error:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to retrieve student'
        });
    }
};


// UPDATE STUDENT
const updateStudent = async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid student ID'
            });
        }

        const {
            name,
            email,
            rollNumber,
            admissionYear,
            year,
            section,
            phone,
            address,
            departmentId
        } = req.body;

        const existingStudent = await prisma.user.findFirst({
            where: { id, role: 'STUDENT' }
        });

        if (!existingStudent) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        if (email && email !== existingStudent.email) {
            const emailExists = await prisma.user.findUnique({
                where: { email }
            });

            if (emailExists) {
                return res.status(409).json({
                    success: false,
                    message: 'Email already in use'
                });
            }
        }

        const updatedStudent = await prisma.user.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(email !== undefined && { email }),
                studentProfile: {
                    upsert: {
                        create: {
                            rollNumber: rollNumber || null,
                            admissionYear: admissionYear ? Number(admissionYear) : null,
                            year: year ? Number(year) : null,
                            section: section || null,
                            phone: phone || null,
                            address: address || null,
                            departmentId: departmentId
                                ? Number(departmentId)
                                : null
                        },
                        update: {
                            ...(rollNumber !== undefined && { rollNumber }),
                            ...(admissionYear !== undefined && {
                                admissionYear: admissionYear === null
                                    ? null
                                    : Number(admissionYear)
                            }),
                            ...(year !== undefined && {
                                year: year === null ? null : Number(year)
                            }),
                            ...(section !== undefined && { section }),
                            ...(phone !== undefined && { phone }),
                            ...(address !== undefined && { address }),
                            ...(departmentId !== undefined && {
                                departmentId: departmentId === null
                                    ? null
                                    : Number(departmentId)
                            })
                        }
                    }
                }
            },
            select: {
                id: true,
                name: true,
                email: true,
                studentProfile: true
            }
        });

        res.json({
            success: true,
            message: 'Student updated successfully',
            data: updatedStudent
        });

    } catch (error) {
        console.error('Update student error:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to update student'
        });
    }
};


// DELETE STUDENT
const deleteStudent = async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid student ID'
            });
        }

        const student = await prisma.user.findFirst({
            where: { id, role: 'STUDENT' }
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        await prisma.user.delete({
            where: { id }
        });

        res.json({
            success: true,
            message: 'Student deleted successfully'
        });

    } catch (error) {
        console.error('Delete student error:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to delete student'
        });
    }
};


module.exports = {
    createStudent,
    getAllStudents,
    getStudentById,
    updateStudent,
    deleteStudent
};