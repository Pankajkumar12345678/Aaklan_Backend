import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import UserRole from '../models/UserRole.js';
import Permission from '../models/Permission.js';
import UserActivity from '../models/UserActivity.js';
import Lesson from '../models/Lesson.js';
import Template from '../models/Template.js';
import { authenticate } from '../middleware/auth.js';
import { checkPermission, requireRole, trackUsage } from '../middleware/permissions.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(requireRole('admin'));

// 📊 Admin Dashboard Statistics
router.get('/dashboard', 
  checkPermission('admin', 'dashboard'),
  trackUsage('view_dashboard', 'system'),
  async (req, res) => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [
        totalUsers,
        totalTeachers,
        totalStudents,
        totalAdmins,
        totalContent,
        activeUsers,
        recentActivities,
        userGrowth,
        contentGrowth,
        systemUsage
      ] = await Promise.all([
        // User counts
        User.countDocuments(),
        UserRole.countDocuments({ role: 'teacher', isActive: true }),
        UserRole.countDocuments({ role: 'student', isActive: true }),
        UserRole.countDocuments({ role: 'admin', isActive: true }),
        
        // Content counts
        Lesson.countDocuments(),
        
        // Active users (last 7 days)
        UserActivity.distinct('user', { 
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } 
        }),
        
        // Recent activities
        UserActivity.find()
          .sort({ createdAt: -1 })
          .limit(15)
          .populate('user', 'name email role'),
        
        // User growth (last 30 days)
        User.aggregate([
          { $match: { createdAt: { $gte: thirtyDaysAgo } } },
          {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
                day: { $dayOfMonth: '$createdAt' }
              },
              count: { $sum: 1 }
            }
          },
          { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
          { $limit: 30 }
        ]),
        
        // Content growth
        Lesson.aggregate([
          { $match: { createdAt: { $gte: thirtyDaysAgo } } },
          {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
                day: { $dayOfMonth: '$createdAt' }
              },
              count: { $sum: 1 },
              byType: { $push: '$template' }
            }
          },
          { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]),
        
        // System usage stats
        UserActivity.aggregate([
          { $match: { createdAt: { $gte: thirtyDaysAgo } } },
          {
            $group: {
              _id: '$action',
              count: { $sum: 1 }
            }
          },
          { $sort: { count: -1 } }
        ])
      ]);

      res.json({
        success: true,
        statistics: {
          users: {
            total: totalUsers,
            teachers: totalTeachers,
            students: totalStudents,
            admins: totalAdmins,
            active: activeUsers.length
          },
          content: {
            total: totalContent,
            byType: await getContentByType()
          },
          growth: {
            users: userGrowth,
            content: contentGrowth
          }
        },
        systemUsage,
        recentActivities,
        systemHealth: await getSystemHealth()
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        message: 'Failed to fetch dashboard data', 
        error: error.message 
      });
    }
  }
);

// 👥 User Management

// Get all users with advanced filtering
router.get('/users', 
  checkPermission('users', 'view'),
  trackUsage('view_users', 'user'),
  async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 10, 
        search, 
        role, 
        status,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;
      
      const filter = {};
      
      // Search filter
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { organization: { $regex: search, $options: 'i' } }
        ];
      }
      
      // Role filter
      if (role && role !== 'all') {
        const userRoles = await UserRole.find({ role, isActive: true }).select('user');
        filter._id = { $in: userRoles.map(ur => ur.user) };
      }
      
      // Status filter
      if (status === 'active') filter.isActive = true;
      if (status === 'inactive') filter.isActive = false;

      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const users = await User.find(filter)
        .select('-passwordHash')
        .populate({
          path: 'roles',
          match: { isActive: true },
          populate: { path: 'permissions' }
        })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort(sortOptions);

      const total = await User.countDocuments(filter);

      // Get user statistics
      const userStats = await UserRole.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 }
          }
        }
      ]);

      res.json({
        success: true,
        users,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        total,
        stats: userStats
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        message: 'Failed to fetch users', 
        error: error.message 
      });
    }
  }
);

