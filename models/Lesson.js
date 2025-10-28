import mongoose from 'mongoose';

const sectionSchema = new mongoose.Schema({
  text: {  // ✅ Changed from 'content' to 'text' to match AI routes
    type: String,
    default: ''
  },
  prompt: {
    type: String,
    default: ''
  },
  order: Number,
  isGenerated: {
    type: Boolean,
    default: false
  },
  lastRegenerated: {
    type: Date,
    default: Date.now
  },
  wordCount: {
    type: Number,
    default: 0
  }
});

const aiCallSchema = new mongoose.Schema({
  endpoint: String,
  promptHash: String,
  tokens: Number,
  model: String,
  duration: Number,
  cost: Number,
  date: { 
    type: Date, 
    default: Date.now 
  }
});

const versionSchema = new mongoose.Schema({
  versionNumber: {
    type: Number,
    default: 1
  },
  snapshot: mongoose.Schema.Types.Mixed,
  description: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const lessonSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  template: {
    type: String,
    required: true,
    enum: ['lesson_plan', 'unit_plan', 'quiz', 'project', 'gagne_lesson_plan', 'debate', 'blank']
  },
  grade: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  curriculum: {
    type: String,
    required: true,
    enum: ['CBSE', 'NCERT', 'NEP2020', 'NCF2023', 'Australian_v9']
  },
  duration: {
    type: Number,
    required: function() {
      return this.template !== 'blank';
    }
  },
  topics: [{
    type: String,
    trim: true
  }],
  competencies: [{
    id: String,
    statement: String
  }],
  additionalDetails: {
    type: String,
    default: ''
  },
  
  // Template-specific fields
  sessions: {
    type: Number,
    required: function() {
      return this.template === 'unit_plan';
    }
  },
  difficulty: {
    type: String,
    enum: ['Easy', 'Medium', 'Hard'],
    required: function() {
      return this.template === 'quiz';
    }
  },
  numQuestions: {
    type: Number,
    required: function() {
      return this.template === 'quiz';
    }
  },

  // ✅ UPDATED: Content sections structure to match AI routes
  sections: {
    // Common sections
    objectives: {
      type: sectionSchema,
      default: () => ({})
    },
    activities: {
      type: sectionSchema,
      default: () => ({})
    },
    assessment: {
      type: sectionSchema,
      default: () => ({})
    },
    resources: {
      type: sectionSchema,
      default: () => ({})
    },
    differentiation: {
      type: sectionSchema,
      default: () => ({})
    },
    notes: {
      type: sectionSchema,
      default: () => ({})
    },
    
    // Lesson plan specific
    priorKnowledge: {
      type: sectionSchema,
      default: () => ({})
    },
    warmup: {
      type: sectionSchema,
      default: () => ({})
    },
    introduction: {
      type: sectionSchema,
      default: () => ({})
    },
    mainActivities: {
      type: sectionSchema,
      default: () => ({})
    },
    homework: {
      type: sectionSchema,
      default: () => ({})
    },
    
    // Quiz specific
    questions: {
      type: sectionSchema,
      default: () => ({})
    },
    answerKey: {
      type: sectionSchema,
      default: () => ({})
    },
    
    // Project specific
    procedure: {
      type: sectionSchema,
      default: () => ({})
    },
    materials: {
      type: sectionSchema,
      default: () => ({})
    },
    outcomes: {
      type: sectionSchema,
      default: () => ({})
    },
    evaluation: {
      type: sectionSchema,
      default: () => ({})
    },
    timeline: {
      type: sectionSchema,
      default: () => ({})
    },
    
    // Gagné specific
    gainAttention: {
      type: sectionSchema,
      default: () => ({})
    },
    informObjectives: {
      type: sectionSchema,
      default: () => ({})
    },
    stimulateRecall: {
      type: sectionSchema,
      default: () => ({})
    },
    presentContent: {
      type: sectionSchema,
      default: () => ({})
    },
    provideGuidance: {
      type: sectionSchema,
      default: () => ({})
    },
    elicitPerformance: {
      type: sectionSchema,
      default: () => ({})
    },
    provideFeedback: {
      type: sectionSchema,
      default: () => ({})
    },
    assessPerformance: {
      type: sectionSchema,
      default: () => ({})
    },
    enhanceRetention: {
      type: sectionSchema,
      default: () => ({})
    },
    
    // Debate specific
    topic: {
      type: sectionSchema,
      default: () => ({})
    },
    forArguments: {
      type: sectionSchema,
      default: () => ({})
    },
    againstArguments: {
      type: sectionSchema,
      default: () => ({})
    },
    moderatorGuidelines: {
      type: sectionSchema,
      default: () => ({})
    },
    evaluationCriteria: {
      type: sectionSchema,
      default: () => ({})
    },
    timingStructure: {
      type: sectionSchema,
      default: () => ({})
    }
  },

  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  organization: {
    type: String,
    default: ''
  },
  
  // AI Metadata
  aiMetadata: {
    model: {
      type: String,
      default: ''
    },
    totalTokens: {
      type: Number,
      default: 0
    },
    totalCost: {
      type: Number,
      default: 0
    },
    calls: [aiCallSchema],
    lastGenerated: {
      type: Date,
      default: Date.now
    }
  },

  // Versioning
  versions: [versionSchema],
  currentVersion: {
    type: Number,
    default: 1
  },

  // Publishing and sharing
  published: {
    type: Boolean,
    default: false
  },
  sharedWith: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    permission: {
      type: String,
      enum: ['view', 'edit'],
      default: 'view'
    },
    sharedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // SEO and discovery
  tags: [String],
  keywords: [String],
  
  // Analytics
  views: {
    type: Number,
    default: 0
  },
  downloads: {
    type: Number,
    default: 0
  },
  shares: {
    type: Number,
    default: 0
  },

  // Status
  status: {
    type: String,
    enum: ['draft', 'review', 'published', 'archived'],
    default: 'draft'
  },

  isActive: {
    type: Boolean,
    default: true
  }

}, {
  timestamps: true
});

