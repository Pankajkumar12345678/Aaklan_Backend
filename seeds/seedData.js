import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Template from '../models/Template.js';
import CurriculumMap from '../models/CurriculumMap.js';
import Permission from '../models/Permission.js';

dotenv.config();

const seedUsers = [
  {
    name: 'Admin User',
    email: 'admin@eduamplify.com',
    passwordHash: 'admin123',
    role: 'admin',
    organization: 'EduAmplify School'
  },
  {
    name: 'Physics Teacher',
    email: 'physics.teacher@eduamplify.com',
    passwordHash: 'teacher123',
    role: 'teacher',
    organization: 'EduAmplify School',
    profile: {
      subjects: ['Physics', 'Science'],
      grades: ['9', '10', '11', '12']
    }
  },
  {
    name: 'Math Teacher',
    email: 'math.teacher@eduamplify.com',
    passwordHash: 'teacher123',
    role: 'teacher',
    organization: 'EduAmplify School',
    profile: {
      subjects: ['Mathematics'],
      grades: ['6', '7', '8', '9', '10']
    }
  },
  {
    name: 'Student One',
    email: 'student1@eduamplify.com',
    passwordHash: 'student123',
    role: 'student',
    organization: 'EduAmplify School'
  }
];

const seedTemplates = [
  {
    key: 'lesson_plan',
    title: 'Lesson Plan',
    description: 'Create comprehensive lesson plans with AI assistance',
    icon: '📚',
    category: 'lesson',
    fields: [
      { 
        name: 'title', 
        type: 'text', 
        required: true, 
        label: 'Chapter/Title',
        placeholder: 'Enter chapter title or topic'
      },
      { 
        name: 'grade', 
        type: 'select', 
        required: true, 
        label: 'Grade',
        options: [
          { value: '1', label: 'Grade 1' },
          { value: '2', label: 'Grade 2' },
          { value: '3', label: 'Grade 3' },
          { value: '4', label: 'Grade 4' },
          { value: '5', label: 'Grade 5' },
          { value: '6', label: 'Grade 6' },
          { value: '7', label: 'Grade 7' },
          { value: '8', label: 'Grade 8' },
          { value: '9', label: 'Grade 9' },
          { value: '10', label: 'Grade 10' },
          { value: '11', label: 'Grade 11' },
          { value: '12', label: 'Grade 12' }
        ]
      },
      { 
        name: 'subject', 
        type: 'select', 
        required: true, 
        label: 'Subject',
        options: [
          { value: 'Accountancy', label: 'Accountancy' },
          { value: 'Biology', label: 'Biology' },
          { value: 'Business Studies', label: 'Business Studies' },
          { value: 'Chemistry', label: 'Chemistry' },
          { value: 'EVS', label: 'Environmental Science' },
          { value: 'Economics', label: 'Economics' },
          { value: 'English', label: 'English' },
          { value: 'Entrepreneurship', label: 'Entrepreneurship' },
          { value: 'Environment', label: 'Environment' },
          { value: 'Geography', label: 'Geography' },
          { value: 'History', label: 'History' },
          { value: 'Mathematics', label: 'Mathematics' },
          { value: 'Physics', label: 'Physics' },
          { value: 'Political Science', label: 'Political Science' },
          { value: 'Science', label: 'Science' },
          { value: 'Social Science', label: 'Social Science' },
          { value: 'Sociology', label: 'Sociology' }
        ]
      },
      { 
        name: 'curriculum', 
        type: 'select', 
        required: true, 
        label: 'Curriculum',
        options: [
          { value: 'CBSE', label: 'CBSE' },
          { value: 'NCERT', label: 'NCERT' },
          { value: 'NEP2020', label: 'NEP 2020' },
          { value: 'NCF2023', label: 'NCF 2023' },
          { value: 'Australian_v9', label: 'Australian Curriculum v9' }
        ]
      },
      { 
        name: 'duration', 
        type: 'number', 
        required: true, 
        label: 'Duration (minutes)',
        validation: { min: 1, max: 480 }
      },
      { 
        name: 'topics', 
        type: 'text', 
        required: false, 
        label: 'Topics/Competencies',
        placeholder: 'Enter key topics or competencies'
      },
      { 
        name: 'additionalInstructions', 
        type: 'textarea', 
        required: false, 
        label: 'Additional Instructions',
        placeholder: 'Any specific requirements or focus areas...'
      }
    ],
    sections: [
      { name: 'objectives', label: 'Learning Objectives', required: true },
      { name: 'priorKnowledge', label: 'Prior Knowledge', required: false },
      { name: 'warmup', label: 'Warm-up Activity', required: true },
      { name: 'introduction', label: 'Introduction', required: true },
      { name: 'mainActivities', label: 'Main Activities', required: true },
      { name: 'assessment', label: 'Assessment', required: true },
      { name: 'resources', label: 'Resources', required: false },
      { name: 'differentiation', label: 'Differentiation', required: false },
      { name: 'homework', label: 'Homework', required: false }
    ]
  },
  {
    key: 'unit_plan',
    title: 'Unit Plan',
    description: 'Plan complete units with multiple sessions',
    icon: '📅',
    category: 'lesson',
    fields: [
      { 
        name: 'title', 
        type: 'text', 
        required: true, 
        label: 'Unit Title',
        placeholder: 'Enter unit title'
      },
      { 
        name: 'grade', 
        type: 'select', 
        required: true, 
        label: 'Grade',
        options: [
          { value: '1', label: 'Grade 1' },
          { value: '2', label: 'Grade 2' },
          { value: '3', label: 'Grade 3' },
          { value: '4', label: 'Grade 4' },
          { value: '5', label: 'Grade 5' },
          { value: '6', label: 'Grade 6' },
          { value: '7', label: 'Grade 7' },
          { value: '8', label: 'Grade 8' },
          { value: '9', label: 'Grade 9' },
          { value: '10', label: 'Grade 10' },
          { value: '11', label: 'Grade 11' },
          { value: '12', label: 'Grade 12' }
        ]
      },
      { 
        name: 'sessions', 
        type: 'number', 
        required: true, 
        label: 'Number of Sessions',
        validation: { min: 1, max: 50 }
      },
      { 
        name: 'subject', 
        type: 'select', 
        required: true, 
        label: 'Subject',
        options: [
          { value: 'Accountancy', label: 'Accountancy' },
          { value: 'Biology', label: 'Biology' },
          { value: 'Business Studies', label: 'Business Studies' },
          { value: 'Chemistry', label: 'Chemistry' },
          { value: 'EVS', label: 'Environmental Science' },
          { value: 'Economics', label: 'Economics' },
          { value: 'English', label: 'English' },
          { value: 'Entrepreneurship', label: 'Entrepreneurship' },
          { value: 'Environment', label: 'Environment' },
          { value: 'Geography', label: 'Geography' },
          { value: 'History', label: 'History' },
          { value: 'Mathematics', label: 'Mathematics' },
          { value: 'Physics', label: 'Physics' },
          { value: 'Political Science', label: 'Political Science' },
          { value: 'Science', label: 'Science' },
          { value: 'Social Science', label: 'Social Science' },
          { value: 'Sociology', label: 'Sociology' }
        ]
      },
      { 
        name: 'curriculum', 
        type: 'select', 
        required: true, 
        label: 'Curriculum',
        options: [
          { value: 'CBSE', label: 'CBSE' },
          { value: 'NCERT', label: 'NCERT' },
          { value: 'NEP2020', label: 'NEP 2020' },
          { value: 'NCF2023', label: 'NCF 2023' },
          { value: 'Australian_v9', label: 'Australian Curriculum v9' }
        ]
      },
      { 
        name: 'topics', 
        type: 'text', 
        required: false, 
        label: 'Topics/Competencies',
        placeholder: 'Enter key topics or competencies'
      },
      { 
        name: 'additionalDetails', 
        type: 'textarea', 
        required: false, 
        label: 'Additional Details',
        placeholder: 'Any specific requirements or focus areas...'
      }
    ],
    sections: [
      { name: 'overview', label: 'Unit Overview', required: true },
      { name: 'essentialQuestions', label: 'Essential Questions', required: true },
      { name: 'learningGoals', label: 'Learning Goals', required: true },
      { name: 'sessionBreakdown', label: 'Session Breakdown', required: true },
      { name: 'assessments', label: 'Assessments', required: true },
      { name: 'resources', label: 'Resources', required: false },
      { name: 'differentiation', label: 'Differentiation', required: false }
    ]
  },
  {
    key: 'quiz',
    title: 'Quiz',
    description: 'Generate quizzes with multiple choice questions',
    icon: '❓',
    category: 'assessment',
    fields: [
      { 
        name: 'title', 
        type: 'text', 
        required: true, 
        label: 'Quiz Title',
        placeholder: 'Enter quiz title'
      },
      { 
        name: 'grade', 
        type: 'select', 
        required: true, 
        label: 'Grade',
        options: [
          { value: '1', label: 'Grade 1' },
          { value: '2', label: 'Grade 2' },
          { value: '3', label: 'Grade 3' },
          { value: '4', label: 'Grade 4' },
          { value: '5', label: 'Grade 5' },
          { value: '6', label: 'Grade 6' },
          { value: '7', label: 'Grade 7' },
          { value: '8', label: 'Grade 8' },
          { value: '9', label: 'Grade 9' },
          { value: '10', label: 'Grade 10' },
          { value: '11', label: 'Grade 11' },
          { value: '12', label: 'Grade 12' }
        ]
      },
      { 
        name: 'subject', 
        type: 'select', 
        required: true, 
        label: 'Subject',
        options: [
          { value: 'Accountancy', label: 'Accountancy' },
          { value: 'Biology', label: 'Biology' },
          { value: 'Business Studies', label: 'Business Studies' },
          { value: 'Chemistry', label: 'Chemistry' },
          { value: 'EVS', label: 'Environmental Science' },
          { value: 'Economics', label: 'Economics' },
          { value: 'English', label: 'English' },
          { value: 'Entrepreneurship', label: 'Entrepreneurship' },
          { value: 'Environment', label: 'Environment' },
          { value: 'Geography', label: 'Geography' },
          { value: 'History', label: 'History' },
          { value: 'Mathematics', label: 'Mathematics' },
          { value: 'Physics', label: 'Physics' },
          { value: 'Political Science', label: 'Political Science' },
          { value: 'Science', label: 'Science' },
          { value: 'Social Science', label: 'Social Science' },
          { value: 'Sociology', label: 'Sociology' }
        ]
      },
      { 
        name: 'difficulty', 
        type: 'select', 
        required: true, 
        label: 'Difficulty Level',
        options: [
          { value: 'Easy', label: 'Easy' },
          { value: 'Medium', label: 'Medium' },
          { value: 'Hard', label: 'Hard' }
        ]
      },
      { 
        name: 'curriculum', 
        type: 'select', 
        required: true, 
        label: 'Curriculum',
        options: [
          { value: 'CBSE', label: 'CBSE' },
          { value: 'NCERT', label: 'NCERT' },
          { value: 'NEP2020', label: 'NEP 2020' },
          { value: 'NCF2023', label: 'NCF 2023' },
          { value: 'Australian_v9', label: 'Australian Curriculum v9' }
        ]
      },
      { 
        name: 'duration', 
        type: 'number', 
        required: true, 
        label: 'Duration (minutes)',
        validation: { min: 5, max: 180 }
      },
      { 
        name: 'numQuestions', 
        type: 'number', 
        required: true, 
        label: 'Number of Questions',
        validation: { min: 1, max: 50 }
      },
      { 
        name: 'topics', 
        type: 'text', 
        required: false, 
        label: 'Topics/Competencies',
        placeholder: 'Enter key topics or competencies'
      },
      { 
        name: 'additionalDetails', 
        type: 'textarea', 
        required: false, 
        label: 'Additional Details',
        placeholder: 'Any specific requirements or focus areas...'
      }
    ],
    sections: [
      { name: 'questions', label: 'Questions', required: true },
      { name: 'answerKey', label: 'Answer Key', required: true }
    ]
  },
  {
    key: 'project',
    title: 'Project',
    description: 'Design comprehensive project plans',
    icon: '🔬',
    category: 'project',
    fields: [
      { 
        name: 'title', 
        type: 'text', 
        required: true, 
        label: 'Project Title',
        placeholder: 'Enter project title'
      },
      { 
        name: 'grade', 
        type: 'select', 
        required: true, 
        label: 'Grade',
        options: [
          { value: '1', label: 'Grade 1' },
          { value: '2', label: 'Grade 2' },
          { value: '3', label: 'Grade 3' },
          { value: '4', label: 'Grade 4' },
          { value: '5', label: 'Grade 5' },
          { value: '6', label: 'Grade 6' },
          { value: '7', label: 'Grade 7' },
          { value: '8', label: 'Grade 8' },
          { value: '9', label: 'Grade 9' },
          { value: '10', label: 'Grade 10' },
          { value: '11', label: 'Grade 11' },
          { value: '12', label: 'Grade 12' }
        ]
      },
      { 
        name: 'subject', 
        type: 'select', 
        required: true, 
        label: 'Subject',
        options: [
          { value: 'Accountancy', label: 'Accountancy' },
          { value: 'Biology', label: 'Biology' },
          { value: 'Business Studies', label: 'Business Studies' },
          { value: 'Chemistry', label: 'Chemistry' },
          { value: 'EVS', label: 'Environmental Science' },
          { value: 'Economics', label: 'Economics' },
          { value: 'English', label: 'English' },
          { value: 'Entrepreneurship', label: 'Entrepreneurship' },
          { value: 'Environment', label: 'Environment' },
          { value: 'Geography', label: 'Geography' },
          { value: 'History', label: 'History' },
          { value: 'Mathematics', label: 'Mathematics' },
          { value: 'Physics', label: 'Physics' },
          { value: 'Political Science', label: 'Political Science' },
          { value: 'Science', label: 'Science' },
          { value: 'Social Science', label: 'Social Science' },
          { value: 'Sociology', label: 'Sociology' }
        ]
      },
      { 
        name: 'curriculum', 
        type: 'select', 
        required: true, 
        label: 'Curriculum',
        options: [
          { value: 'CBSE', label: 'CBSE' },
          { value: 'NCERT', label: 'NCERT' },
          { value: 'NEP2020', label: 'NEP 2020' },
          { value: 'NCF2023', label: 'NCF 2023' },
          { value: 'Australian_v9', label: 'Australian Curriculum v9' }
        ]
      },
      { 
        name: 'duration', 
        type: 'number', 
        required: true, 
        label: 'Duration (days)',
        validation: { min: 1, max: 90 }
      },
      { 
        name: 'topics', 
        type: 'text', 
        required: false, 
        label: 'Topics/Competencies',
        placeholder: 'Enter key topics or competencies'
      },
      { 
        name: 'additionalDetails', 
        type: 'textarea', 
        required: false, 
        label: 'Additional Details',
        placeholder: 'Any specific requirements or focus areas...'
      }
    ],
    sections: [
      { name: 'objectives', label: 'Objectives', required: true },
      { name: 'procedure', label: 'Procedure', required: true },
      { name: 'materials', label: 'Materials', required: true },
      { name: 'outcomes', label: 'Expected Outcomes', required: true },
      { name: 'evaluation', label: 'Evaluation Criteria', required: true },
      { name: 'timeline', label: 'Timeline', required: false }
    ]
  },
  {
    key: 'gagne_lesson_plan',
    title: 'Gagné\'s Lesson Plan',
    description: 'Lesson plans based on Gagné\'s Nine Events of Instruction',
    icon: '🎯',
    category: 'lesson',
    fields: [
      { 
        name: 'title', 
        type: 'text', 
        required: true, 
        label: 'Chapter/Title',
        placeholder: 'Enter chapter title or topic'
      },
      { 
        name: 'grade', 
        type: 'select', 
        required: true, 
        label: 'Grade',
        options: [
          { value: '1', label: 'Grade 1' },
          { value: '2', label: 'Grade 2' },
          { value: '3', label: 'Grade 3' },
          { value: '4', label: 'Grade 4' },
          { value: '5', label: 'Grade 5' },
          { value: '6', label: 'Grade 6' },
          { value: '7', label: 'Grade 7' },
          { value: '8', label: 'Grade 8' },
          { value: '9', label: 'Grade 9' },
          { value: '10', label: 'Grade 10' },
          { value: '11', label: 'Grade 11' },
          { value: '12', label: 'Grade 12' }
        ]
      },
      { 
        name: 'subject', 
        type: 'select', 
        required: true, 
        label: 'Subject',
        options: [
          { value: 'Accountancy', label: 'Accountancy' },
          { value: 'Biology', label: 'Biology' },
          { value: 'Business Studies', label: 'Business Studies' },
          { value: 'Chemistry', label: 'Chemistry' },
          { value: 'EVS', label: 'Environmental Science' },
          { value: 'Economics', label: 'Economics' },
          { value: 'English', label: 'English' },
          { value: 'Entrepreneurship', label: 'Entrepreneurship' },
          { value: 'Environment', label: 'Environment' },
          { value: 'Geography', label: 'Geography' },
          { value: 'History', label: 'History' },
          { value: 'Mathematics', label: 'Mathematics' },
          { value: 'Physics', label: 'Physics' },
          { value: 'Political Science', label: 'Political Science' },
          { value: 'Science', label: 'Science' },
          { value: 'Social Science', label: 'Social Science' },
          { value: 'Sociology', label: 'Sociology' }
        ]
      },
      { 
        name: 'curriculum', 
        type: 'select', 
        required: true, 
        label: 'Curriculum',
        options: [
          { value: 'CBSE', label: 'CBSE' },
          { value: 'NCERT', label: 'NCERT' },
          { value: 'NEP2020', label: 'NEP 2020' },
          { value: 'NCF2023', label: 'NCF 2023' },
          { value: 'Australian_v9', label: 'Australian Curriculum v9' }
        ]
      },
      { 
        name: 'duration', 
        type: 'number', 
        required: true, 
        label: 'Duration (minutes)',
        validation: { min: 1, max: 480 }
      },
      { 
        name: 'topics', 
        type: 'text', 
        required: false, 
        label: 'Topics/Competencies',
        placeholder: 'Enter key topics or competencies'
      },
      { 
        name: 'additionalDetails', 
        type: 'textarea', 
        required: false, 
        label: 'Additional Details',
        placeholder: 'Any specific requirements or focus areas...'
      }
    ],
    sections: [
      { name: 'gainAttention', label: 'Gain Attention', required: true },
      { name: 'informObjectives', label: 'Inform Objectives', required: true },
      { name: 'stimulateRecall', label: 'Stimulate Recall', required: true },
      { name: 'presentContent', label: 'Present Content', required: true },
      { name: 'provideGuidance', label: 'Provide Guidance', required: true },
      { name: 'elicitPerformance', label: 'Elicit Performance', required: true },
      { name: 'provideFeedback', label: 'Provide Feedback', required: true },
      { name: 'assessPerformance', label: 'Assess Performance', required: true },
      { name: 'enhanceRetention', label: 'Enhance Retention', required: true }
    ]
  },
  {
    key: 'debate',
    title: 'Debate',
    description: 'Structure debates with arguments and guidelines',
    icon: '💬',
    category: 'other',
    fields: [
      { 
        name: 'title', 
        type: 'text', 
        required: true, 
        label: 'Debate Topic',
        placeholder: 'Enter debate topic'
      },
      { 
        name: 'grade', 
        type: 'select', 
        required: true, 
        label: 'Grade',
        options: [
          { value: '1', label: 'Grade 1' },
          { value: '2', label: 'Grade 2' },
          { value: '3', label: 'Grade 3' },
          { value: '4', label: 'Grade 4' },
          { value: '5', label: 'Grade 5' },
          { value: '6', label: 'Grade 6' },
          { value: '7', label: 'Grade 7' },
          { value: '8', label: 'Grade 8' },
          { value: '9', label: 'Grade 9' },
          { value: '10', label: 'Grade 10' },
          { value: '11', label: 'Grade 11' },
          { value: '12', label: 'Grade 12' }
        ]
      },
      { 
        name: 'subject', 
        type: 'select', 
        required: true, 
        label: 'Subject',
        options: [
          { value: 'Accountancy', label: 'Accountancy' },
          { value: 'Biology', label: 'Biology' },
          { value: 'Business Studies', label: 'Business Studies' },
          { value: 'Chemistry', label: 'Chemistry' },
          { value: 'EVS', label: 'Environmental Science' },
          { value: 'Economics', label: 'Economics' },
          { value: 'English', label: 'English' },
          { value: 'Entrepreneurship', label: 'Entrepreneurship' },
          { value: 'Environment', label: 'Environment' },
          { value: 'Geography', label: 'Geography' },
          { value: 'History', label: 'History' },
          { value: 'Mathematics', label: 'Mathematics' },
          { value: 'Physics', label: 'Physics' },
          { value: 'Political Science', label: 'Political Science' },
          { value: 'Science', label: 'Science' },
          { value: 'Social Science', label: 'Social Science' },
          { value: 'Sociology', label: 'Sociology' }
        ]
      },
      { 
        name: 'curriculum', 
        type: 'select', 
        required: true, 
        label: 'Curriculum',
        options: [
          { value: 'CBSE', label: 'CBSE' },
          { value: 'NCERT', label: 'NCERT' },
          { value: 'NEP2020', label: 'NEP 2020' },
          { value: 'NCF2023', label: 'NCF 2023' },
          { value: 'Australian_v9', label: 'Australian Curriculum v9' }
        ]
      },
      { 
        name: 'duration', 
        type: 'number', 
        required: true, 
        label: 'Duration (minutes)',
        validation: { min: 10, max: 180 }
      },
      { 
        name: 'topics', 
        type: 'text', 
        required: false, 
        label: 'Topics/Competencies',
        placeholder: 'Enter key topics or competencies'
      },
      { 
        name: 'additionalDetails', 
        type: 'textarea', 
        required: false, 
        label: 'Additional Details',
        placeholder: 'Any specific requirements or focus areas...'
      }
    ],
    sections: [
      { name: 'topic', label: 'Debate Topic', required: true },
      { name: 'forArguments', label: 'For Arguments', required: true },
      { name: 'againstArguments', label: 'Against Arguments', required: true },
      { name: 'moderatorGuidelines', label: 'Moderator Guidelines', required: true },
      { name: 'evaluationCriteria', label: 'Evaluation Criteria', required: true },
      { name: 'timingStructure', label: 'Timing Structure', required: true }
    ]
  },
  {
    key: 'blank',
    title: 'Blank Template',
    description: 'Start with a blank editable page',
    icon: '📄',
    category: 'other',
    fields: [],
    sections: []
  }
];

