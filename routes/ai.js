import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authenticate } from '../middleware/auth.js';
import { checkPermission, trackUsage } from '../middleware/permissions.js';
import UserActivity from '../models/UserActivity.js';
import Lesson from '../models/Lesson.js';
import crypto from 'crypto';

const router = express.Router();

// Initialize Gemini AI with correct API key
const genAI = new GoogleGenerativeAI("AIzaSyDEVVO4JRjBm1fFIK9CJJkzG_R0yFzcfyI");

// Helper function to normalize topics input
function normalizeTopics(topics) {
  if (!topics) return ['General concepts'];
  
  if (Array.isArray(topics)) {
    return topics.length > 0 ? topics : ['General concepts'];
  }
  
  if (typeof topics === 'string') {
    if (topics.toLowerCase().includes('all') || topics === '' || topics === 'all topics') {
      return ['General concepts'];
    }
    const topicsArray = topics.split(',').map(topic => topic.trim()).filter(topic => topic);
    return topicsArray.length > 0 ? topicsArray : ['General concepts'];
  }
  
  return ['General concepts'];
}

// Helper function to normalize other fields
function normalizeField(value, defaultValue = '') {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  return value;
}

// Helper function to safely join topics for prompts
function safeTopicsJoin(topics) {
  const normalized = normalizeTopics(topics);
  return normalized.join(', ');
}

// IMPROVED function to parse quiz content - FIXED DUPLICATE ISSUE
function parseQuizContent(content) {
  console.log('Parsing quiz content:', content?.substring(0, 200));
  
  const sections = {
    questions: '',
    answerKey: ''
  };

  if (!content) return sections;

  // Remove any introductory text before the first question
  const firstQuestionIndex = content.search(/Q1[\.\:]/i);
  let cleanContent = content;
  if (firstQuestionIndex > 0) {
    cleanContent = content.substring(firstQuestionIndex);
  }

  // Split content into lines
  const lines = cleanContent.split('\n').filter(line => line.trim());
  
  let questionsText = '';
  let answerKeyText = '';
  let currentQuestion = '';
  let currentAnswers = [];
  let currentCorrect = '';
  let currentExplanation = '';
  let questionCount = 0;
  let inQuestionBlock = false;
  
  // Parse each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Detect question start
    if (line.match(/^Q\d+[\.\:]/)) {
      // Save previous question if exists
      if (inQuestionBlock && currentQuestion && currentAnswers.length > 0) {
        questionCount++;
        questionsText += `Q${questionCount}. ${currentQuestion}\n`;
        currentAnswers.forEach((answer, index) => {
          questionsText += `${String.fromCharCode(65 + index)}) ${answer}\n`;
        });
        questionsText += '\n';
        
        answerKeyText += `Q${questionCount}. ${currentQuestion}\n`;
        answerKeyText += `Correct Answer: ${currentCorrect}\n`;
        if (currentExplanation) {
          answerKeyText += `Explanation: ${currentExplanation}\n`;
        }
        answerKeyText += '\n';
      }
      
      // Start new question
      currentQuestion = line.replace(/^Q\d+[\.\:]\s*/, '');
      currentAnswers = [];
      currentCorrect = '';
      currentExplanation = '';
      inQuestionBlock = true;
      
    } else if (line.match(/^[A-D][\.\)]/)) {
      // Answer option
      const answerText = line.replace(/^[A-D][\.\)]\s*/, '');
      currentAnswers.push(answerText);
      
    } else if (line.toLowerCase().startsWith('correct:')) {
      // Correct answer
      currentCorrect = line.replace(/^correct:\s*/i, '').trim();
      
    } else if (line.toLowerCase().startsWith('explanation:')) {
      // Explanation
      currentExplanation = line.replace(/^explanation:\s*/i, '').trim();
      
    } else if (inQuestionBlock && currentQuestion && !currentCorrect && line && 
               !line.match(/^[A-D][\.\)]/) && 
               !line.toLowerCase().startsWith('correct:') && 
               !line.toLowerCase().startsWith('explanation:')) {
      // Continue question stem if it spans multiple lines
      currentQuestion += ' ' + line;
    }
  }
  
  // Save the last question
  if (inQuestionBlock && currentQuestion && currentAnswers.length > 0) {
    questionCount++;
    questionsText += `Q${questionCount}. ${currentQuestion}\n`;
    currentAnswers.forEach((answer, index) => {
      questionsText += `${String.fromCharCode(65 + index)}) ${answer}\n`;
    });
    
    answerKeyText += `Q${questionCount}. ${currentQuestion}\n`;
    answerKeyText += `Correct Answer: ${currentCorrect}\n`;
    if (currentExplanation) {
      answerKeyText += `Explanation: ${currentExplanation}\n`;
    }
  }
  
  // If parsing failed or no questions found, use intelligent fallback
  if (!questionsText.trim() || questionCount === 0) {
    console.log('Quiz parsing failed, using intelligent fallback');
    
    // Try to extract questions using simpler method
    const questionBlocks = content.split(/(?=Q\d+[\.\:])/i);
    let fallbackQuestions = '';
    let fallbackAnswers = '';
    let qCount = 0;
    
    for (const block of questionBlocks) {
      if (block.trim()) {
        qCount++;
        fallbackQuestions += `Q${qCount}. ${block.trim()}\n\n`;
        fallbackAnswers += `Q${qCount}. [Answer for above question]\n\n`;
      }
    }
    
    if (qCount > 0) {
      sections.questions = fallbackQuestions.trim();
      sections.answerKey = fallbackAnswers.trim();
    } else {
      // Last resort: return raw content but prevent duplicates
      sections.questions = content;
      sections.answerKey = 'Answer key will be generated separately.';
    }
  } else {
    sections.questions = questionsText.trim();
    sections.answerKey = answerKeyText.trim();
  }
  
  console.log(`Parsed ${questionCount} questions successfully`);
  return sections;
}

