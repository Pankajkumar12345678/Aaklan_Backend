import express from 'express';
import CurriculumMap from '../models/CurriculumMap.js';
import { authenticate } from '../middleware/auth.js';
import { checkPermission } from '../middleware/permissions.js';

const router = express.Router();

// Get all curriculum standards
router.get('/', authenticate, async (req, res) => {
  try {
    const { curriculum, grade, subject } = req.query;
    
    const filter = {};
    if (curriculum) filter.curriculumKey = curriculum;
    if (grade) filter.grade = grade;
    if (subject) filter['subjects.subjectName'] = subject;

    const curricula = await CurriculumMap.find(filter);
    res.json(curricula);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch curriculum data', error: error.message });
  }
});

// Get specific curriculum
router.get('/:curriculum/:grade/:subject?', authenticate, async (req, res) => {
  try {
    const { curriculum, grade, subject } = req.params;
    
    const filter = { curriculumKey: curriculum, grade };
    if (subject) {
      filter['subjects.subjectName'] = subject;
    }

    const curriculumData = await CurriculumMap.findOne(filter);
    
    if (!curriculumData) {
      return res.status(404).json({ message: 'Curriculum not found' });
    }

    res.json(curriculumData);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch curriculum', error: error.message });
  }
});

// Get competencies for auto-suggest
router.get('/competencies/suggest', authenticate, async (req, res) => {
  try {
    const { curriculum, grade, subject, search } = req.query;
    
    const filter = { curriculumKey: curriculum, grade };
    if (subject) filter['subjects.subjectName'] = subject;

    const curriculumData = await CurriculumMap.findOne(filter);
    
    if (!curriculumData) {
      return res.json([]);
    }

    let competencies = [];
    curriculumData.subjects.forEach(subjectData => {
      subjectData.competencies.forEach(competency => {
        competencies.push({
          id: competency.id,
          statement: competency.statement,
          subject: subjectData.subjectName,
          indicators: competency.indicators
        });
      });
    });

    // Filter by search term if provided
    if (search) {
      competencies = competencies.filter(comp => 
        comp.statement.toLowerCase().includes(search.toLowerCase()) ||
        comp.subject.toLowerCase().includes(search.toLowerCase())
      );
    }

    res.json(competencies.slice(0, 10)); // Limit to 10 suggestions
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch competencies', error: error.message });
  }
});

// Admin routes for curriculum management
router.post('/', 
  authenticate, 
  checkPermission('admin', 'system_settings'),
  async (req, res) => {
    try {
      const curriculum = new CurriculumMap(req.body);
      await curriculum.save();
      res.status(201).json(curriculum);
    } catch (error) {
      res.status(500).json({ message: 'Failed to create curriculum', error: error.message });
    }
  }
);

router.put('/:id', 
  authenticate, 
  checkPermission('admin', 'system_settings'),
  async (req, res) => {
    try {
      const curriculum = await CurriculumMap.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );
      res.json(curriculum);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update curriculum', error: error.message });
    }
  }
);

export default router;
