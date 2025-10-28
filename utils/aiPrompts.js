// AI Prompt templates for Gemini AI
export const promptTemplates = {
  lesson_plan: {
    system: (curriculum, grade, subject) => 
      `You are an expert ${curriculum} curriculum designer for grade ${grade} ${subject}. 
      Create comprehensive, engaging lesson plans that are age-appropriate and aligned with ${curriculum} standards.
      Focus on active learning, differentiation, and practical classroom implementation.`,
    
    user: (data) =>
      `Create a ${data.duration}-minute lesson plan for grade ${data.grade} ${data.subject} on "${data.title}".
      Curriculum: ${data.curriculum}
      Key Topics: ${data.topics?.join(', ') || 'Not specified'}
      Additional Requirements: ${data.additionalInstructions || 'None'}
      
      Structure your response with these clear sections:
      
      LEARNING OBJECTIVES
      [3-5 clear, measurable objectives]
      
      PRIOR KNOWLEDGE
      [What students should already know]
      
      WARM-UP ACTIVITY
      [5-7 minutes, engaging starter]
      
      INTRODUCTION
      [10-12 minutes, sets context]
      
      MAIN ACTIVITIES
      [20-25 minutes, hands-on and interactive]
      
      ASSESSMENT STRATEGIES
      [Formative and summative assessment ideas]
      
      RESOURCES AND MATERIALS
      [List of required resources]
      
      DIFFERENTIATION STRATEGIES
      [For varied learning needs]
      
      HOMEWORK/EXTENSION ACTIVITIES
      [Reinforcement and extension tasks]
      
      Make it practical, classroom-ready, and aligned with ${data.curriculum} competencies.`
  },

  quiz: {
    system: (curriculum, grade, subject) =>
      `You are an experienced ${curriculum} assessment specialist for grade ${grade} ${subject}.
      Create high-quality multiple choice questions that accurately assess understanding and application.`,
    
    user: (data) =>
      `Create a ${data.numQuestions || 10}-question ${data.difficulty} level quiz for grade ${data.grade} ${data.subject} on "${data.title}".
      Curriculum: ${data.curriculum}
      Topics: ${data.topics?.join(', ') || 'General concepts'}
      Duration: ${data.duration} minutes
      
      Format each question as:
      Q1. [Question text]
      A) [Option A]
      B) [Option B]
      C) [Option C]
      D) [Option D]
      Correct: [Letter of correct answer]
      Explanation: [Brief explanation of why this is correct]
      
      Requirements:
      - ${data.numQuestions || 10} multiple choice questions
      - 4 plausible options for each question
      - Clearly mark correct answer with "Correct: [Letter]"
      - Brief explanation for each answer
      - Questions should test understanding, application, and analysis
      - Mix of factual recall and higher-order thinking questions
      - Appropriate for ${data.difficulty} difficulty level`
  },

  project: {
    system: (curriculum, grade, subject) =>
      `You are a creative project-based learning specialist for ${curriculum} grade ${grade} ${subject}.
      Design engaging, hands-on projects that develop critical thinking and real-world skills.`,
    
    user: (data) =>
      `Design a ${data.duration}-day project for grade ${data.grade} ${data.subject} on "${data.title}".
      Curriculum: ${data.curriculum}
      Focus Areas: ${data.topics?.join(', ') || 'Core concepts'}
      Additional Details: ${data.additionalDetails || 'None'}
      
      Structure your response with these sections:
      
      PROJECT OBJECTIVES
      [Clear learning objectives and success criteria]
      
      PROCEDURE
      [Step-by-step procedure with day-wise breakdown]
      
      MATERIALS
      [Required materials and resources]
      
      EXPECTED OUTCOMES
      [Expected learning outcomes and deliverables]
      
      EVALUATION CRITERIA
      [Evaluation rubric with clear criteria]
      
      TIMELINE
      [Project timeline and milestones]
      
      Make it practical, engaging, and aligned with ${data.curriculum} standards.`
  }
};

export const getAIPrompt = (template, data) => {
  const templateConfig = promptTemplates[template];
  if (!templateConfig) {
    return {
      system: "You are an expert educational content creator.",
      user: `Create educational content about: ${JSON.stringify(data)}`
    };
  }

  return {
    system: templateConfig.system(data.curriculum, data.grade, data.subject),
    user: templateConfig.user(data)
  };
};