// COMPLETELY REWRITTEN function to parse AI content into sections - FIXED FOR ALL TEMPLATES
function parseAIContent(content, template) {
  console.log(`Parsing content for template: ${template}`);
  console.log('Content sample:', content?.substring(0, 300));
  
  const sections = {};
  
  // Special handling for quiz template
  if (template === 'quiz') {
    return parseQuizContent(content);
  }

  // Define section patterns for each template
  const sectionPatterns = {
    lesson_plan: [
      { key: 'objectives', pattern: /LEARNING OBJECTIVES[\s\:\-]*\n?/i },
      { key: 'priorKnowledge', pattern: /PRIOR KNOWLEDGE[\s\:\-]*\n?/i },
      { key: 'warmup', pattern: /WARM-UP ACTIVITY[\s\:\-]*\n?/i },
      { key: 'introduction', pattern: /INTRODUCTION[\s\:\-]*\n?/i },
      { key: 'mainActivities', pattern: /MAIN ACTIVITIES[\s\:\-]*\n?/i },
      { key: 'assessment', pattern: /ASSESSMENT STRATEGIES[\s\:\-]*\n?/i },
      { key: 'resources', pattern: /RESOURCES AND MATERIALS[\s\:\-]*\n?/i },
      { key: 'differentiation', pattern: /DIFFERENTIATION STRATEGIES[\s\:\-]*\n?/i },
      { key: 'homework', pattern: /HOMEWORK\/EXTENSION ACTIVITIES[\s\:\-]*\n?/i }
    ],
    project: [
      { key: 'objectives', pattern: /PROJECT OBJECTIVES[\s\:\-]*\n?/i },
      { key: 'procedure', pattern: /PROCEDURE[\s\:\-]*\n?/i },
      { key: 'materials', pattern: /MATERIALS REQUIRED[\s\:\-]*\n?/i },
      { key: 'outcomes', pattern: /EXPECTED OUTCOMES[\s\:\-]*\n?/i },
      { key: 'evaluation', pattern: /EVALUATION CRITERIA[\s\:\-]*\n?/i },
      { key: 'timeline', pattern: /TIMELINE[\s\:\-]*\n?/i }
    ],
    unit_plan: [
      { key: 'overview', pattern: /UNIT OVERVIEW[\s\:\-]*\n?/i },
      { key: 'essentialQuestions', pattern: /ESSENTIAL QUESTIONS[\s\:\-]*\n?/i },
      { key: 'learningGoals', pattern: /LEARNING GOALS[\s\:\-]*\n?/i },
      { key: 'sessionBreakdown', pattern: /SESSION BREAKDOWN[\s\:\-]*\n?/i },
      { key: 'assessments', pattern: /ASSESSMENT STRATEGIES[\s\:\-]*\n?/i },
      { key: 'resources', pattern: /RESOURCES[\s\:\-]*\n?/i },
      { key: 'differentiation', pattern: /DIFFERENTIATION[\s\:\-]*\n?/i }
    ],
    gagne_lesson_plan: [
      { key: 'gainAttention', pattern: /GAIN ATTENTION[\s\:\-]*\n?/i },
      { key: 'informObjectives', pattern: /INFORM OBJECTIVES[\s\:\-]*\n?/i },
      { key: 'stimulateRecall', pattern: /STIMULATE RECALL[\s\:\-]*\n?/i },
      { key: 'presentContent', pattern: /PRESENT CONTENT[\s\:\-]*\n?/i },
      { key: 'provideGuidance', pattern: /PROVIDE GUIDANCE[\s\:\-]*\n?/i },
      { key: 'elicitPerformance', pattern: /ELICIT PERFORMANCE[\s\:\-]*\n?/i },
      { key: 'provideFeedback', pattern: /PROVIDE FEEDBACK[\s\:\-]*\n?/i },
      { key: 'assessPerformance', pattern: /ASSESS PERFORMANCE[\s\:\-]*\n?/i },
      { key: 'enhanceRetention', pattern: /ENHANCE RETENTION[\s\:\-]*\n?/i }
    ],
    debate: [
      { key: 'topic', pattern: /DEBATE PROPOSITION[\s\:\-]*\n?/i },
      { key: 'forArguments', pattern: /ARGUMENTS FOR[\s\:\-]*\n?/i },
      { key: 'againstArguments', pattern: /ARGUMENTS AGAINST[\s\:\-]*\n?/i },
      { key: 'moderatorGuidelines', pattern: /MODERATOR GUIDELINES[\s\:\-]*\n?/i },
      { key: 'evaluationCriteria', pattern: /EVALUATION CRITERIA[\s\:\-]*\n?/i },
      { key: 'timingStructure', pattern: /TIMING STRUCTURE[\s\:\-]*\n?/i }
    ]
  };

  const patterns = sectionPatterns[template] || [];
  
  if (patterns.length === 0) {
    // For unknown templates, return the whole content
    sections.content = content;
    return sections;
  }

  let remainingContent = content;
  
  // Find each section using patterns
  for (let i = 0; i < patterns.length; i++) {
    const { key, pattern } = patterns[i];
    const match = remainingContent.match(pattern);
    
    if (match) {
      const sectionStart = match.index + match[0].length;
      let sectionEnd = remainingContent.length;
      
      // Find the start of the next section
      for (let j = i + 1; j < patterns.length; j++) {
        const nextPattern = patterns[j].pattern;
        const nextMatch = remainingContent.substring(sectionStart).match(nextPattern);
        if (nextMatch) {
          sectionEnd = sectionStart + nextMatch.index;
          break;
        }
      }
      
      const sectionContent = remainingContent.substring(sectionStart, sectionEnd).trim();
      if (sectionContent) {
        sections[key] = sectionContent;
      }
      
      // Update remaining content to after this section
      remainingContent = remainingContent.substring(sectionEnd);
    } else {
      sections[key] = '';
    }
  }

  // If no sections were found, try alternative parsing
  if (Object.keys(sections).length === 0) {
    console.log('No sections found with standard patterns, trying alternative parsing');
    return parseContentWithHeadings(content, template);
  }

  // Clean up empty sections
  Object.keys(sections).forEach(key => {
    if (!sections[key] || sections[key].trim() === '') {
      delete sections[key];
    }
  });

  console.log(`Parsed sections for ${template}:`, Object.keys(sections));
  return sections;
}

