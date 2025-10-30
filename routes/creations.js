import express from 'express';
import Lesson from '../models/Lesson.js';
import { authenticate } from '../middleware/auth.js';
import { checkPermission, trackUsage } from '../middleware/permissions.js';

const router = express.Router();

// Get user's creations with advanced filtering
router.get('/', authenticate, async (req, res) => {
  try {
    const {
      type,
      grade,
      subject,
      search,
      page = 1,
      limit = 20,
      sortBy = 'updatedAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter based on user role and permissions
    let filter = {};
    if (req.user.role === 'admin') {
      // Admin or users with read all permission can see all content
      filter = {};
    } else {
      // Regular users can only see their own content and published content
      filter.$or = [
        { createdBy: req.user._id },
        { published: true }
      ];
    }


    if (type && type !== 'all') filter.template = type;
    if (grade && grade !== 'all') filter.grade = grade;
    if (subject && subject !== 'all') filter.subject = subject;

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { 'topics': { $regex: search, $options: 'i' } },
        { 'additionalDetails': { $regex: search, $options: 'i' } }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const creations = await Lesson.find(filter)
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('title template grade subject curriculum updatedAt published createdAt')
      .populate('createdBy', 'name');

     
    const total = await Lesson.countDocuments(filter);

    // Get creation statistics
    const stats = await Lesson.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$template',
          count: { $sum: 1 },
          lastCreated: { $max: '$createdAt' }
        }
      }
    ]);

    res.json({
      creations,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
      stats
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch creations', error: error.message });
  }
});

// Get creation details
router.get('/:id', authenticate, async (req, res) => {
  try {
    const creation = await Lesson.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!creation) {
      return res.status(404).json({ message: 'Creation not found' });
    }

    // Check access
    const isCreator = creation.createdBy._id.toString() === req.user._id.toString();
    const canViewAll = req.userPermissions?.content?.read;

    if (!isCreator && !canViewAll && !creation.published) {
      return res.status(403).json({ message: 'Access denied to this creation' });
    }

    res.json(creation);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch creation details', error: error.message });
  }
});

// Update creation
router.put('/:id',
  authenticate,
  trackUsage('update_content', 'lesson'),
  async (req, res) => {
    try {
      const creation = await Lesson.findById(req.params.id);

      if (!creation) {
        return res.status(404).json({ message: 'Creation not found' });
      }

      // Check ownership
      if (creation.createdBy.toString() !== req.user._id.toString() && !req.userPermissions?.content?.update) {
        return res.status(403).json({ message: 'Access denied to update this creation' });
      }

      const updatedCreation = await Lesson.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        { new: true }
      ).populate('createdBy', 'name email');

      res.json({
        message: 'Creation updated successfully',
        creation: updatedCreation
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update creation', error: error.message });
    }
  }
);

// Duplicate creation
router.post('/:id/duplicate',
  authenticate,
  checkPermission('content', 'duplicate'),
  trackUsage('duplicate_content', 'lesson'),
  async (req, res) => {
    try {
      const original = await Lesson.findById(req.params.id);

      if (!original) {
        return res.status(404).json({ message: 'Original creation not found' });
      }

      // Check access to original
      const isCreator = original.createdBy.toString() === req.user._id.toString();
      const canDuplicateAll = req.userPermissions?.content?.duplicate;

      if (!isCreator && !canDuplicateAll && !original.published) {
        return res.status(403).json({ message: 'Access denied to duplicate this creation' });
      }

      // Create duplicate
      const duplicateData = { ...original.toObject() };
      delete duplicateData._id;
      delete duplicateData.createdAt;
      delete duplicateData.updatedAt;

      duplicateData.title = `${original.title} (Copy)`;
      duplicateData.createdBy = req.user._id;
      duplicateData.published = false;

      // Add to version history
      if (!duplicateData.versions) duplicateData.versions = [];
      duplicateData.versions.push({
        snapshotId: original._id,
        createdAt: new Date()
      });

      const duplicate = new Lesson(duplicateData);
      await duplicate.save();

      await duplicate.populate('createdBy', 'name email');

      res.status(201).json({
        message: 'Creation duplicated successfully',
        creation: duplicate
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to duplicate creation', error: error.message });
    }
  }
);




router.delete('/:id',
  authenticate,
  trackUsage('delete_content', 'lesson'),
  async (req, res) => {
    try {
      const creation = await Lesson.findById(req.params.id);

      if (!creation) {
        return res.status(404).json({ message: 'Creation not found' });
      }

      // Simple check: Only creator or admin can delete
      const isCreator = creation.createdBy.toString() === req.user._id.toString();
      const isAdmin = req.user.role === 'admin';

      if (!isCreator && !isAdmin) {
        return res.status(403).json({ 
          message: 'Access denied. Only creator or admin can delete this creation.' 
        });
      }
       
      await Lesson.findByIdAndDelete(req.params.id);

      res.json({
        message: 'Creation deleted successfully',
        deletedId: req.params.id,
        deletedTitle: creation.title
      });
    } catch (error) {
      res.status(500).json({ 
        message: 'Failed to delete creation', 
        error: error.message 
      });
    }
  }
);

// Share creation (generate shareable link)
router.post('/:id/share',
  authenticate,
  checkPermission('content', 'share'),
  trackUsage('share_content', 'lesson'),
  async (req, res) => {
    try {
      const creation = await Lesson.findById(req.params.id);

      if (!creation) {
        return res.status(404).json({ message: 'Creation not found' });
      }

      // Check ownership
      if (creation.createdBy.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Can only share your own creations' });
      }

      // In a real app, you might generate a unique share token
      const shareToken = Buffer.from(`${creation._id}:${Date.now()}`).toString('base64');

      // For now, we'll just mark it as published
      creation.published = true;
      await creation.save();

      res.json({
        message: 'Creation shared successfully',
        shareable: true,
        shareUrl: `/shared/${shareToken}`, // This would be handled by frontend
        creation
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to share creation', error: error.message });
    }
  }
);

// Get creation versions
router.get('/:id/versions', authenticate, async (req, res) => {
  try {
    const creation = await Lesson.findById(req.params.id)
      .select('versions title')
      .populate('versions.snapshotId');

    if (!creation) {
      return res.status(404).json({ message: 'Creation not found' });
    }

    // Check access
    if (creation.createdBy.toString() !== req.user._id.toString() && !req.userPermissions?.content?.read) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({
      current: creation,
      versions: creation.versions || []
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch versions', error: error.message });
  }
});

export default router;