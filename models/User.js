import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['teacher', 'student', 'admin'],
    default: 'teacher'
  },
  organization: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date,
  profile: {
    avatar: String,
    bio: String,
    subjects: [String],
    grades: [String]
  }
}, {
  timestamps: true
});

userSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.passwordHash);
};

userSchema.pre('save', async function(next) {
  if (!this.isModified('passwordHash')) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  next();
});

// Virtual for user activities
userSchema.virtual('activities', {
  ref: 'UserActivity',
  localField: '_id',
  foreignField: 'user'
});

// Virtual for user roles
userSchema.virtual('roles', {
  ref: 'UserRole',
  localField: '_id',
  foreignField: 'user'
});

export default mongoose.model('User', userSchema);