const seedCurriculum = [
  {
    curriculumKey: 'CBSE',
    grade: '8',
    subjects: [
      {
        subjectName: 'Science',
        subjectCode: 'SCI',
        competencies: [
          {
            id: 'CBSE-8-SCI-FT-01',
            statement: 'Understand friction and its effects',
            code: 'FT-01',
            indicators: [
              { id: 'FT-01-01', statement: 'Explain friction' },
              { id: 'FT-01-02', statement: 'Give examples of friction in daily life' },
              { id: 'FT-01-03', statement: 'Differentiate between static and kinetic friction' }
            ]
          },
          {
            id: 'CBSE-8-SCI-LT-02',
            statement: 'Comprehend chemical reactions and equations',
            code: 'LT-02',
            indicators: [
              { id: 'LT-02-01', statement: 'Identify chemical changes' },
              { id: 'LT-02-02', statement: 'Write balanced chemical equations' },
              { id: 'LT-02-03', statement: 'Understand different types of chemical reactions' }
            ]
          }
        ]
      },
      {
        subjectName: 'Mathematics',
        subjectCode: 'MATH',
        competencies: [
          {
            id: 'CBSE-8-MATH-AL-01',
            statement: 'Solve linear equations in one variable',
            code: 'AL-01',
            indicators: [
              { id: 'AL-01-01', statement: 'Solve one-variable equations' },
              { id: 'AL-01-02', statement: 'Apply to word problems' },
              { id: 'AL-01-03', statement: 'Graph linear equations' }
            ]
          }
        ]
      }
    ],
    source: 'NCERT',
    lastUpdated: new Date()
  },
  {
    curriculumKey: 'CBSE',
    grade: '9',
    subjects: [
      {
        subjectName: 'Science',
        subjectCode: 'SCI',
        competencies: [
          {
            id: 'CBSE-9-SCI-MT-01',
            statement: 'Understand motion and its laws',
            code: 'MT-01',
            indicators: [
              { id: 'MT-01-01', statement: 'Define motion' },
              { id: 'MT-01-02', statement: 'Apply Newton\'s laws of motion' },
              { id: 'MT-01-03', statement: 'Solve numerical problems' }
            ]
          }
        ]
      }
    ],
    source: 'NCERT',
    lastUpdated: new Date()
  }
];

async function seedDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    // await User.deleteMany({});
    await Template.deleteMany({});
    await CurriculumMap.deleteMany({});

    // // Insert users
    // const createdUsers = await User.insertMany(seedUsers);
    // console.log(`✅ Created ${createdUsers.length} users`);

    // Insert templates
    const createdTemplates = await Template.insertMany(seedTemplates);
    console.log(`✅ Created ${createdTemplates.length} templates`);

    // Insert curriculum
    const createdCurriculum = await CurriculumMap.insertMany(seedCurriculum);
    console.log(`✅ Created ${createdCurriculum.length} curriculum maps`);

    console.log('\n🎉 Database seeded successfully!');
    console.log('\n📧 Login credentials:');
    console.log('   👑 Admin: admin@eduamplify.com / admin123');
    console.log('   👩‍🏫 Teacher: physics.teacher@eduamplify.com / teacher123');
    console.log('   👨‍🎓 Student: student1@eduamplify.com / student123');
    console.log('\n📚 Available Templates:');
    createdTemplates.forEach(template => {
      console.log(`   ${template.icon} ${template.title} - ${template.description}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    console.error('Detailed error:', error);
    process.exit(1);
  }
}

seedDatabase();