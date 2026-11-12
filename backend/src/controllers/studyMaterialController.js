const prisma = require('../config/database');

const createMaterial = async (req, res) => {
    try {
        const { title, description, fileUrl, subjectId } = req.body;

        if (!title || !fileUrl || !subjectId) {
            return res.status(400).json({
                success: false,
                message: 'Title, fileUrl and subjectId are required.'
            });
        }

        const subject = await prisma.subject.findUnique({
            where: { id: Number(subjectId) }
        });

        if (!subject) {
            return res.status(404).json({
                success: false,
                message: 'Subject not found.'
            });
        }

        const staff = await prisma.staffProfile.findUnique({
            where: { userId: req.user.id }
        });

        if (!staff || subject.staffId !== staff.id) {
            return res.status(403).json({
                success: false,
                message: 'You can upload materials only for your assigned subjects.'
            });
        }

        const material = await prisma.studyMaterial.create({
            data: {
                title: title.trim(),
                description,
                fileUrl: fileUrl.trim(),
                subjectId: subject.id,
                uploadedById: staff.id
            },
            include: { subject: true }
        });

        res.status(201).json({
            success: true,
            message: 'Study material created successfully.',
            data: material
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Failed to create study material.'
        });
    }
};

const getAllMaterials = async (req, res) => {
    try {
        const where = {};

        if (req.user.role === 'STAFF') {
            const staff = await prisma.staffProfile.findUnique({
                where: { userId: req.user.id }
            });

            if (!staff) {
                return res.status(404).json({
                    success: false,
                    message: 'Staff profile not found.'
                });
            }

            where.uploadedById = staff.id;
        }

        if (req.user.role === 'STUDENT') {
            const student = await prisma.studentProfile.findUnique({
                where: { userId: req.user.id }
            });

            if (!student) {
                return res.status(404).json({
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

        const materials = await prisma.studyMaterial.findMany({
            where,
            include: {
                subject: true,
                uploadedBy: {
                    include: { user: { select: { id: true, name: true, email: true } } }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({
            success: true,
            count: materials.length,
            data: materials
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch study materials.'
        });
    }
};

const getMaterialById = async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid material ID.'
            });
        }

        const material = await prisma.studyMaterial.findUnique({
            where: { id },
            include: { subject: true, uploadedBy: { include: { user: true } } }
        });

        if (!material) {
            return res.status(404).json({
                success: false,
                message: 'Study material not found.'
            });
        }

        if (req.user.role === 'STAFF') {
            const staff = await prisma.staffProfile.findUnique({
                where: { userId: req.user.id }
            });

            if (!staff || material.uploadedById !== staff.id) {
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

            const enrollment = student
                ? await prisma.enrollment.findUnique({
                    where: {
                        studentId_subjectId: {
                            studentId: student.id,
                            subjectId: material.subjectId
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

        res.json({ success: true, data: material });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch study material.'
        });
    }
};

const updateMaterial = async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid material ID.'
            });
        }

        const existing = await prisma.studyMaterial.findUnique({
            where: { id }
        });

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Study material not found.'
            });
        }

        if (req.user.role === 'STAFF') {
            const staff = await prisma.staffProfile.findUnique({
                where: { userId: req.user.id }
            });

            if (!staff || existing.uploadedById !== staff.id) {
                return res.status(403).json({
                    success: false,
                    message: 'You can update only your own materials.'
                });
            }
        }

        const data = {};

        if (req.body.title !== undefined) data.title = req.body.title.trim();
        if (req.body.description !== undefined) data.description = req.body.description;
        if (req.body.fileUrl !== undefined) data.fileUrl = req.body.fileUrl.trim();

        if (req.body.subjectId !== undefined) {
            const subject = await prisma.subject.findUnique({
                where: { id: Number(req.body.subjectId) }
            });

            if (!subject) {
                return res.status(404).json({
                    success: false,
                    message: 'Subject not found.'
                });
            }

            if (req.user.role === 'STAFF') {
                const staff = await prisma.staffProfile.findUnique({
                    where: { userId: req.user.id }
                });

                if (!staff || subject.staffId !== staff.id) {
                    return res.status(403).json({
                        success: false,
                        message: 'You are not assigned to this subject.'
                    });
                }
            }

            data.subjectId = subject.id;
        }

        const material = await prisma.studyMaterial.update({
            where: { id },
            data,
            include: { subject: true }
        });

        res.json({
            success: true,
            message: 'Study material updated successfully.',
            data: material
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Failed to update study material.'
        });
    }
};

const deleteMaterial = async (req, res) => {
    try {
        const id = Number(req.params.id);

        const material = await prisma.studyMaterial.findUnique({
            where: { id }
        });

        if (!material) {
            return res.status(404).json({
                success: false,
                message: 'Study material not found.'
            });
        }

        if (req.user.role === 'STAFF') {
            const staff = await prisma.staffProfile.findUnique({
                where: { userId: req.user.id }
            });

            if (!staff || material.uploadedById !== staff.id) {
                return res.status(403).json({
                    success: false,
                    message: 'You can delete only your own materials.'
                });
            }
        }

        await prisma.studyMaterial.delete({ where: { id } });

        res.json({
            success: true,
            message: 'Study material deleted successfully.'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete study material.'
        });
    }
};

module.exports = {
    createMaterial,
    getAllMaterials,
    getMaterialById,
    updateMaterial,
    deleteMaterial
};