// Get specific user with detailed information
router.get('/users/:id', 
  checkPermission('users', 'view'),
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id)
        .select('-passwordHash')
        .populate({
          path: 'roles',
          populate: { path: 'permissions' }
        });

      if (!user) {
        return res.status(404).json({ 
          success: false,
          message: 'User not found' 
        });
      }

      // Get user's activity log
      const activities = await UserActivity.find({ user: req.params.id })
        .sort({ createdAt: -1 })
        .limit(50);

      // Get user's content statistics
      const contentStats = await Lesson.aggregate([
        { $match: { createdBy: user._id } },
        {
          $group: {
            _id: '$template',
            count: { $sum: 1 },
            lastCreated: { $max: '$createdAt' },
            published: {
              $sum: { $cond: ['$published', 1, 0] }
            }
          }
        }
      ]);

      // Get AI usage statistics
      const aiUsage = await UserActivity.aggregate([
        { 
          $match: { 
            user: user._id,
            action: { $in: ['generate_ai', 'regenerate_ai'] }
          } 
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': -1, '_id.month': -1, '_id.day': -1 } },
        { $limit: 30 }
      ]);

      res.json({
        success: true,
        user,
        activities,
        statistics: {
          content: {
            total: contentStats.reduce((sum, stat) => sum + stat.count, 0),
            byType: contentStats,
            published: contentStats.reduce((sum, stat) => sum + stat.published, 0)
          },
          aiUsage: {
            total: aiUsage.reduce((sum, day) => sum + day.count, 0),
            daily: aiUsage
          },
          lastActive: activities[0]?.createdAt
        }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        message: 'Failed to fetch user details', 
        error: error.message 
      });
    }
  }
);

// Create new user (admin only)
router.post('/users', 
  checkPermission('users', 'create'),
  trackUsage('user_created', 'user'),
  async (req, res) => {
    try {
      const { name, email, password, role, organization, customPermissions } = req.body;

      // Validate required fields
      if (!name || !email || !password || !role) {
        return res.status(400).json({ 
          success: false,
          message: 'Name, email, password, and role are required' 
        });
      }

      // Check if user exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ 
          success: false,
          message: 'User with this email already exists' 
        });
      }

      // Create user
      const user = new User({
        name,
        email,
        passwordHash: password,
        organization: organization || '',
        profile: req.body.profile || {}
      });

      await user.save();

      // Assign role and permissions
      const defaultPermissions = await Permission.findOne({ role });
      if (!defaultPermissions) {
        await User.findByIdAndDelete(user._id);
        return res.status(400).json({ 
          success: false,
          message: `No permission template found for role: ${role}` 
        });
      }

      const userRole = new UserRole({
        user: user._id,
        role,
        permissions: defaultPermissions._id,
        assignedBy: req.user._id,
        customPermissions: customPermissions || {}
      });

      await userRole.save();

      // Log the activity
      await UserActivity.create({
        user: req.user._id,
        action: 'user_created',
        resourceType: 'user',
        resourceId: user._id,
        details: {
          createdUser: user.email,
          role: role,
          organization: organization,
          customPermissions: customPermissions
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: role,
          organization: user.organization,
          createdAt: user.createdAt
        }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        message: 'Failed to create user', 
        error: error.message 
      });
    }
  }
);

// Update user profile and information
router.put('/users/:id', 
  checkPermission('users', 'update'),
  trackUsage('user_updated', 'user'),
  async (req, res) => {
    try {
      const { name, email, organization, profile, isActive } = req.body;
      
      const updateData = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (organization !== undefined) updateData.organization = organization;
      if (profile) updateData.profile = profile;
      if (isActive !== undefined) updateData.isActive = isActive;

      const user = await User.findByIdAndUpdate(
        req.params.id,
        { $set: updateData },
        { new: true, runValidators: true }
      ).select('-passwordHash');

      if (!user) {
        return res.status(404).json({ 
          success: false,
          message: 'User not found' 
        });
      }

      res.json({
        success: true,
        message: 'User updated successfully',
        user
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        message: 'Failed to update user', 
        error: error.message 
      });
    }
  }
);

