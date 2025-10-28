import mongoose from 'mongoose';

const fieldSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['text', 'select', 'number', 'textarea', 'date'],
    required: true
  },
  options: [{
    value: String,
    label: String
  }],
  required: {
    type: Boolean,
    default: false
  },
  label: {
    type: String,
    required: true
  },
  placeholder: String,
  validation: {
    min: Number,
    max: Number,
    pattern: String
  }
});

const templateSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    enum: ['lesson_plan', 'unit_plan', 'quiz', 'project', 'gagne_lesson_plan', 'debate', 'blank']
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    default: '📝'
  },
  category: {
    type: String,
    enum: ['lesson', 'assessment', 'project', 'other'],
    default: 'lesson'
  },
  fields: [fieldSchema],
  sections: [{
    name: String,
    label: String,
    description: String,
    required: Boolean
  }],
  aiPrompt: String,
  isActive: {
    type: Boolean,
    default: true
  },
  version: {
    type: String,
    default: '1.0.0'
  }
}, {
  timestamps: true
});

// Index for efficient queries
templateSchema.index({ key: 1, isActive: 1 });
templateSchema.index({ category: 1 });

// Static method to get active templates
templateSchema.statics.getActiveTemplates = function() {
  return this.find({ isActive: true }).sort({ title: 1 });
};

// Instance method to get template fields for form
templateSchema.methods.getFormFields = function() {
  return this.fields.map(field => ({
    name: field.name,
    type: field.type,
    options: field.options,
    required: field.required,
    label: field.label,
    placeholder: field.placeholder,
    validation: field.validation
  }));
};

export default mongoose.model('Template', templateSchema);