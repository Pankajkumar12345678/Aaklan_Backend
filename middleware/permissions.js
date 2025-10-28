import Permission from '../models/Permission.js';
import UserRole from '../models/UserRole.js';
import UserActivity from '../models/UserActivity.js';

// Permission check middleware
export const checkPermission = (resource, action, options = {}) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Get user's role and permissions
      const userRole = await UserRole.findOne({ 
        user: user._id, 
        isActive: true 
      }).populate('permissions');

      if (!userRole) {
        return res.status(403).json({ message: 'No active role assigned' });
      }

      const permissions = userRole.permissions?.permissions;
      
      if (!permissions) {
        return res.status(403).json({ message: 'No permissions configured' });
      }

      // Check permission based on resource and action
      let hasPermission = false;
      
      switch (resource) {
        case 'templates':
          hasPermission = permissions.templates?.[action] || false;
          if (hasPermission && options.templateType) {
            hasPermission = permissions.templates.access.includes(options.templateType);
          }
          break;
          
        case 'content':
          hasPermission = permissions.content?.[action] || false;
          break;
          
        case 'ai':
          hasPermission = permissions.ai?.[action] || false;
          break;
          
        case 'export':
          hasPermission = permissions.export?.[action] || false;
          break;
          
        case 'users':
          hasPermission = permissions.users?.[action] || false;
          break;
          
        case 'admin':
          hasPermission = permissions.admin?.[action] || false;
          break;
          
        case 'organization':
          hasPermission = permissions.organization?.[action] || false;
          break;
          
        default:
          hasPermission = false;
      }

      // Check custom permissions
      if (userRole.customPermissions) {
        // Check feature restrictions
        if (userRole.customPermissions.features?.disabled.includes(resource)) {
          hasPermission = false;
        }
        
        // Check template restrictions
        if (resource === 'templates' && options.templateType) {
          if (userRole.customPermissions.templates?.restrictions.includes(options.templateType)) {
            hasPermission = false;
          }
        }
      }

      if (!hasPermission) {
        // Log unauthorized access attempt
        await UserActivity.create({
          user: user._id,
          action: 'unauthorized_access',
          resourceType: resource,
          details: {
            action: action,
            attemptedResource: options.templateType || resource,
            message: 'Permission denied'
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
        
        return res.status(403).json({ 
          message: `Access denied. You don't have permission to ${action} ${resource}.` 
        });
      }

      // Add permissions to request for later use
      req.userPermissions = permissions;
      req.userRole = userRole;

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ message: 'Permission verification failed' });
    }
  };
};

// Role-based access control
export const requireRole = (...roles) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const userRole = await UserRole.findOne({ 
        user: user._id, 
        isActive: true 
      });

      if (!userRole || !roles.includes(userRole.role)) {
        return res.status(403).json({ 
          message: `Access denied. Required roles: ${roles.join(', ')}` 
        });
      }

      next();
    } catch (error) {
      res.status(500).json({ message: 'Role verification failed' });
    }
  };
};

// Usage tracking middleware
export const trackUsage = (action, resourceType) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log successful actions (status code 2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        UserActivity.create({
          user: req.user?._id,
          action: action,
          resourceType: resourceType,
          resourceId: req.params.id || req.body.id,
          details: {
            method: req.method,
            endpoint: req.originalUrl,
            statusCode: res.statusCode,
            userAgent: req.get('User-Agent')
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }).catch(console.error);
      }
      
      originalSend.call(this, data);
    };
    
    next();
  };
};

// Check AI usage limits
export const checkAILimits = async (req, res, next) => {
  try {
    if (!req.user) return next();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayUsage = await UserActivity.countDocuments({
      user: req.user._id,
      action: { $in: ['generate_ai', 'regenerate_ai'] },
      createdAt: { $gte: today }
    });

    const userLimit = req.userPermissions?.ai?.dailyLimit || 10;
    
    if (todayUsage >= userLimit) {
      return res.status(429).json({ 
        message: `Daily AI generation limit reached (${userLimit}). Please try again tomorrow.`,
        usage: {
          today: todayUsage,
          limit: userLimit,
          remaining: 0
        }
      });
    }

    req.aiUsage = {
      today: todayUsage,
      limit: userLimit,
      remaining: userLimit - todayUsage
    };

    next();
  } catch (error) {
    console.error('AI limit check error:', error);
    next();
  }
};