// Update user role and permissions
router.put('/users/:id/role', 
  checkPermission('users', 'change_role'),
  trackUsage('user_updated', 'user'),
  async (req, res) => {
    try {
      const { role, customPermissions, isActive } = req.body;
      
      // Check if target user exists
      const targetUser = await User.findById(req.params.id);
      if (!targetUser) {
        return res.status(404).json({ 
          success: false,
          message: 'User not found' 
        });
      }

      // Prevent self-role-change
      if (targetUser._id.toString() === req.user._id.toString()) {
        return res.status(400).json({ 
          success: false,
          message: 'Cannot change your own role' 
        });
      }

      // Deactivate current roles
      await UserRole.updateMany(
        { user: req.params.id, isActive: true },
        { isActive: false }
      );

      // Get new role permissions
      const defaultPermissions = await Permission.findOne({ role });
      if (!defaultPermissions) {
        return res.status(400).json({ 
          success: false,
          message: `No permission template found for role: ${role}` 
        });
      }

      // Create new role assignment
      const userRole = new UserRole({
        user: req.params.id,
        role,
        permissions: defaultPermissions._id,
        assignedBy: req.user._id,
        customPermissions: customPermissions || {},
        isActive: isActive !== false
      });

      await userRole.save();

      // Log the activity
      await UserActivity.create({
        user: req.user._id,
        action: 'permission_changed',
        resourceType: 'user',
        resourceId: req.params.id,
        details: {
          targetUser: targetUser.email,
          newRole: role,
          customPermissions: customPermissions,
          isActive: isActive
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        message: 'User role updated successfully',
        role: userRole
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        message: 'Failed to update user role', 
        error: error.message 
      });
    }
  }
);

// Delete user (soft delete)
router.delete('/users/:id', 
  checkPermission('users', 'delete'),
  trackUsage('user_deleted', 'user'),
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id);
      
      if (!user) {
        return res.status(404).json({ 
          success: false,
          message: 'User not found' 
        });
      }

      // Prevent self-deletion
      if (user._id.toString() === req.user._id.toString()) {
        return res.status(400).json({ 
          success: false,
          message: 'Cannot delete your own account' 
        });
      }

      // Soft delete: deactivate user and roles
      await User.findByIdAndUpdate(req.params.id, {
        isActive: false,
        email: `deleted_${user._id}@example.com` // Anonymize email
      });

      await UserRole.updateMany(
        { user: req.params.id },
        { isActive: false }
      );

      // Log the deletion
      await UserActivity.create({
        user: req.user._id,
        action: 'user_deleted',
        resourceType: 'user',
        resourceId: req.params.id,
        details: {
          deletedUser: user.email,
          method: 'soft_delete'
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({ 
        success: true,
        message: 'User deleted successfully' 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        message: 'Failed to delete user', 
        error: error.message 
      });
    }
  }
);

// 🔐 Permission Management

// Get all permission templates
router.get('/permissions', 
  checkPermission('admin', 'manage_permissions'),
  async (req, res) => {
    try {
      const permissions = await Permission.find().sort({ role: 1 });
      res.json({
        success: true,
        permissions
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        message: 'Failed to fetch permissions', 
        error: error.message 
      });
    }
  }
);

// Get specific permission template
router.get('/permissions/:id', 
  checkPermission('admin', 'manage_permissions'),
  async (req, res) => {
    try {
      const permission = await Permission.findById(req.params.id);
      
      if (!permission) {
        return res.status(404).json({ 
          success: false,
          message: 'Permission template not found' 
        });
      }

      res.json({
        success: true,
        permission
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        message: 'Failed to fetch permission', 
        error: error.message 
      });
    }
  }
);

// Update permission template for a role
router.put('/permissions/:role', 
  checkPermission('admin', 'manage_permissions'),
  trackUsage('permission_changed', 'permission'),
  async (req, res) => {
    try {
      const { role } = req.params;
      const { permissions, description } = req.body;

      const updatedPermission = await Permission.findOneAndUpdate(
        { role },
        { 
          permissions,
          description,
          isCustom: true 
        },
        { new: true, upsert: true, runValidators: true }
      );

      res.json({
        success: true,
        message: 'Permissions updated successfully',
        permission: updatedPermission
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        message: 'Failed to update permissions', 
        error: error.message 
      });
    }
  }
);

// Create custom permission set
router.post('/permissions/custom', 
  checkPermission('admin', 'manage_permissions'),
  async (req, res) => {
    try {
      const { name, permissions, description, basedOn } = req.body;

      if (!name || !permissions) {
        return res.status(400).json({ 
          success: false,
          message: 'Name and permissions are required' 
        });
      }

      const customPermission = new Permission({
        role: `custom_${name.toLowerCase().replace(/\s+/g, '_')}`,
        permissions,
        description,
        isCustom: true,
        basedOn,
        createdBy: req.user._id
      });

      await customPermission.save();

      res.status(201).json({
        success: true,
        message: 'Custom permission set created',
        permission: customPermission
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        message: 'Failed to create custom permissions', 
        error: error.message 
      });
    }
  }
);

// Delete custom permission
router.delete('/permissions/:id', 
  checkPermission('admin', 'manage_permissions'),
  async (req, res) => {
    try {
      const permission = await Permission.findById(req.params.id);
      
      if (!permission) {
        return res.status(404).json({ 
          success: false,
          message: 'Permission not found' 
        });
      }

      if (!permission.isCustom) {
        return res.status(400).json({ 
          success: false,
          message: 'Cannot delete default permission templates' 
        });
      }

      // Check if any users are using this permission
      const usersWithPermission = await UserRole.countDocuments({
        permissions: req.params.id
      });

      if (usersWithPermission > 0) {
        return res.status(400).json({ 
          success: false,
          message: `Cannot delete permission template. ${usersWithPermission} users are using it.` 
        });
      }

      await Permission.findByIdAndDelete(req.params.id);

      res.json({
        success: true,
        message: 'Permission template deleted successfully'
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        message: 'Failed to delete permission', 
        error: error.message 
      });
    }
  }
);

// 📈 Analytics and Reports

// Get system analytics with advanced filters
router.get('/analytics', 
  checkPermission('admin', 'analytics'),
  async (req, res) => {
    try {
      const { period = '30d', type = 'all' } = req.query;
      
      const dateFilter = getDateFilter(period);

      const analyticsData = await Promise.all([
        // User analytics
        getUserAnalytics(dateFilter),
        // Content analytics
        getContentAnalytics(dateFilter, type),
        // AI usage analytics
        getAIAnalytics(dateFilter),
        // System performance
        getSystemPerformance(dateFilter)
      ]);

      res.json({
        success: true,
        period,
        analytics: {
          users: analyticsData[0],
          content: analyticsData[1],
          ai: analyticsData[2],
          system: analyticsData[3]
        }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        message: 'Failed to fetch analytics', 
        error: error.message 
      });
    }
  }
);

// Get activity logs with advanced filtering
router.get('/activities', 
  checkPermission('admin', 'analytics'),
  async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 50, 
        action, 
        userId, 
        resourceType,
        startDate,
        endDate,
        search 
      } = req.query;
      
      const filter = {};
      
      if (action) filter.action = action;
      if (userId) filter.user = userId;
      if (resourceType) filter.resourceType = resourceType;
      
      // Date range filter
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }
      
      // Search in details
      if (search) {
        filter.$or = [
          { 'details.method': { $regex: search, $options: 'i' } },
          { 'details.endpoint': { $regex: search, $options: 'i' } }
        ];
      }

      const activities = await UserActivity.find(filter)
        .populate('user', 'name email role')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await UserActivity.countDocuments(filter);

      // Get activity statistics
      const activityStats = await UserActivity.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 },
            lastActivity: { $max: '$createdAt' }
          }
        },
        { $sort: { count: -1 } }
      ]);

      res.json({
        success: true,
        activities,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        total,
        stats: activityStats
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        message: 'Failed to fetch activities', 
        error: error.message 
      });
    }
  }
);

