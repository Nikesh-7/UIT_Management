const prisma = require('../config/database');

const createDepartment = async (req, res) => {
    try {
        const { name, code, description } = req.body;

        if (!name || !code) {
            return res.status(400).json({
                success: false,
                message: 'Department name and code are required.'
            });
        }

        const existing = await prisma.department.findFirst({
            where: {
                OR: [
                    { name: { equals: name, mode: 'insensitive' } },
                    { code: { equals: code, mode: 'insensitive' } }
                ]
            }
        });

        if (existing) {
            return res.status(409).json({
                success: false,
                message: 'Department name or code already exists.'
            });
        }

        const department = await prisma.department.create({
            data: {
                name: name.trim(),
                code: code.trim().toUpperCase(),
                description: description || null
            }
        });

        res.status(201).json({
            success: true,
            message: 'Department created successfully.',
            data: department
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Unable to create department.'
        });
    }
};

const getAllDepartments = async (req, res) => {
    try {
        const departments = await prisma.department.findMany({
            include: {
                _count: {
                    select: {
                        students: true,
                        staff: true,
                        subjects: true
                    }
                }
            },
            orderBy: { name: 'asc' }
        });

        res.json({
            success: true,
            count: departments.length,
            data: departments
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Unable to fetch departments.'
        });
    }
};

const getDepartmentById = async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid department ID.'
            });
        }

        const department = await prisma.department.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        students: true,
                        staff: true,
                        subjects: true
                    }
                }
            }
        });

        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found.'
            });
        }

        res.json({ success: true, data: department });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Unable to fetch department.'
        });
    }
};

const updateDepartment = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { name, code, description } = req.body;

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid department ID.'
            });
        }

        const existing = await prisma.department.findUnique({
            where: { id }
        });

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Department not found.'
            });
        }

        if (name !== undefined || code !== undefined) {
            const duplicate = await prisma.department.findFirst({
                where: {
                    id: { not: id },
                    OR: [
                        ...(name ? [{ name: { equals: name, mode: 'insensitive' } }] : []),
                        ...(code ? [{ code: { equals: code, mode: 'insensitive' } }] : [])
                    ]
                }
            });

            if (duplicate) {
                return res.status(409).json({
                    success: false,
                    message: 'Department name or code already exists.'
                });
            }
        }

        const updated = await prisma.department.update({
            where: { id },
            data: {
                ...(name !== undefined && { name: name.trim() }),
                ...(code !== undefined && { code: code.trim().toUpperCase() }),
                ...(description !== undefined && { description })
            }
        });

        res.json({
            success: true,
            message: 'Department updated successfully.',
            data: updated
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Unable to update department.'
        });
    }
};

const deleteDepartment = async (req, res) => {
    try {
        const id = Number(req.params.id);

        const department = await prisma.department.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        students: true,
                        staff: true,
                        subjects: true
                    }
                }
            }
        });

        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found.'
            });
        }

        const count = department._count;

        if (count.students || count.staff || count.subjects) {
            return res.status(409).json({
                success: false,
                message: 'Cannot delete a department that has students, staff or subjects.'
            });
        }

        await prisma.department.delete({ where: { id } });

        res.json({
            success: true,
            message: 'Department deleted successfully.'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Unable to delete department.'
        });
    }
};

module.exports = {
    createDepartment,
    getAllDepartments,
    getDepartmentById,
    updateDepartment,
    deleteDepartment
};