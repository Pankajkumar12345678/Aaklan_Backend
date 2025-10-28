import mongoose from 'mongoose';

const indicatorSchema = new mongoose.Schema({
  id: String,
  statement: String,
  code: String
});

const competencySchema = new mongoose.Schema({
  id: String,
  statement: String,
  code: String,
  indicators: [indicatorSchema],
  subjectCode: String
});

const subjectSchema = new mongoose.Schema({
  subjectName: String,
  subjectCode: String,
  competencies: [competencySchema]
});

const curriculumMapSchema = new mongoose.Schema({
  curriculumKey: {
    type: String,
    required: true,
    enum: ['CBSE', 'NCERT', 'NEP2020', 'NCF2023', 'Australian_v9']
  },
  grade: {
    type: String,
    required: true
  },
  subjects: [subjectSchema],
  source: String,
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
curriculumMapSchema.index({ curriculumKey: 1, grade: 1 });
curriculumMapSchema.index({ 'subjects.subjectName': 1 });

export default mongoose.model('CurriculumMap', curriculumMapSchema);