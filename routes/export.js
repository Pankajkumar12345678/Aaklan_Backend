import express from 'express';
import { Packer } from 'docx';
import Lesson from '../models/Lesson.js';
import { authenticate } from '../middleware/auth.js';
import { checkPermission, trackUsage } from '../middleware/permissions.js';
import { ExportHelper } from '../utils/exportHelpers.js';

const router = express.Router();

// Export to DOCX with permission check
router.post('/docx/:id', 
  authenticate, 
  checkPermission('export', 'docx'),
  trackUsage('export_content', 'system'),
  async (req, res) => {
    try {
      const lesson = await Lesson.findById(req.params.id).populate('createdBy', 'name');
      
      if (!lesson) {
        return res.status(404).json({ message: 'Lesson not found' });
      }

      // Check access
      const isCreator = lesson.createdBy._id.toString() === req.user._id.toString();
      const canExportAll = req.userPermissions?.export?.docx;
      
      if (!isCreator && !canExportAll && !lesson.published) {
        return res.status(403).json({ message: 'Access denied to export this lesson' });
      }

      const doc = ExportHelper.generateDOCX(lesson);
      const buffer = await Packer.toBuffer(doc);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${lesson.title.replace(/[^a-z0-9]/gi, '_')}.docx"`);
      res.send(buffer);

    } catch (error) {
      console.error('DOCX Export Error:', error);
      res.status(500).json({ message: 'DOCX export failed', error: error.message });
    }
  }
);

// Export to PDF with permission check
router.post('/pdf/:id', 
  authenticate, 
  checkPermission('export', 'pdf'),
  trackUsage('export_content', 'system'),
  async (req, res) => {
    try {
      const lesson = await Lesson.findById(req.params.id).populate('createdBy', 'name');
      
      if (!lesson) {
        return res.status(404).json({ message: 'Lesson not found' });
      }

      // Check access
      const isCreator = lesson.createdBy._id.toString() === req.user._id.toString();
      const canExportAll = req.userPermissions?.export?.pdf;
      
      if (!isCreator && !canExportAll && !lesson.published) {
        return res.status(403).json({ message: 'Access denied to export this lesson' });
      }

      const buffer = await ExportHelper.generatePDF(lesson);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${lesson.title.replace(/[^a-z0-9]/gi, '_')}.pdf"`);
      res.send(buffer);

    } catch (error) {
      console.error('PDF Export Error:', error);
      res.status(500).json({ message: 'PDF export failed', error: error.message });
    }
  }
);

// Export to PPTX with permission check
router.post('/pptx/:id', 
  authenticate, 
  checkPermission('export', 'pptx'),
  trackUsage('export_content', 'system'),
  async (req, res) => {
    try {
      const lesson = await Lesson.findById(req.params.id).populate('createdBy', 'name');
      
      if (!lesson) {
        return res.status(404).json({ message: 'Lesson not found' });
      }

      // Check access
      const isCreator = lesson.createdBy._id.toString() === req.user._id.toString();
      const canExportAll = req.userPermissions?.export?.pptx;
      
      if (!isCreator && !canExportAll && !lesson.published) {
        return res.status(403).json({ message: 'Access denied to export this lesson' });
      }

      const buffer = await ExportHelper.generatePPTX(lesson);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      res.setHeader('Content-Disposition', `attachment; filename="${lesson.title.replace(/[^a-z0-9]/gi, '_')}.pptx"`);
      res.send(buffer);

    } catch (error) {
      console.error('PPTX Export Error:', error);
      res.status(500).json({ message: 'PPTX export failed', error: error.message });
    }
  }
);

// Bulk export multiple creations
router.post('/bulk', 
  authenticate, 
  trackUsage('export_content', 'system'),
  async (req, res) => {
    try {
      const { lessonIds, format } = req.body;
      
      if (!lessonIds || !Array.isArray(lessonIds) || lessonIds.length === 0) {
        return res.status(400).json({ message: 'No lessons specified for export' });
      }

      if (!format || !['docx', 'pdf', 'pptx'].includes(format)) {
        return res.status(400).json({ message: 'Invalid export format' });
      }

      // Check export permission for the format
      if (!req.userPermissions?.export?.[format]) {
        return res.status(403).json({ message: `No permission to export as ${format.toUpperCase()}` });
      }

      // Fetch lessons with access control
      const lessons = await Lesson.find({
        _id: { $in: lessonIds },
        $or: [
          { createdBy: req.user._id },
          { published: true }
        ]
      }).populate('createdBy', 'name');

      if (lessons.length === 0) {
        return res.status(404).json({ message: 'No accessible lessons found' });
      }

      // For now, we'll export the first lesson
      // In a real implementation, you might create a ZIP file with all lessons
      const lesson = lessons[0];
      
      let buffer;
      let contentType;
      let filename;

      switch (format) {
        case 'docx':
          const doc = ExportHelper.generateDOCX(lesson);
          buffer = await Packer.toBuffer(doc);
          contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          filename = `${lesson.title.replace(/[^a-z0-9]/gi, '_')}.docx`;
          break;
          
        case 'pdf':
          buffer = await ExportHelper.generatePDF(lesson);
          contentType = 'application/pdf';
          filename = `${lesson.title.replace(/[^a-z0-9]/gi, '_')}.pdf`;
          break;
          
        case 'pptx':
          buffer = await ExportHelper.generatePPTX(lesson);
          contentType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
          filename = `${lesson.title.replace(/[^a-z0-9]/gi, '_')}.pptx`;
          break;
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);

    } catch (error) {
      console.error('Bulk Export Error:', error);
      res.status(500).json({ message: 'Bulk export failed', error: error.message });
    }
  }
);

// Get export formats available for user
router.get('/formats', authenticate, (req, res) => {
  const availableFormats = [];
  
  if (req.userPermissions?.export?.docx) availableFormats.push('docx');
  if (req.userPermissions?.export?.pdf) availableFormats.push('pdf');
  if (req.userPermissions?.export?.pptx) availableFormats.push('pptx');
  if (req.userPermissions?.export?.google_docs) availableFormats.push('google_docs');

  res.json({
    formats: availableFormats,
    limits: {
      maxFileSize: '10MB',
      maxBulkExport: 5
    }
  });
});

export default router;