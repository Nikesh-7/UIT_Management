const prisma = require('../config/database');
const bcrypt = require('bcryptjs');

const staffSelect = {
    id: true,
    name: true,
    email: true,
    role: true,
    createdAt: true,
    staffProfile: {
        include: {
            department: true
        }
    }
};

// CREATE STAFF
const createStaff = async (req, res) => {
    try {
        const {
            name,
            email,
            password,
            employeeCode,
            designation,
            phone,
            departmentId
        } = req.body;

        if (!name?.trim() || !email?.trim() || !password ||
            !employeeCode?.trim() || !departmentId) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, password, employee code and department are required'
            });
        }

        if (password.length < 12) {
            return res.status(400).json({
                success: false,
                message: 'Password must contain at least 12 characters'
            });
        }

        const cleanEmail = email.trim().toLowerCase();
        const cleanCode = employeeCode.trim();

        const existingUser = await prisma.user.findUnique({
            where: { email: cleanEmail }
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'Email already registered'
            });
        }

        const existingCode = await prisma.staffProfile.findFirst({
            where: { employeeCode: cleanCode }
        });

        if (existingCode) {
            return res.status(409).json({
                success: false,
                message: 'Employee code already registered'
            });
        }

        const department = await prisma.department.findUnique({
            where: { id: Number(departmentId) }
        });

        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found'
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const staff = await prisma.user.create({
            data: {
                name: name.trim(),
                email: cleanEmail,
                passwordHash,
                role: 'STAFF',
                staffProfile: {
                    create: {
                        employeeCode: cleanCode,
                        designation: designation?.trim() || null,
                        phone: phone?.trim() || null,
                        departmentId: Number(departmentId)
                    }
                }
            },
            select: staffSelect
        });

        return res.status(201).json({
            success: true,
            message: 'Staff created successfully',
            data: staff
        });

    } catch (error) {
        console.error('Create staff error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to create staff'
        });
    }
};


// GET ALL STAFF
const getAllStaff = async (req, res) => {
    try {
        const staff = await prisma.user.findMany({
            where: { role: 'STAFF' },
            select: staffSelect,
            orderBy: { id: 'desc' }
        });

        return res.json({
            success: true,
            count: staff.length,
            data: staff
        });

    } catch (error) {
        console.error('Get staff error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve staff'
        });
    }
};


// GET STAFF BY ID
const getStaffById = async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid staff ID'
            });
        }

        const staff = await prisma.user.findFirst({
            where: {
                id,
                role: 'STAFF'
            },
            select: staffSelect
        });

        if (!staff) {
            return res.status(404).json({
                success: false,
                message: 'Staff not found'
            });
        }

        return res.json({
            success: true,
            data: staff
        });

    } catch (error) {
        console.error('Get staff error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve staff'
        });
    }
};


// UPDATE STAFF
const updateStaff = async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid staff ID'
            });
        }

        const {
            name,
            email,
            employeeCode,
            designation,
            phone,
            departmentId
        } = req.body;

        const existingStaff = await prisma.user.findFirst({
            where: { id, role: 'STAFF' },
            include: { staffProfile: true }
        });

        if (!existingStaff) {
            return res.status(404).json({
                success: false,
                message: 'Staff not found'
            });
        }

        if (email !== undefined) {
            const cleanEmail = email.trim().toLowerCase();

            const emailExists = await prisma.user.findFirst({
                where: {
                    email: cleanEmail,
                    id: { not: id }
                }
            });

            if (emailExists) {
                return res.status(409).json({
                    success: false,
                    message: 'Email already in use'
                });
            }
        }

        if (employeeCode !== undefined) {
            const codeExists = await prisma.staffProfile.findFirst({
                where: {
                    employeeCode: employeeCode.trim(),
                    userId: { not: id }
                }
            });

            if (codeExists) {
                return res.status(409).json({
                    success: false,
                    message: 'Employee code already in use'
                });
            }
        }

        if (departmentId !== undefined && departmentId !== null) {
            const department = await prisma.department.findUnique({
                where: { id: Number(departmentId) }
            });

            if (!department) {
                return res.status(404).json({
                    success: false,
                    message: 'Department not found'
                });
            }
        }

        const updatedStaff = await prisma.user.update({
            where: { id },
            data: {
                ...(name !== undefined && { name: name.trim() }),
                ...(email !== undefined && {
                    email: email.trim().toLowerCase()
                }),
                staffProfile: {
                    update: {
                        ...(employeeCode !== undefined && {
                            employeeCode: employeeCode.trim()
                        }),
                        ...(designation !== undefined && {
                            designation
                        }),
                        ...(phone !== undefined && { phone }),
                        ...(departmentId !== undefined && {
                            departmentId: departmentId === null
                                ? null
                                : Number(departmentId)
                        })
                    }
                }
            },
            select: staffSelect
        });

        return res.json({
            success: true,
            message: 'Staff updated successfully',
            data: updatedStaff
        });

    } catch (error) {
        console.error('Update staff error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to update staff'
        });
    }
};


// DELETE STAFF
const deleteStaff = async (req, res) => {
    try {
        const id = Number(req.params.id);

        const staff = await prisma.user.findFirst({
            where: { id, role: 'STAFF' }
        });

        if (!staff) {
            return res.status(404).json({
                success: false,
                message: 'Staff not found'
            });
        }

        await prisma.user.delete({
            where: { id }
        });

        return res.json({
            success: true,
            message: 'Staff deleted successfully'
        });

    } catch (error) {
        console.error('Delete staff error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to delete staff'
        });
    }
};


module.exports = {
    createStaff,
    getAllStaff,
    getStaffById,
    updateStaff,
    deleteStaff
};
