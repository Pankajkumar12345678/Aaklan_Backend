import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import UserRole from '../models/UserRole.js';
import Permission from '../models/Permission.js';
import UserActivity from '../models/UserActivity.js';

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role = 'teacher', organization } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Name, email, and password are required' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: 'User with this email already exists' 
      });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false,
        message: 'Password must be at least 6 characters long' 
      });
    }

    // Create new user
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash: password,
      role: role,
      organization: organization || ''
    });

    await user.save();

    // Assign default permissions based on role
    const defaultPermissions = await Permission.findOne({ role });
    const userRole = new UserRole({
      user: user._id,
      role: role,
      permissions: defaultPermissions?._id
    });

    await userRole.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id, 
        role: userRole.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Set HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Log registration activity
    await UserActivity.create({
      user: user._id,
      action: 'user_created',
      resourceType: 'user',
      details: { 
        selfRegistration: true, 
        role: role,
        organization: organization 
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Get user with permissions for response
    const userWithPermissions = await User.findById(user._id)
      .select('-passwordHash')
      .populate({
        path: 'roles',
        match: { isActive: true },
        populate: { path: 'permissions' }
      });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: userWithPermissions._id,
        name: userWithPermissions.name,
        email: userWithPermissions.email,
        role: userRole.role,
        organization: userWithPermissions.organization,
        permissions: userWithPermissions.roles[0]?.permissions?.permissions
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed',
        errors 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Registration failed', 
      error: error.message 
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Email and password are required' 
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ 
        success: false,
        message: 'Your account has been deactivated. Please contact administrator.' 
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }

    // Get user's active role and permissions
    const userRole = await UserRole.findOne({ 
      user: user._id, 
      isActive: true 
    }).populate('permissions');

    if (!userRole) {
      return res.status(403).json({ 
        success: false,
        message: 'No active role assigned to user' 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id, 
        role: userRole.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Set HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Log login activity
    await UserActivity.create({
      user: user._id,
      action: 'login',
      resourceType: 'system',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Get user with permissions for response
    const userWithPermissions = await User.findById(user._id)
      .select('-passwordHash')
      .populate({
        path: 'roles',
        match: { isActive: true },
        populate: { path: 'permissions' }
      });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: userWithPermissions._id,
        name: userWithPermissions.name,
        email: userWithPermissions.email,
        role: userRole.role,
        organization: userWithPermissions.organization,
        profile: userWithPermissions.profile,
        permissions: userWithPermissions.roles[0]?.permissions?.permissions,
        lastLogin: user.lastLogin
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Login failed', 
      error: error.message 
    });
  }
});

// Logout user
router.post('/logout', async (req, res) => {
  try {
    const token = req.cookies?.token || req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Log logout activity
        await UserActivity.create({
          user: decoded.userId,
          action: 'logout',
          resourceType: 'system',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      } catch (error) {
        // Token might be expired, still clear cookie
        console.log('Token verification failed during logout:', error.message);
      }
    }

    // Clear the cookie
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Logout failed', 
      error: error.message 
    });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const token = req.cookies?.token || req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'Not authenticated' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user with permissions
    const user = await User.findById(decoded.userId)
      .select('-passwordHash')
      .populate({
        path: 'roles',
        match: { isActive: true },
        populate: { path: 'permissions' }
      });

    if (!user || !user.isActive) {
      return res.status(401).json({ 
        success: false,
        message: 'User not found or inactive' 
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.roles[0]?.role,
        organization: user.organization,
        profile: user.profile,
        permissions: user.roles[0]?.permissions?.permissions,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Get user error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid token' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        message: 'Token expired' 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to get user', 
      error: error.message 
    });
  }
});

// Update user profile
router.put('/profile', async (req, res) => {
  try {
    const token = req.cookies?.token || req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'Not authenticated' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { name, organization, profile } = req.body;

    const updateData = {};
    if (name) updateData.name = name.trim();
    if (organization !== undefined) updateData.organization = organization;
    if (profile) updateData.profile = { ...profile };

    const user = await User.findByIdAndUpdate(
      decoded.userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Log profile update
    await UserActivity.create({
      user: user._id,
      action: 'user_updated',
      resourceType: 'user',
      details: {
        updatedFields: Object.keys(updateData)
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        organization: user.organization,
        profile: user.profile
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid token' 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to update profile', 
      error: error.message 
    });
  }
});

// Change password
router.put('/change-password', async (req, res) => {
  try {
    const token = req.cookies?.token || req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'Not authenticated' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false,
        message: 'Current password and new password are required' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false,
        message: 'New password must be at least 6 characters long' 
      });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ 
        success: false,
        message: 'Current password is incorrect' 
      });
    }

    // Update password
    user.passwordHash = newPassword;
    await user.save();

    // Log password change
    await UserActivity.create({
      user: user._id,
      action: 'user_updated',
      resourceType: 'user',
      details: {
        action: 'password_change'
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid token' 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to change password', 
      error: error.message 
    });
  }
});

// Validate token
router.post('/validate', async (req, res) => {
  try {
    const token = req.cookies?.token || req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.json({ 
        success: false,
        valid: false,
        message: 'No token provided' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId)
      .select('-passwordHash')
      .where('isActive').equals(true);

    if (!user) {
      return res.json({ 
        success: false,
        valid: false,
        message: 'User not found or inactive' 
      });
    }

    res.json({
      success: true,
      valid: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: decoded.role
      }
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.json({ 
        success: false,
        valid: false,
        message: 'Invalid or expired token' 
      });
    }
    
    res.status(500).json({ 
      success: false,
      valid: false,
      message: 'Token validation failed' 
    });
  }
});

export default router;