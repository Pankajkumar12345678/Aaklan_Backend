import express from 'express';
import Template from '../models/Template.js';
import { authenticate } from '../middleware/auth.js';
import { checkPermission } from '../middleware/permissions.js';

const router = express.Router();

// Get all templates (with permission-based filtering)
router.get('/', authenticate, async (req, res) => {
  try {
    const templates = await Template.find().sort({ title: 1 });
    
    // Filter templates based on user permissions
    const userAccessTemplates = req.userPermissions?.templates?.access || [];
    const filteredTemplates = templates.filter(template => 
      userAccessTemplates.includes(template.key) || 
      req.userPermissions?.templates?.read // Admin can read all
    );

    res.json(filteredTemplates);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch templates', error: error.message });
  }
});

// Get specific template with permission check
router.get('/:key', authenticate, async (req, res) => {
  try {
    const template = await Template.findOne({ key: req.params.key });
    
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    // Check if user has access to this template
    const userAccessTemplates = req.userPermissions?.templates?.access || [];
    if (!userAccessTemplates.includes(template.key) && !req.userPermissions?.templates?.read) {
      return res.status(403).json({ message: 'Access denied to this template' });
    }

    res.json(template);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create new template (Admin only)
router.post('/', 
  authenticate, 
  checkPermission('templates', 'create'),
  async (req, res) => {
    try {
      const template = new Template(req.body);
      await template.save();
      
      res.status(201).json({
        message: 'Template created successfully',
        template
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to create template', error: error.message });
    }
  }
);

// Update template (Admin only)
router.put('/:id', 
  authenticate, 
  checkPermission('templates', 'update'),
  async (req, res) => {
    try {
      const template = await Template.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );

      if (!template) {
        return res.status(404).json({ message: 'Template not found' });
      }

      res.json({
        message: 'Template updated successfully',
        template
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update template', error: error.message });
    }
  }
);

// Delete template (Admin only)
router.delete('/:id', 
  authenticate, 
  checkPermission('templates', 'delete'),
  async (req, res) => {
    try {
      const template = await Template.findByIdAndDelete(req.params.id);

      if (!template) {
        return res.status(404).json({ message: 'Template not found' });
      }

      res.json({ message: 'Template deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete template', error: error.message });
    }
  }
);

export default router;