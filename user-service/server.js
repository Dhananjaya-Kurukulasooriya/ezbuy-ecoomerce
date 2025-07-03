// user-service/server.js - COMPLETELY FIXED VERSION
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// JWT Secret - use consistent secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware
app.use(express.json());
app.use(cors());

// Enhanced MongoDB connection with better settings
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ezbuy', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10, // Maintain up to 10 socket connections
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  bufferCommands: false, // Disable mongoose buffering
  bufferMaxEntries: 0 // Disable mongoose buffering
});

// Connection event handlers
mongoose.connection.on('connected', () => {
  console.log('✅ Connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected');
});

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date }
});

// Add indexes for better performance
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });

const User = mongoose.model('User', userSchema);

// Utility function to validate password hash
const isValidHash = (hash) => {
  return hash && 
         typeof hash === 'string' && 
         hash.length >= 50 && 
         (hash.startsWith('$2b$10$') || hash.startsWith('$2a$10$'));
};

// Hash integrity check middleware
const checkHashIntegrity = async (req, res, next) => {
  try {
    if (req.path === '/api/auth/login' && req.method === 'POST') {
      const { email } = req.body;
      if (email) {
        const user = await User.findOne({ email }).lean();
        if (user && !isValidHash(user.password)) {
          console.error('🚨 CORRUPTED HASH DETECTED for:', email, {
            hashLength: user.password?.length,
            hashValue: user.password?.substring(0, 10)
          });
          
          return res.status(500).json({ 
            error: 'Account authentication error. Please contact support.',
            code: 'CORRUPTED_HASH'
          });
        }
      }
    }
    next();
  } catch (error) {
    console.error('Hash integrity check error:', error);
    next();
  }
};

// Apply hash integrity check
app.use(checkHashIntegrity);

// JWT middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Admin Authentication Middleware
const adminAuth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                error: 'Access denied. No token provided.',
                code: 'NO_TOKEN'
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password').lean();
        
        if (!user) {
            return res.status(401).json({ 
                error: 'Invalid token. User not found.',
                code: 'USER_NOT_FOUND'
            });
        }

        if (user.role !== 'admin') {
            console.log(`🚨 Unauthorized admin access attempt:`, {
                userId: user._id,
                email: user.email,
                role: user.role,
                ip: req.ip,
                route: req.originalUrl,
                timestamp: new Date().toISOString()
            });
            
            return res.status(403).json({ 
                error: 'Access denied. Admin privileges required.',
                code: 'INSUFFICIENT_PRIVILEGES'
            });
        }

        req.user = user;
        next();

    } catch (error) {
        console.error('Admin auth error:', error);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                error: 'Invalid token.',
                code: 'INVALID_TOKEN'
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                error: 'Token expired.',
                code: 'TOKEN_EXPIRED'
            });
        }

        res.status(500).json({ 
            error: 'Server error during authentication.',
            code: 'SERVER_ERROR'
        });
    }
};

// ROUTES

