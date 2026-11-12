const prisma = require('../config/database');

const getUserDepartment = async (user) => {
    if (user.role === 'STUDENT') {
        const profile = await prisma.studentProfile.findUnique({
            where: { userId: user.id },
            select: { departmentId: true }
        });
        return profile?.departmentId ?? null;
    }

    if (user.role === 'STAFF') {
        const profile = await prisma.staffProfile.findUnique({
            where: { userId: user.id },
            select: { departmentId: true }
        });
        return profile?.departmentId ?? null;
    }

    return null;
};

const createAnnouncement = async (req, res) => {
    try {
        const { title, message, targetRole, targetDepartmentId, expiresAt } = req.body;

        if (!title || !message) {
            return res.status(400).json({
                success: false,
                message: 'Title and message are required.'
            });
        }

        const allowedRoles = ['ADMIN', 'STAFF', 'STUDENT'];

        if (targetRole && !allowedRoles.includes(targetRole)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid target role.'
            });
        }

        if (targetDepartmentId !== undefined && targetDepartmentId !== null) {
            const department = await prisma.department.findUnique({
                where: { id: Number(targetDepartmentId) }
            });

            if (!department) {
                return res.status(404).json({
                    success: false,
                    message: 'Department not found.'
                });
            }
        }

        const announcement = await prisma.announcement.create({
            data: {
                title: title.trim(),
                message: message.trim(),
                targetRole: targetRole || null,
                targetDepartmentId: targetDepartmentId
                    ? Number(targetDepartmentId)
                    : null,
                createdById: req.user.id,
                expiresAt: expiresAt ? new Date(expiresAt) : null
            },
            include: {
                department: true,
                createdBy: {
                    select: { id: true, name: true, email: true, role: true }
                }
            }
        });

        res.status(201).json({
            success: true,
            message: 'Announcement created successfully.',
            data: announcement
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Failed to create announcement.'
        });
    }
};

const getAnnouncements = async (req, res) => {
    try {
        const where = {
            AND: [
                {
                    OR: [
                        { targetRole: null },
                        { targetRole: req.user.role }
                    ]
                },
                {
                    OR: [
                        { targetDepartmentId: null },
                        {
                            targetDepartmentId:
                                await getUserDepartment(req.user)
                        }
                    ]
                },
                {
                    OR: [
                        { expiresAt: null },
                        { expiresAt: { gte: new Date() } }
                    ]
                }
            ]
        };

        if (req.user.role === 'ADMIN') {
            delete where.AND;
            where.OR = [
                { expiresAt: null },
                { expiresAt: { gte: new Date() } }
            ];
        }

        const announcements = await prisma.announcement.findMany({
            where,
            include: {
                department: true,
                createdBy: {
                    select: { id: true, name: true, role: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({
            success: true,
            count: announcements.length,
            data: announcements
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch announcements.'
        });
    }
};

const getAnnouncementById = async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid announcement ID.'
            });
        }

        const announcement = await prisma.announcement.findUnique({
            where: { id },
            include: {
                department: true,
                createdBy: {
                    select: { id: true, name: true, role: true }
                }
            }
        });

        if (!announcement) {
            return res.status(404).json({
                success: false,
                message: 'Announcement not found.'
            });
        }

        if (req.user.role !== 'ADMIN') {
            const departmentId = await getUserDepartment(req.user);

            const visible =
                (!announcement.targetRole || announcement.targetRole === req.user.role) &&
                (!announcement.targetDepartmentId ||
                    announcement.targetDepartmentId === departmentId) &&
                (!announcement.expiresAt || announcement.expiresAt >= new Date());

            if (!visible) {
                return res.status(403).json({
                    success: false,
                    message: 'You cannot access this announcement.'
                });
            }
        }

        res.json({ success: true, data: announcement });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch announcement.'
        });
    }
};

const updateAnnouncement = async (req, res) => {
    try {
        const id = Number(req.params.id);

        const existing = await prisma.announcement.findUnique({
            where: { id }
        });

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Announcement not found.'
            });
        }

        if (req.user.role === 'STAFF' && existing.createdById !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'You can update only your own announcements.'
            });
        }

        const data = {};

        if (req.body.title !== undefined) data.title = req.body.title.trim();
        if (req.body.message !== undefined) data.message = req.body.message.trim();

        if (req.body.targetRole !== undefined) {
            const allowedRoles = ['ADMIN', 'STAFF', 'STUDENT', null];

            if (!allowedRoles.includes(req.body.targetRole)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid target role.'
                });
            }

            data.targetRole = req.body.targetRole;
        }

        if (req.body.targetDepartmentId !== undefined) {
            if (req.body.targetDepartmentId === null) {
                data.targetDepartmentId = null;
            } else {
                const department = await prisma.department.findUnique({
                    where: { id: Number(req.body.targetDepartmentId) }
                });

                if (!department) {
                    return res.status(404).json({
                        success: false,
                        message: 'Department not found.'
                    });
                }

                data.targetDepartmentId = department.id;
            }
        }

        if (req.body.expiresAt !== undefined) {
            data.expiresAt = req.body.expiresAt
                ? new Date(req.body.expiresAt)
                : null;
        }

        const announcement = await prisma.announcement.update({
            where: { id },
            data,
            include: { department: true }
        });

        res.json({
            success: true,
            message: 'Announcement updated successfully.',
            data: announcement
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Failed to update announcement.'
        });
    }
};

const deleteAnnouncement = async (req, res) => {
    try {
        const id = Number(req.params.id);

        const existing = await prisma.announcement.findUnique({
            where: { id }
        });

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Announcement not found.'
            });
        }

        if (req.user.role === 'STAFF' && existing.createdById !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'You can delete only your own announcements.'
            });
        }

        await prisma.announcement.delete({ where: { id } });

        res.json({
            success: true,
            message: 'Announcement deleted successfully.'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete announcement.'
        });
    }
};

module.exports = {
    createAnnouncement,
    getAnnouncements,
    getAnnouncementById,
    updateAnnouncement,
    deleteAnnouncement
};
