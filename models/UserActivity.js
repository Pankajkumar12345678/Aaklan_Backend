import mongoose from 'mongoose';

const userActivitySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'login', 'logout', 'create_content', 'update_content', 'delete_content',
      'generate_ai', 'regenerate_ai', 'export_content', 'share_content', 
      'view_content', 'user_created', 'user_updated', 'user_deleted', 
      'permission_changed', 'publish_content', 'duplicate_content',
      'unauthorized_access', 'view_dashboard', 'view_analytics'
    ]
  },
  resourceType: {
    type: String,
    enum: ['lesson', 'quiz', 'project', 'unit_plan', 'user', 'permission', 'system', 'template']
  },
  resourceId: mongoose.Schema.Types.ObjectId,
  details: mongoose.Schema.Types.Mixed,
  ipAddress: String,
  userAgent: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for analytics
userActivitySchema.index({ user: 1, timestamp: -1 });
userActivitySchema.index({ action: 1, timestamp: -1 });
userActivitySchema.index({ resourceType: 1, timestamp: -1 });

export default mongoose.model('UserActivity', userActivitySchema);