// Alternative parsing method for when standard patterns fail
function parseContentWithHeadings(content, template) {
  const sections = {};
  const lines = content.split('\n');
  let currentSection = 'content';
  let currentContent = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Check if this line is a section heading
    if (trimmedLine && isSectionHeading(trimmedLine, template)) {
      // Save previous section
      if (currentContent.length > 0) {
        sections[currentSection] = currentContent.join('\n').trim();
        currentContent = [];
      }
      
      // Determine new section key
      currentSection = getSectionKeyFromHeading(trimmedLine, template);
    } else {
      currentContent.push(line);
    }
  }

  // Save the last section
  if (currentContent.length > 0) {
    sections[currentSection] = currentContent.join('\n').trim();
  }

  return sections;
}

function isSectionHeading(line, template) {
  const headingPatterns = {
    lesson_plan: [
      /LEARNING OBJECTIVES/i,
      /PRIOR KNOWLEDGE/i,
      /WARM-UP ACTIVITY/i,
      /INTRODUCTION/i,
      /MAIN ACTIVITIES/i,
      /ASSESSMENT STRATEGIES/i,
      /RESOURCES AND MATERIALS/i,
      /DIFFERENTIATION STRATEGIES/i,
      /HOMEWORK\/EXTENSION ACTIVITIES/i
    ],
    project: [
      /PROJECT OBJECTIVES/i,
      /PROCEDURE/i,
      /MATERIALS REQUIRED/i,
      /EXPECTED OUTCOMES/i,
      /EVALUATION CRITERIA/i,
      /TIMELINE/i
    ],
    unit_plan: [
      /UNIT OVERVIEW/i,
      /ESSENTIAL QUESTIONS/i,
      /LEARNING GOALS/i,
      /SESSION BREAKDOWN/i,
      /ASSESSMENT STRATEGIES/i,
      /RESOURCES/i,
      /DIFFERENTIATION/i
    ]
  };

  const patterns = headingPatterns[template] || [];
  return patterns.some(pattern => pattern.test(line));
}

function getSectionKeyFromHeading(heading, template) {
  const headingMap = {
    'lesson_plan': {
      'LEARNING OBJECTIVES': 'objectives',
      'PRIOR KNOWLEDGE': 'priorKnowledge',
      'WARM-UP ACTIVITY': 'warmup',
      'INTRODUCTION': 'introduction',
      'MAIN ACTIVITIES': 'mainActivities',
      'ASSESSMENT STRATEGIES': 'assessment',
      'RESOURCES AND MATERIALS': 'resources',
      'DIFFERENTIATION STRATEGIES': 'differentiation',
      'HOMEWORK/EXTENSION ACTIVITIES': 'homework'
    },
    'project': {
      'PROJECT OBJECTIVES': 'objectives',
      'PROCEDURE': 'procedure',
      'MATERIALS REQUIRED': 'materials',
      'EXPECTED OUTCOMES': 'outcomes',
      'EVALUATION CRITERIA': 'evaluation',
      'TIMELINE': 'timeline'
    },
    'unit_plan': {
      'UNIT OVERVIEW': 'overview',
      'ESSENTIAL QUESTIONS': 'essentialQuestions',
      'LEARNING GOALS': 'learningGoals',
      'SESSION BREAKDOWN': 'sessionBreakdown',
      'ASSESSMENT STRATEGIES': 'assessments',
      'RESOURCES': 'resources',
      'DIFFERENTIATION': 'differentiation'
    }
  };

  const map = headingMap[template] || {};
  for (const [pattern, key] of Object.entries(map)) {
    if (new RegExp(pattern, 'i').test(heading)) {
      return key;
    }
  }

  return 'content';
}