// Indexes for performance
lessonSchema.index({ createdBy: 1, updatedAt: -1 });
lessonSchema.index({ template: 1, grade: 1, subject: 1 });
lessonSchema.index({ curriculum: 1, grade: 1 });
lessonSchema.index({ published: 1, status: 1 });
lessonSchema.index({ tags: 1 });
lessonSchema.index({ 'sharedWith.user': 1 });

// ✅ UPDATED: Virtual for total word count
lessonSchema.virtual('wordCount').get(function() {
  let count = 0;
  Object.values(this.sections).forEach(section => {
    if (section && section.text) {  // ✅ Changed from 'content' to 'text'
      count += section.text.split(/\s+/).length;
    }
  });
  return count;
});

// Virtual for estimated reading time
lessonSchema.virtual('readingTime').get(function() {
  const wordsPerMinute = 200;
  return Math.ceil(this.wordCount / wordsPerMinute);
});

// ✅ UPDATED: Method to add a new version
lessonSchema.methods.addVersion = function(description = 'Auto-save') {
  const versionData = this.toObject();
  delete versionData._id;
  delete versionData.__v;
  
  this.versions.push({
    versionNumber: this.currentVersion + 1,
    snapshot: versionData,
    description,
    createdBy: this.createdBy,
    createdAt: new Date()
  });
  
  this.currentVersion += 1;
  return this.save();
};

// Method to restore a version
lessonSchema.methods.restoreVersion = function(versionNumber) {
  const version = this.versions.find(v => v.versionNumber === versionNumber);
  if (!version) {
    throw new Error(`Version ${versionNumber} not found`);
  }
  
  // Restore from snapshot
  const restoredData = version.snapshot;
  Object.keys(restoredData).forEach(key => {
    if (key !== '_id' && key !== '__v' && key !== 'versions' && key !== 'currentVersion') {
      this[key] = restoredData[key];
    }
  });
  
  return this.save();
};

// ✅ NEW: Method to update section with AI content
lessonSchema.methods.updateSectionWithAI = function(sectionName, content, prompt, isGenerated = true) {
  if (!this.sections[sectionName]) {
    this.sections[sectionName] = {};
  }
  
  this.sections[sectionName].text = content;
  this.sections[sectionName].prompt = prompt;
  this.sections[sectionName].isGenerated = isGenerated;
  this.sections[sectionName].lastRegenerated = new Date();
  this.sections[sectionName].wordCount = content.split(/\s+/).length;
  
  return this.save();
};

// ✅ NEW: Method to get section content
lessonSchema.methods.getSectionContent = function(sectionName) {
  return this.sections[sectionName]?.text || '';
};

