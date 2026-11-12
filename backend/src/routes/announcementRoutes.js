const express = require('express');
const router = express.Router();

const {
    createAnnouncement,
    getAnnouncements,
    getAnnouncementById,
    updateAnnouncement,
    deleteAnnouncement
} = require('../controllers/announcementController');

const {
    authenticateToken,
    authorizeRoles
} = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.post('/', authorizeRoles('ADMIN', 'STAFF'), createAnnouncement);
router.get('/', getAnnouncements);
router.get('/:id', getAnnouncementById);
router.put('/:id', authorizeRoles('ADMIN', 'STAFF'), updateAnnouncement);
router.delete('/:id', authorizeRoles('ADMIN', 'STAFF'), deleteAnnouncement);

module.exports = router;