function sectionToTitle(section) {
  const titles = {
    objectives: 'LEARNING OBJECTIVES',
    priorKnowledge: 'PRIOR KNOWLEDGE',
    warmup: 'WARM-UP ACTIVITY',
    introduction: 'INTRODUCTION',
    mainActivities: 'MAIN ACTIVITIES',
    assessment: 'ASSESSMENT STRATEGIES',
    resources: 'RESOURCES AND MATERIALS',
    differentiation: 'DIFFERENTIATION STRATEGIES',
    homework: 'HOMEWORK/EXTENSION ACTIVITIES',
    questions: 'QUESTIONS',
    answerKey: 'ANSWER KEY',
    procedure: 'PROCEDURE',
    materials: 'MATERIALS REQUIRED',
    outcomes: 'EXPECTED OUTCOMES',
    evaluation: 'EVALUATION CRITERIA',
    timeline: 'TIMELINE',
    overview: 'UNIT OVERVIEW',
    essentialQuestions: 'ESSENTIAL QUESTIONS',
    learningGoals: 'LEARNING GOALS',
    sessionBreakdown: 'SESSION BREAKDOWN',
    assessments: 'ASSESSMENT STRATEGIES',
    gainAttention: 'GAIN ATTENTION',
    informObjectives: 'INFORM OBJECTIVES',
    stimulateRecall: 'STIMULATE RECALL',
    presentContent: 'PRESENT CONTENT',
    provideGuidance: 'PROVIDE GUIDANCE',
    elicitPerformance: 'ELICIT PERFORMANCE',
    provideFeedback: 'PROVIDE FEEDBACK',
    assessPerformance: 'ASSESS PERFORMANCE',
    enhanceRetention: 'ENHANCE RETENTION',
    topic: 'DEBATE PROPOSITION',
    forArguments: 'ARGUMENTS FOR',
    againstArguments: 'ARGUMENTS AGAINST',
    moderatorGuidelines: 'MODERATOR GUIDELINES',
    evaluationCriteria: 'EVALUATION CRITERIA',
    timingStructure: 'TIMING STRUCTURE',
    content: 'CONTENT'
  };
  return titles[section] || section.charAt(0).toUpperCase() + section.slice(1);
}

