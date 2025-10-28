import express from 'express';
import Lesson from '../models/Lesson.js';
import { authenticate } from '../middleware/auth.js';
import { checkPermission, trackUsage } from '../middleware/permissions.js';

const router = express.Router();

// Create new lesson with permission check
router.post('/', 
  authenticate, 
  checkPermission('content', 'create'),
  trackUsage('create_content', 'lesson'),
  async (req, res) => {
    try {
      const lessonData = {
        ...req.body,
        createdBy: req.user._id
      };

      const lesson = new Lesson(lessonData);
      await lesson.save();

      // Populate creator info for response
      await lesson.populate('createdBy', 'name email');

      res.status(201).json({
        message: 'Lesson created successfully',
        lesson
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to create lesson', error: error.message });
    }
  }
);

// Get specific lesson with access control
router.get('/:id', authenticate, async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id).populate('createdBy', 'name email');
    
    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    // Check access: creator, admin, or published and shared
    const isCreator = lesson.createdBy._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    const canViewAll = req.userPermissions?.content?.read;
    
    if (!isCreator && !isAdmin && !canViewAll && !lesson.published) {
      return res.status(403).json({ message: 'Access denied to this lesson' });
    }

    res.json(lesson);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch lesson', error: error.message });
  }
});

// Update lesson with permission check
router.put('/:id', 
  authenticate, 
  trackUsage('update_content', 'lesson'),
  async (req, res) => {
    try {
      const lesson = await Lesson.findById(req.params.id);
      
      if (!lesson) {
        return res.status(404).json({ message: 'Lesson not found' });
      }

      // Check ownership or admin rights
      const isCreator = lesson.createdBy.toString() === req.user._id.toString();
      const canUpdateAll = req.userPermissions?.content?.update;
      
      if (!isCreator && !canUpdateAll) {
        return res.status(403).json({ message: 'Access denied to update this lesson' });
      }

      const updatedLesson = await Lesson.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        { new: true, runValidators: true }
      ).populate('createdBy', 'name email');

      res.json({
        message: 'Lesson updated successfully',
        lesson: updatedLesson
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update lesson', error: error.message });
    }
  }
);

// Delete lesson with permission check
router.delete('/:id', 
  authenticate, 
  trackUsage('delete_content', 'lesson'),
  async (req, res) => {
    try {
      const lesson = await Lesson.findById(req.params.id);
      
      if (!lesson) {
        return res.status(404).json({ message: 'Lesson not found' });
      }

      // Check ownership or admin rights
      const isCreator = lesson.createdBy.toString() === req.user._id.toString();
      const canDeleteAll = req.userPermissions?.content?.delete;
      
      if (!isCreator && !canDeleteAll) {
        return res.status(403).json({ message: 'Access denied to delete this lesson' });
      }

      await Lesson.findByIdAndDelete(req.params.id);

      res.json({ message: 'Lesson deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete lesson', error: error.message });
    }
  }
);

// Get user's lessons with filters and pagination
router.get('/', authenticate, async (req, res) => {
  try {
    const { 
      type, 
      grade, 
      subject, 
      page = 1, 
      limit = 10,
      search 
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

    // Apply filters
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

    const lessons = await Lesson.find(filter)
      .sort({ updatedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('createdBy', 'name email');

    const total = await Lesson.countDocuments(filter);

    res.json({
      lessons,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch lessons', error: error.message });
  }
});

// Publish/unpublish lesson
router.patch('/:id/publish', 
  authenticate, 
  checkPermission('content', 'publish'),
  trackUsage('publish_content', 'lesson'),
  async (req, res) => {
    try {
      const { published } = req.body;
      const lesson = await Lesson.findById(req.params.id);
      
      if (!lesson) {
        return res.status(404).json({ message: 'Lesson not found' });
      }

      // Check ownership
      if (lesson.createdBy.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Can only publish your own lessons' });
      }

      lesson.published = published;
      await lesson.save();

      res.json({
        message: `Lesson ${published ? 'published' : 'unpublished'} successfully`,
        lesson
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update publication status', error: error.message });
    }
  }
);

// Duplicate lesson
router.post('/:id/duplicate', 
  authenticate, 
  checkPermission('content', 'duplicate'),
  trackUsage('duplicate_content', 'lesson'),
  async (req, res) => {
    try {
      const original = await Lesson.findById(req.params.id);
      
      if (!original) {
        return res.status(404).json({ message: 'Original lesson not found' });
      }

      // Create duplicate
      const duplicateData = { ...original.toObject() };
      delete duplicateData._id;
      delete duplicateData.createdAt;
      delete duplicateData.updatedAt;
      
      duplicateData.title = `${original.title} (Copy)`;
      duplicateData.createdBy = req.user._id;
      duplicateData.published = false;
      
      // Add version history entry
      if (!duplicateData.versions) {
        duplicateData.versions = [];
      }
      duplicateData.versions.push({
        snapshotId: original._id,
        createdAt: new Date()
      });

      const duplicate = new Lesson(duplicateData);
      await duplicate.save();

      await duplicate.populate('createdBy', 'name email');

      res.status(201).json({
        message: 'Lesson duplicated successfully',
        lesson: duplicate
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to duplicate lesson', error: error.message });
    }
  }
);

export default router;