// Register - Enhanced with better validation
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    
    // Input validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Sanitize inputs
    const sanitizedUsername = username.trim();
    const sanitizedEmail = email.trim().toLowerCase();
    
    // Check if user exists
    const existingUser = await User.findOne({ 
      $or: [{ email: sanitizedEmail }, { username: sanitizedUsername }] 
    }).lean();
    
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    console.log('🔐 Creating hash for new user:', sanitizedEmail);
    
    // Hash password with explicit salt rounds
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Validate generated hash
    if (!isValidHash(hashedPassword)) {
      console.error('❌ Generated invalid hash for:', sanitizedEmail);
      return res.status(500).json({ error: 'Password encryption failed' });
    }

    console.log('✅ Valid hash generated:', {
      email: sanitizedEmail,
      hashLength: hashedPassword.length,
      format: hashedPassword.substring(0, 10)
    });

    // Create user
    const user = new User({
      username: sanitizedUsername,
      email: sanitizedEmail,
      password: hashedPassword,
      role: role || 'user',
      createdAt: new Date()
    });

    await user.save();

    console.log('✅ User created successfully:', sanitizedEmail);

    res.status(201).json({ 
      message: 'User created successfully',
      user: { id: user._id, username: user.username, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error('❌ Register error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'User already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Login - COMPLETELY FIXED
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('🔐 Login attempt for:', email);

    // Input validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Sanitize email
    const sanitizedEmail = email.trim().toLowerCase();

    // Find user with .lean() to prevent document mutation
    const user = await User.findOne({ email: sanitizedEmail }).lean();
    if (!user) {
      console.log('❌ User not found:', sanitizedEmail);
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    console.log('✅ User found:', sanitizedEmail);

    // Critical: Validate password hash BEFORE using it
    if (!isValidHash(user.password)) {
      console.error('🚨 CORRUPTED PASSWORD HASH DETECTED:', {
        email: sanitizedEmail,
        hashLength: user.password?.length,
        hashValue: user.password?.substring(0, 20),
        userId: user._id
      });
      
      return res.status(500).json({ 
        error: 'Account authentication error. Please contact support.',
        code: 'CORRUPTED_HASH'
      });
    }

    console.log('✅ Password hash is valid:', {
      length: user.password.length,
      format: user.password.substring(0, 10)
    });

    // Compare password - NEVER modify user object
    console.log('🔍 Comparing password...');
    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log('🔍 Password comparison result:', isValidPassword);
    
    if (!isValidPassword) {
      console.log('❌ Invalid password for:', sanitizedEmail);
      
      // Update failed login attempts (in separate operation)
      try {
        await User.updateOne(
          { _id: user._id },
          { 
            $inc: { loginAttempts: 1 },
            $set: { lastLoginAttempt: new Date() }
          }
        );
      } catch (updateError) {
        console.error('Failed to update login attempts:', updateError);
      }
      
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    console.log('✅ Password valid for:', sanitizedEmail);

    // Update last login (separate operation to avoid affecting password)
    try {
      await User.updateOne(
        { _id: user._id },
        { 
          $set: { 
            lastLogin: new Date(),
            loginAttempts: 0
          },
          $unset: { lockUntil: 1 }
        }
      );
    } catch (updateError) {
      console.error('Failed to update login timestamp:', updateError);
      // Continue with login even if this fails
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('✅ Login successful for:', sanitizedEmail);
    
    // Return response - user object is already clean (from .lean())
    res.json({
      message: 'Login successful',
      token,
      user: { 
        id: user._id, 
        username: user.username, 
        email: user.email, 
        role: user.role 
      }
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin validation endpoint
app.post('/api/auth/validate-admin', adminAuth, async (req, res) => {
    try {
        res.json({
            valid: true,
            user: {
                id: req.user._id,
                username: req.user.username,
                email: req.user.email,
                role: req.user.role
            }
        });
    } catch (error) {
        console.error('Admin validation error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Token validation endpoint for other services
app.get('/api/auth/validate-token', async (req, res) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ valid: false });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password').lean();
        
        if (!user) {
            return res.status(401).json({ valid: false });
        }

        res.json({
            valid: true,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                isAdmin: user.role === 'admin'
            }
        });
    } catch (error) {
        console.error('Token validation error:', error);
        res.status(401).json({ valid: false });
    }
});

// Get user profile
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password').lean();
    res.json(user);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Legacy token validation (for backward compatibility)
app.get('/api/auth/validate', authenticateToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// Emergency hash repair endpoint (for debugging)
app.post('/api/auth/emergency-repair', async (req, res) => {
  try {
    const { email, password, emergencyKey } = req.body;
    
    // Simple emergency key check
    if (emergencyKey !== 'emergency-repair-2024') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    console.log('🔧 Emergency hash repair for:', email);
    
    // Generate new hash
    const newHash = await bcrypt.hash(password, 10);
    
    // Update user
    const result = await User.updateOne(
      { email: email.trim().toLowerCase() },
      { $set: { password: newHash } }
    );
    
    console.log('✅ Emergency repair completed:', result.modifiedCount, 'users updated');
    
    res.json({ 
      message: 'Hash repaired successfully',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Emergency repair error:', error);
    res.status(500).json({ error: 'Repair failed' });
  }
});

// Health check with hash validation
app.get('/health', async (req, res) => {
  try {
    // Check for corrupted hashes
    const corruptedCount = await User.countDocuments({
      $or: [
        { password: { $exists: false } },
        { password: null },
        { password: { $regex: /^.{0,49}$/ } }, // Too short
        { password: { $not: { $regex: /^\$2[ab]\$10\$/ } } } // Wrong format
      ]
    });
    
    res.json({ 
      status: 'OK', 
      service: 'user-service',
      corruptedHashes: corruptedCount,
      jwtSecret: JWT_SECRET ? 'Set' : 'Not Set',
      mongoConnection: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ status: 'ERROR', error: error.message });
  }
});

// Memory monitoring
setInterval(() => {
  const memUsage = process.memoryUsage();
  console.log('📊 Memory usage:', {
    rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB'
  });
}, 5 * 60 * 1000); // Every 5 minutes

app.listen(PORT, () => {
  console.log(`User Service running on port ${PORT}`);
  console.log(`Using JWT Secret: ${JWT_SECRET ? 'Set' : 'Not Set'}`);
  console.log('🛡️ Enhanced security measures enabled');
});