// FIXED AI Generation - WORKING FOR ALL TEMPLATES
router.post('/generate', 
  authenticate, 
  checkPermission('ai', 'generate'),
  trackUsage('generate_ai', 'system'),
  async (req, res) => {
    try {
      const { template, title, grade, subject, curriculum, topics, additionalInstructions, duration, sessions, difficulty, numQuestions } = req.body;

      // ✅ VALIDATE REQUIRED FIELDS
      if (!template) {
        return res.status(400).json({
          success: false,
          message: 'Template is required'
        });
      }

      // ✅ NORMALIZE ALL INPUT DATA
      const normalizedTopics = normalizeTopics(topics);
      const normalizedTitle = normalizeField(title, 'Untitled');
      const normalizedGrade = normalizeField(grade, '1');
      const normalizedSubject = normalizeField(subject, 'General');
      const normalizedCurriculum = normalizeField(curriculum, 'CBSE');
      const normalizedAdditionalInstructions = normalizeField(additionalInstructions, 'None');
      const normalizedDuration = parseInt(normalizeField(duration, 45)) || 45;
      const normalizedSessions = parseInt(normalizeField(sessions, 5)) || 5;
      const normalizedDifficulty = normalizeField(difficulty, 'Medium');
      const normalizedNumQuestions = parseInt(normalizeField(numQuestions, 10)) || 10;

      console.log('Normalized inputs:', {
        template,
        title: normalizedTitle,
        grade: normalizedGrade,
        subject: normalizedSubject,
        curriculum: normalizedCurriculum,
        topics: normalizedTopics,
        duration: normalizedDuration,
        difficulty: normalizedDifficulty,
        numQuestions: normalizedNumQuestions
      });

      // Check daily AI usage limit
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayUsage = await UserActivity.countDocuments({
        user: req.user._id,
        action: 'generate_ai',
        createdAt: { $gte: today }
      });

      const userLimit = req.userPermissions?.ai?.dailyLimit || 10;
      if (todayUsage >= userLimit) {
        return res.status(429).json({ 
          success: false,
          message: `Daily AI generation limit reached (${userLimit}). Please try again tomorrow.` 
        });
      }

      // Use correct model name
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash",
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        }
      });

      let prompt = '';

      // Template-specific prompts for Gemini - IMPROVED FOR ALL TEMPLATES
      switch (template) {
        case 'lesson_plan':
          prompt = `You are an expert ${normalizedCurriculum} curriculum designer for grade ${normalizedGrade} ${normalizedSubject}. Create a comprehensive lesson plan that is practical and classroom-ready.

TOPIC: ${normalizedTitle}
GRADE: ${normalizedGrade}
SUBJECT: ${normalizedSubject}
CURRICULUM: ${normalizedCurriculum}
DURATION: ${normalizedDuration} minutes
KEY TOPICS: ${safeTopicsJoin(normalizedTopics)}
ADDITIONAL REQUIREMENTS: ${normalizedAdditionalInstructions}

Please structure the lesson plan with these clear sections:

LEARNING OBJECTIVES
[3-5 clear, measurable objectives that align with ${normalizedCurriculum} standards]

PRIOR KNOWLEDGE
[What students should already know to be successful]

WARM-UP ACTIVITY (5-7 minutes)
[Engaging starter activity to hook students]

INTRODUCTION (10-12 minutes) 
[Sets context and connects to real-world applications]

MAIN ACTIVITIES (20-25 minutes)
[Hands-on, interactive activities with clear instructions]

ASSESSMENT STRATEGIES
[Both formative and summative assessment ideas]

RESOURCES AND MATERIALS
[Specific resources needed for the lesson]

DIFFERENTIATION STRATEGIES
[Support for struggling students and extensions for advanced learners]

HOMEWORK/EXTENSION ACTIVITIES
[Meaningful reinforcement tasks]

Ensure the content is age-appropriate for grade ${normalizedGrade} and strictly follows ${normalizedCurriculum} guidelines.`;
          break;

        case 'quiz':
          prompt = `You are an experienced ${normalizedCurriculum} assessment specialist for grade ${normalizedGrade} ${normalizedSubject}. Create high-quality multiple choice questions.

TOPIC: ${normalizedTitle}
GRADE: ${normalizedGrade} 
SUBJECT: ${normalizedSubject}
CURRICULUM: ${normalizedCurriculum}
DIFFICULTY: ${normalizedDifficulty}
QUESTIONS: ${normalizedNumQuestions}
DURATION: ${normalizedDuration} minutes
TOPICS: ${safeTopicsJoin(normalizedTopics)}

Create ${normalizedNumQuestions} multiple choice questions with this exact format:

Q1. [Clear question stem that tests understanding]
A) [Plausible option A]
B) [Plausible option B] 
C) [Plausible option C]
D) [Plausible option D]
Correct: [Letter of correct answer]
Explanation: [Brief explanation why this is correct]

Q2. [Next question...]

Requirements:
- ${normalizedNumQuestions} questions total
- 4 plausible options for each question
- Mark correct answer with "Correct: [Letter]"
- Include brief explanation for each
- Mix of factual recall (30%), understanding (40%), and application (30%)
- Appropriate for ${normalizedDifficulty} difficulty level
- Align with ${normalizedCurriculum} standards for grade ${normalizedGrade}
- Return ONLY the questions in the specified format, no introductory text`;
          break;

        case 'project':
          prompt = `You are a project-based learning specialist for ${normalizedCurriculum} grade ${normalizedGrade} ${normalizedSubject}. Design an engaging, practical project.

TOPIC: ${normalizedTitle}
GRADE: ${normalizedGrade}
SUBJECT: ${normalizedSubject} 
CURRICULUM: ${normalizedCurriculum}
DURATION: ${normalizedDuration} days
FOCUS AREAS: ${safeTopicsJoin(normalizedTopics)}
ADDITIONAL: ${normalizedAdditionalInstructions}

Create a comprehensive project plan with these sections:

PROJECT OBJECTIVES
[Clear learning goals and success criteria aligned with ${normalizedCurriculum}]

PROCEDURE
[Step-by-step instructions with day-wise breakdown for ${normalizedDuration} days]

MATERIALS REQUIRED
[Specific materials and resources needed]

EXPECTED OUTCOMES
[What students should produce and learn]

EVALUATION CRITERIA
[Detailed rubric with clear assessment criteria]

TIMELINE
[Project milestones and deadlines]

Make the project hands-on, engaging, and achievable for grade ${normalizedGrade} students.`;
          break;

        case 'unit_plan':
          prompt = `You are a unit planning expert for ${normalizedCurriculum} grade ${normalizedGrade} ${normalizedSubject}. Create a comprehensive unit plan.

TOPIC: ${normalizedTitle}
GRADE: ${normalizedGrade}
SUBJECT: ${normalizedSubject}
CURRICULUM: ${normalizedCurriculum} 
SESSIONS: ${normalizedSessions}
KEY CONCEPTS: ${safeTopicsJoin(normalizedTopics)}

Create a ${normalizedSessions}-session unit plan with:

UNIT OVERVIEW
[Big ideas and central concepts]

ESSENTIAL QUESTIONS
[3-5 guiding questions that drive inquiry]

LEARNING GOALS
[What students will know and be able to do]

SESSION BREAKDOWN
[Detailed plan for each of the ${normalizedSessions} sessions]

ASSESSMENT STRATEGIES
[Formative and summative assessments throughout the unit]

RESOURCES
[Materials and resources needed]

DIFFERENTIATION
[Strategies for diverse learners]

Ensure progressive complexity across the ${normalizedSessions} sessions.`;
          break;

        case 'gagne_lesson_plan':
          prompt = `You are an instructional design expert using Gagné's Nine Events. Create a structured lesson plan.

TOPIC: ${normalizedTitle}
GRADE: ${normalizedGrade}
SUBJECT: ${normalizedSubject}
CURRICULUM: ${normalizedCurriculum}
DURATION: ${normalizedDuration} minutes

Follow Gagné's Nine Events structure with timing:

GAIN ATTENTION (5 minutes)
[Hook students with engaging starter]

INFORM OBJECTIVES (3 minutes)  
[Clearly state what students will learn]

STIMULATE RECALL (7 minutes)
[Activate prior knowledge]

PRESENT CONTENT (15 minutes)
[Deliver new information effectively]

PROVIDE GUIDANCE (10 minutes)
[Scaffold learning with examples]

ELICIT PERFORMANCE (15 minutes)
[Students practice and apply]

PROVIDE FEEDBACK (10 minutes)
[Correct and reinforce learning]

ASSESS PERFORMANCE (10 minutes)
[Evaluate understanding]

ENHANCE RETENTION (5 minutes)
[Transfer learning to new contexts]

Make each event clear and pedagogically sound for grade ${normalizedGrade}.`;
          break;

        case 'debate':
          prompt = `You are a debate coordinator for ${normalizedCurriculum} grade ${normalizedGrade} ${normalizedSubject}. Design a structured debate.

TOPIC: ${normalizedTitle}
GRADE: ${normalizedGrade}
SUBJECT: ${normalizedSubject}
CURRICULUM: ${normalizedCurriculum}
DURATION: ${normalizedDuration} minutes

Create a comprehensive debate structure:

DEBATE PROPOSITION
[Clear statement to debate]

ARGUMENTS FOR (PROS)
[3-5 strong arguments with supporting evidence]

ARGUMENTS AGAINST (CONS) 
[3-5 strong counter-arguments with evidence]

MODERATOR GUIDELINES
[Script and instructions for moderator]

EVALUATION CRITERIA
[Rubric for judging the debate]

TIMING STRUCTURE
[Detailed timing for each phase]

Ensure balanced perspectives and age-appropriate complexity.`;
          break;

        default:
          prompt = `Create comprehensive educational content for ${normalizedCurriculum} curriculum, Grade ${normalizedGrade} ${normalizedSubject} on topic "${normalizedTitle}".

Additional Instructions: ${normalizedAdditionalInstructions}
Topics: ${safeTopicsJoin(normalizedTopics)}

Create engaging, age-appropriate content that aligns with ${normalizedCurriculum} standards.`;
      }

      console.log('Sending prompt to Gemini AI...');
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const content = response.text();

      console.log('Gemini AI Response received successfully');
      console.log('Raw content length:', content.length);

      // Parse the response into sections based on template
      const sections = parseAIContent(content, template);
      console.log('Parsed sections:', Object.keys(sections));

      // Calculate tokens (approximate)
      const estimatedTokens = Math.ceil(content.length / 4);

      // ✅ FIXED: Create lesson data WITHOUT DUPLICATES
      const lessonData = {
        title: normalizedTitle,
        template,
        grade: normalizedGrade,
        subject: normalizedSubject,
        curriculum: normalizedCurriculum,
        duration: normalizedDuration,
        topics: normalizedTopics,
        additionalDetails: normalizedAdditionalInstructions,
        createdBy: req.user._id,
        sections: {},
        contentHash: crypto.createHash('md5').update(content).digest('hex'),
        aiGenerated: true
      };

      // Add template-specific fields
      if (template === 'unit_plan') lessonData.sessions = normalizedSessions;
      if (template === 'quiz') {
        lessonData.difficulty = normalizedDifficulty;
        lessonData.numQuestions = normalizedNumQuestions;
      }

      // ✅ FIXED: Populate sections WITHOUT DUPLICATING CONTENT
      Object.keys(sections).forEach(sectionKey => {
        if (sections[sectionKey] && sections[sectionKey].trim()) {
          lessonData.sections[sectionKey] = {
            text: sections[sectionKey].trim(),
            prompt: prompt,
            isGenerated: true,
            lastRegenerated: new Date(),
            contentHash: crypto.createHash('md5').update(sections[sectionKey]).digest('hex')
          };
        }
      });

      // ✅ Check for existing similar lessons to prevent duplicates
      const existingLesson = await Lesson.findOne({
        createdBy: req.user._id,
        title: normalizedTitle,
        template: template,
        'contentHash': lessonData.contentHash
      });

      let savedLesson;
      
      if (existingLesson) {
        console.log('Similar lesson found, updating instead of creating duplicate');
        // Update existing lesson
        Object.assign(existingLesson, lessonData);
        savedLesson = await existingLesson.save();
      } else {
        // Create new lesson
        savedLesson = new Lesson(lessonData);
        await savedLesson.save();
      }

      // Populate creator info
      await savedLesson.populate('createdBy', 'name email');

      // Track AI usage
      await UserActivity.create({
        user: req.user._id,
        action: 'generate_ai',
        details: {
          template,
          title: normalizedTitle,
          tokens: estimatedTokens,
          lessonId: savedLesson._id
        }
      });

      res.json({
        success: true,
        content: sections,
        rawContent: content,
        tokens: estimatedTokens,
        model: "gemini-2.0-flash",
        lesson: savedLesson,
        lessonId: savedLesson._id,
        usage: {
          today: todayUsage + 1,
          limit: userLimit,
          remaining: userLimit - (todayUsage + 1)
        }
      });

    } catch (error) {
      console.error('Gemini AI Generation Error:', error);
      
      let errorMessage = 'AI generation failed';
      if (error.message.includes('API key not valid')) {
        errorMessage = 'Invalid Gemini API key. Please check your configuration.';
      } else if (error.message.includes('quota')) {
        errorMessage = 'AI service quota exceeded. Please try again later.';
      } else if (error.message.includes('safety')) {
        errorMessage = 'Content blocked by safety filters. Please modify your request.';
      } else if (error.message.includes('not found')) {
        errorMessage = 'AI model not available. Please check model configuration.';
      }
      
      res.status(500).json({ 
        success: false,
        message: errorMessage, 
        error: error.message
      });
    }
  }
);