// ✅ NEW: Method to check if section exists and has content
lessonSchema.methods.hasSectionContent = function(sectionName) {
  return !!(this.sections[sectionName] && this.sections[sectionName].text);
};

// ✅ NEW: Method to get all sections with content
lessonSchema.methods.getSectionsWithContent = function() {
  const sectionsWithContent = [];
  
  Object.keys(this.sections).forEach(sectionName => {
    if (this.sections[sectionName] && this.sections[sectionName].text) {
      sectionsWithContent.push({
        name: sectionName,
        content: this.sections[sectionName].text,
        isGenerated: this.sections[sectionName].isGenerated || false,
        lastRegenerated: this.sections[sectionName].lastRegenerated
      });
    }
  });
  
  return sectionsWithContent;
};

// Static method to get published lessons
lessonSchema.statics.getPublishedLessons = function(filters = {}) {
  const query = { published: true, status: 'published', isActive: true };
  return this.find({ ...query, ...filters })
    .populate('createdBy', 'name email')
    .sort({ updatedAt: -1 });
};

// Static method to get user's lessons
lessonSchema.statics.getUserLessons = function(userId, filters = {}) {
  const query = { createdBy: userId, isActive: true };
  return this.find({ ...query, ...filters })
    .populate('createdBy', 'name email')
    .sort({ updatedAt: -1 });
};

// ✅ NEW: Static method to get lesson by ID with creator
lessonSchema.statics.getLessonById = function(lessonId, userId = null) {
  const query = { _id: lessonId, isActive: true };
  
  if (userId) {
    query.$or = [
      { createdBy: userId },
      { published: true },
      { 'sharedWith.user': userId }
    ];
  }
  
  return this.findOne(query)
    .populate('createdBy', 'name email')
    .populate('sharedWith.user', 'name email');
};

// ✅ NEW: Static method to create lesson from AI data
lessonSchema.statics.createFromAIData = function(aiData, userId) {
  const lessonData = {
    title: aiData.title,
    template: aiData.template,
    grade: aiData.grade,
    subject: aiData.subject,
    curriculum: aiData.curriculum,
    duration: aiData.duration,
    topics: aiData.topics || [],
    additionalDetails: aiData.additionalInstructions || '',
    createdBy: userId,
    sections: {},
    aiMetadata: {
      model: aiData.model || 'gemini-2.0-flash',
      totalTokens: aiData.tokens || 0,
      lastGenerated: new Date()
    }
  };

  // Add template-specific fields
  if (aiData.template === 'unit_plan') lessonData.sessions = aiData.sessions;
  if (aiData.template === 'quiz') {
    lessonData.difficulty = aiData.difficulty;
    lessonData.numQuestions = aiData.numQuestions;
  }

  return new this(lessonData);
};

// Pre-save middleware to update AI metadata
lessonSchema.pre('save', function(next) {
  // Update total tokens and cost
  if (this.aiMetadata && this.aiMetadata.calls) {
    this.aiMetadata.totalTokens = this.aiMetadata.calls.reduce((sum, call) => sum + (call.tokens || 0), 0);
    this.aiMetadata.totalCost = this.aiMetadata.calls.reduce((sum, call) => sum + (call.cost || 0), 0);
  }
  
  // Ensure all sections have proper structure
  Object.keys(this.sections).forEach(sectionKey => {
    if (this.sections[sectionKey]) {
      if (!this.sections[sectionKey].text) this.sections[sectionKey].text = '';
      if (!this.sections[sectionKey].prompt) this.sections[sectionKey].prompt = '';
      if (this.sections[sectionKey].isGenerated === undefined) this.sections[sectionKey].isGenerated = false;
      if (!this.sections[sectionKey].lastRegenerated) this.sections[sectionKey].lastRegenerated = new Date();
      if (!this.sections[sectionKey].wordCount && this.sections[sectionKey].text) {
        this.sections[sectionKey].wordCount = this.sections[sectionKey].text.split(/\s+/).length;
      }
    }
  });
  
  next();
});

// ✅ NEW: Post-save middleware to ensure data consistency
lessonSchema.post('save', function(doc) {
  console.log(`Lesson saved: ${doc.title} (ID: ${doc._id})`);
  console.log(`Sections with content: ${doc.getSectionsWithContent().length}`);
});

export default mongoose.model('Lesson', lessonSchema);