// System settings and configuration
router.get('/settings', 
  checkPermission('admin', 'system_settings'),
  async (req, res) => {
    try {
      const settings = {
        system: {
          name: 'EduAmplify',
          version: '1.0.0',
          environment: process.env.NODE_ENV,
          maxFileSize: '10MB',
          supportedFormats: ['docx', 'pdf', 'pptx']
        },
        ai: {
          provider: 'OpenAI',
          model: 'gpt-4o',
          maxTokens: 2000,
          temperature: 0.7
        },
        security: {
          jwtExpiresIn: process.env.JWT_EXPIRES_IN,
          rateLimiting: true,
          corsEnabled: true
        },
        features: {
          templates: await Template.countDocuments(),
          curriculum: await getCurriculumStats(),
          export: true,
          sharing: true,
          analytics: true
        }
      };

      res.json({
        success: true,
        settings
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        message: 'Failed to fetch system settings', 
        error: error.message 
      });
    }
  }
);

// 🔧 Helper Functions

async function getContentByType() {
  return await Lesson.aggregate([
    {
      $group: {
        _id: '$template',
        count: { $sum: 1 },
        published: { $sum: { $cond: ['$published', 1, 0] } }
      }
    },
    { $sort: { count: -1 } }
  ]);
}

async function getSystemHealth() {
  const dbStatus = mongoose.connection.readyState === 1 ? 'healthy' : 'unhealthy';
  const memoryUsage = process.memoryUsage();
  
  return {
    database: dbStatus,
    memory: {
      used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB'
    },
    uptime: Math.round(process.uptime()) + 's',
    lastChecked: new Date()
  };
}