// Rest of the code remains the same as your previous working version...
// [Include all the other endpoints: regenerate, download, test, models, sections, usage]

// FIXED Regenerate endpoint - PREVENT DUPLICATES
router.post('/regenerate', 
  authenticate, 
  checkPermission('ai', 'regenerate'),
  trackUsage('generate_ai', 'system'),
  async (req, res) => {
    try {
      const { lessonId, section, tweak } = req.body;

      if (!lessonId || !section) {
        return res.status(400).json({
          success: false,
          message: 'Lesson ID and section are required'
        });
      }

      // ✅ Get the lesson from database
      const lesson = await Lesson.findById(lessonId)
        .populate('createdBy', 'name email');

      if (!lesson) {
        return res.status(404).json({
          success: false,
          message: 'Lesson not found'
        });
      }

      // Check if user has permission to regenerate this lesson
      if (lesson.createdBy._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only regenerate your own lessons'
        });
      }

      // Get the current section content and context
      const currentSection = lesson.sections[section];
      if (!currentSection || !currentSection.text) {
        return res.status(400).json({
          success: false,
          message: `Section '${section}' not found or empty in this lesson`
        });
      }

      const currentContent = currentSection.text;
      const originalPrompt = currentSection.prompt || '';

      // Prepare context for regeneration
      const context = `
Lesson: ${lesson.title}
Grade: ${lesson.grade}
Subject: ${lesson.subject} 
Curriculum: ${lesson.curriculum}
Template: ${lesson.template}
${lesson.duration ? `Duration: ${lesson.duration} minutes` : ''}
${lesson.topics?.length ? `Topics: ${lesson.topics.join(', ')}` : ''}
${lesson.additionalDetails ? `Additional Details: ${lesson.additionalDetails}` : ''}
      `.trim();

      // Use correct model
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash",
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        }
      });

      const regeneratePrompt = `You are an educational content expert. Regenerate the ${section} section.

CONTEXT: ${context}
ORIGINAL PROMPT: ${originalPrompt}
CURRENT CONTENT: ${currentContent}
IMPROVEMENT REQUEST: ${tweak || 'Please improve this section with more engaging and effective content.'}

Please provide an enhanced version that:
- Maintains educational standards and alignment with the context
- Is more engaging, effective, and age-appropriate
- Incorporates the requested improvements
- Maintains consistency with the overall lesson

Provide only the regenerated content without additional explanations.`;

      const result = await model.generateContent(regeneratePrompt);
      const response = await result.response;
      const regeneratedContent = response.text().trim();

      // ✅ Check if content is actually different to prevent duplicates
      const newContentHash = crypto.createHash('md5').update(regeneratedContent).digest('hex');
      const oldContentHash = crypto.createHash('md5').update(currentContent).digest('hex');

      if (newContentHash === oldContentHash) {
        return res.json({
          success: true,
          content: currentContent,
          tokens: 0,
          section: section,
          lesson: lesson,
          version: lesson.currentVersion,
          message: 'Content unchanged - no regeneration needed'
        });
      }

      // ✅ Update the lesson with regenerated content
      lesson.sections[section] = {
        text: regeneratedContent,
        prompt: originalPrompt,
        isGenerated: true,
        lastRegenerated: new Date(),
        contentHash: newContentHash
      };

      // Update overall content hash
      lesson.contentHash = crypto.createHash('md5')
        .update(JSON.stringify(lesson.sections))
        .digest('hex');

      // Add to version history
      if (!lesson.versions) lesson.versions = [];
      lesson.versions.push({
        versionNumber: (lesson.currentVersion || 0) + 1,
        snapshot: {
          section: section,
          previousContent: currentContent,
          newContent: regeneratedContent,
          tweak: tweak
        },
        description: `Regenerated ${section} section: ${tweak || 'General improvement'}`,
        createdBy: req.user._id,
        createdAt: new Date()
      });

      lesson.currentVersion = (lesson.currentVersion || 0) + 1;
      lesson.updatedAt = new Date();
      await lesson.save();

      // Calculate tokens
      const estimatedTokens = Math.ceil(regeneratedContent.length / 4);

      // Track regeneration usage
      await UserActivity.create({
        user: req.user._id,
        action: 'generate_ai',
        details: {
          template: 'regenerate',
          section: section,
          lessonId: lessonId,
          tokens: estimatedTokens
        }
      });

      res.json({
        success: true,
        content: regeneratedContent,
        tokens: estimatedTokens,
        section: section,
        lesson: lesson,
        version: lesson.currentVersion
      });

    } catch (error) {
      console.error('Gemini AI Regeneration Error:', error);
      res.status(500).json({ 
        success: false,
        message: 'AI regeneration failed', 
        error: error.message 
      });
    }
  }
);

