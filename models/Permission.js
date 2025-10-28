import mongoose from 'mongoose';

const permissionSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['teacher', 'student', 'admin', 'custom'],
    required: true,
    unique: true
  },
  permissions: {
    // Template permissions
    templates: {
      create: { type: Boolean, default: false },
      read: { type: Boolean, default: false },
      update: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
      access: [{
        type: String,
        enum: ['lesson_plan', 'unit_plan', 'quiz', 'project', 'gagne_lesson_plan', 'debate', 'blank']
      }]
    },
    
    // Content permissions
    content: {
      create: { type: Boolean, default: false },
      read: { type: Boolean, default: false },
      update: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
      publish: { type: Boolean, default: false },
      share: { type: Boolean, default: false },
      duplicate: { type: Boolean, default: false }
    },
    
    // AI permissions
    ai: {
      generate: { type: Boolean, default: false },
      regenerate: { type: Boolean, default: false },
      dailyLimit: { type: Number, default: 0 }
    },
    
    // Export permissions
    export: {
      docx: { type: Boolean, default: false },
      pdf: { type: Boolean, default: false },
      pptx: { type: Boolean, default: false },
      google_docs: { type: Boolean, default: false }
    },
    
    // User management permissions
    users: {
      view: { type: Boolean, default: false },
      create: { type: Boolean, default: false },
      update: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
      change_role: { type: Boolean, default: false }
    },
    
    // Admin permissions
    admin: {
      dashboard: { type: Boolean, default: false },
      analytics: { type: Boolean, default: false },
      system_settings: { type: Boolean, default: false },
      manage_permissions: { type: Boolean, default: false }
    },
    
    // Organization permissions
    organization: {
      view: { type: Boolean, default: false },
      manage: { type: Boolean, default: false },
      invite_users: { type: Boolean, default: false }
    }
  },
  isCustom: {
    type: Boolean,
    default: false
  },
  description: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

export default mongoose.model('Permission', permissionSchema);