async function getUserAnalytics(dateFilter) {
  const [registrations, activeUsers, roleDistribution] = await Promise.all([
    User.aggregate([
      { $match: { createdAt: dateFilter } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]),
    
    UserActivity.aggregate([
      { $match: { createdAt: dateFilter } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
          },
          uniqueUsers: { $addToSet: '$user' }
        }
      },
      {
        $project: {
          date: '$_id.date',
          activeUsers: { $size: '$uniqueUsers' }
        }
      },
      { $sort: { date: 1 } }
    ]),
    
    UserRole.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ])
  ]);

  return { registrations, activeUsers, roleDistribution };
}

async function getContentAnalytics(dateFilter, type) {
  const matchStage = { createdAt: dateFilter };
  if (type !== 'all') matchStage.template = type;

  const [creationTrend, popularTemplates, userContributions] = await Promise.all([
    Lesson.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            type: '$template'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]),
    
    Lesson.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$template',
          count: { $sum: 1 },
          uniqueAuthors: { $addToSet: '$createdBy' }
        }
      },
      {
        $project: {
          template: '$_id',
          count: 1,
          authorCount: { $size: '$uniqueAuthors' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]),
    
    Lesson.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$createdBy',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          userName: '$user.name',
          userEmail: '$user.email',
          contentCount: '$count'
        }
      }
    ])
  ]);

  return { creationTrend, popularTemplates, userContributions };
}

async function getAIAnalytics(dateFilter) {
  const [usageTrend, topUsers, costEstimate] = await Promise.all([
    UserActivity.aggregate([
      { 
        $match: { 
          action: { $in: ['generate_ai', 'regenerate_ai'] },
          createdAt: dateFilter
        } 
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]),
    
    UserActivity.aggregate([
      { 
        $match: { 
          action: { $in: ['generate_ai', 'regenerate_ai'] },
          createdAt: dateFilter
        } 
      },
      {
        $group: {
          _id: '$user',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          userName: '$user.name',
          userEmail: '$user.email',
          aiRequests: '$count'
        }
      }
    ]),
    
    UserActivity.aggregate([
      { 
        $match: { 
          action: { $in: ['generate_ai', 'regenerate_ai'] },
          createdAt: dateFilter
        } 
      },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 }
        }
      }
    ])
  ]);

  // Estimate cost (assuming $0.01 per request for demo)
  const totalRequests = costEstimate[0]?.totalRequests || 0;
  const estimatedCost = totalRequests * 0.01;

  return { usageTrend, topUsers, estimatedCost: `$${estimatedCost.toFixed(2)}` };
}

async function getSystemPerformance(dateFilter) {
  const [responseTimes, errorRates, peakUsage] = await Promise.all([
    UserActivity.aggregate([
      { $match: { createdAt: dateFilter } },
      {
        $group: {
          _id: {
            hour: { $hour: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.hour': 1 } }
    ]),
    
    UserActivity.aggregate([
      { 
        $match: { 
          createdAt: dateFilter,
          'details.statusCode': { $gte: 400 }
        } 
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
          },
          errors: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]),
    
    UserActivity.aggregate([
      { $match: { createdAt: dateFilter } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            hour: { $hour: '$createdAt' }
          },
          requests: { $sum: 1 }
        }
      },
      { $sort: { requests: -1 } },
      { $limit: 5 }
    ])
  ]);

  return { responseTimes, errorRates, peakUsage };
}

async function getCurriculumStats() {
  const curriculumCount = await mongoose.connection.db.collection('curriculummaps').countDocuments();
  const subjectCount = await mongoose.connection.db.collection('curriculummaps').distinct('subjects.subjectName');
  
  return {
    curriculumFrameworks: curriculumCount,
    subjects: subjectCount.length,
    lastUpdated: new Date()
  };
}

function getDateFilter(period) {
  const now = new Date();
  let startDate = new Date();

  switch (period) {
    case '7d':
      startDate.setDate(now.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(now.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(now.getDate() - 90);
      break;
    case '1y':
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    default:
      startDate.setDate(now.getDate() - 30);
  }

  return { $gte: startDate };
}

export default router;