// NEW: Download lesson content without duplicates
router.get('/lesson/:id/download', 
  authenticate,
  async (req, res) => {
    try {
      const lesson = await Lesson.findById(req.params.id)
        .populate('createdBy', 'name email');

      if (!lesson) {
        return res.status(404).json({
          success: false,
          message: 'Lesson not found'
        });
      }

      // Check if user has permission to access this lesson
      if (lesson.createdBy._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this lesson'
        });
      }

      // ✅ FIXED: Generate clean content without duplicates
      let downloadContent = `Lesson: ${lesson.title}\n`;
      downloadContent += `Grade: ${lesson.grade}\n`;
      downloadContent += `Subject: ${lesson.subject}\n`;
      downloadContent += `Curriculum: ${lesson.curriculum}\n`;
      downloadContent += `Template: ${lesson.template}\n`;
      if (lesson.duration) downloadContent += `Duration: ${lesson.duration} minutes\n`;
      if (lesson.sessions) downloadContent += `Sessions: ${lesson.sessions}\n`;
      downloadContent += `Created By: ${lesson.createdBy.name}\n`;
      downloadContent += `Created At: ${lesson.createdAt.toLocaleDateString()}\n\n`;
      downloadContent += '='.repeat(50) + '\n\n';

      // Add sections content without duplication
      Object.keys(lesson.sections || {}).forEach(sectionKey => {
        const section = lesson.sections[sectionKey];
        if (section && section.text && section.text.trim()) {
          downloadContent += `${sectionToTitle(sectionKey).toUpperCase()}\n`;
          downloadContent += '='.repeat(30) + '\n';
          downloadContent += section.text.trim() + '\n\n';
        }
      });

      // Set headers for download
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${lesson.title.replace(/[^a-zA-Z0-9]/g, '_')}.txt"`);

      res.send(downloadContent);

    } catch (error) {
      console.error('Download Error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to download lesson',
        error: error.message
      });
    }
  }
);

// Test Gemini AI connection
router.get('/test', 
  authenticate, 
  checkPermission('ai', 'generate'),
  async (req, res) => {
    try {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash"
      });

      const result = await model.generateContent("Hello! Please respond with 'Gemini AI 2.0 Flash is working perfectly!' if you can read this message.");
      const response = await result.response;
      const text = response.text();

      res.json({
        success: true,
        message: 'Gemini AI 2.0 Flash connection successful!',
        response: text,
        workingModel: "gemini-2.0-flash",
        status: 'connected'
      });

    } catch (error) {
      console.error('Gemini AI Test Error:', error);
      res.status(500).json({
        success: false,
        message: 'Gemini AI connection failed',
        error: error.message,
        status: 'disconnected'
      });
    }
  }
);

// Get available models
router.get('/models', 
  authenticate, 
  async (req, res) => {
    try {
      const availableModels = [
        {
          name: "gemini-2.0-flash",
          description: "Fastest model for most tasks - RECOMMENDED",
          supported: true
        },
        {
          name: "gemini-2.5-flash", 
          description: "Latest flash model with improved capabilities",
          supported: true
        },
        {
          name: "gemini-2.5-pro",
          description: "Most capable model for complex tasks",
          supported: true
        }
      ];

      res.json({
        success: true,
        models: availableModels,
        recommended: "gemini-2.0-flash",
        note: "All models are available with your API key"
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get model list',
        error: error.message
      });
    }
  }
);

// Get lesson sections for regeneration
router.get('/lesson/:id/sections', 
  authenticate,
  async (req, res) => {
    try {
      const lesson = await Lesson.findById(req.params.id)
        .select('sections title template grade subject curriculum')
        .populate('createdBy', 'name email');

      if (!lesson) {
        return res.status(404).json({
          success: false,
          message: 'Lesson not found'
        });
      }

      // Check if user has permission to access this lesson
      if (lesson.createdBy._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this lesson'
        });
      }

      // Get available sections for regeneration
      const availableSections = Object.keys(lesson.sections || {})
        .filter(section => lesson.sections[section]?.text)
        .map(section => ({
          name: section,
          label: sectionToTitle(section),
          content: lesson.sections[section].text,
          isGenerated: lesson.sections[section].isGenerated || false,
          lastRegenerated: lesson.sections[section].lastRegenerated
        }));

      res.json({
        success: true,
        lesson: {
          id: lesson._id,
          title: lesson.title,
          template: lesson.template,
          grade: lesson.grade,
          subject: lesson.subject,
          curriculum: lesson.curriculum
        },
        availableSections
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch lesson sections',
        error: error.message
      });
    }
  }
);

// AI Usage Analytics for user
router.get('/usage', authenticate, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const usage = await UserActivity.aggregate([
      {
        $match: {
          user: req.user._id,
          action: 'generate_ai',
          createdAt: { $gte: new Date(today.getFullYear(), today.getMonth(), 1) }
        }
      },
      {
        $group: {
          _id: {
            day: { $dayOfMonth: '$createdAt' },
            month: { $month: '$createdAt' },
            year: { $year: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    const userLimit = req.userPermissions?.ai?.dailyLimit || 10;
    const todayUsage = await UserActivity.countDocuments({
      user: req.user._id,
      action: 'generate_ai',
      createdAt: { $gte: today }
    });

    res.json({
      success: true,
      monthlyUsage: usage,
      todayUsage,
      dailyLimit: userLimit,
      remainingToday: Math.max(0, userLimit - todayUsage)
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch usage data', 
      error: error.message 
    });
  }
});

export default router;