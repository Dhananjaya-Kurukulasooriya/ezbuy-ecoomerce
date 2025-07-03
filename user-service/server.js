// user-service/server.js - CORRECTED VERSION
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); // REMOVED DUPLICATE
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// JWT Secret - use consistent secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware
app.use(express.json());
app.use(cors());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ezbuy', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

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

// Admin Authentication Middleware - CORRECTED
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
        const user = await User.findById(decoded.userId).select('-password');
        
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

// Routes
// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      username,
      email,
      password: hashedPassword,
      role: role || 'user'
    });

    await user.save();

    res.status(201).json({ 
      message: 'User created successfully',
      user: { id: user._id, username: user.username, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Generate JWT - CONSISTENT TOKEN STRUCTURE
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user._id, username: user.username, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin validation endpoint - CORRECTED
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

// Token validation endpoint for other services - CORRECTED
app.get('/api/auth/validate-token', async (req, res) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ valid: false });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');
        
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
    const user = await User.findById(req.user.userId).select('-password');
    res.json(user);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Validate token (for other services) - EXISTING ROUTE
app.get('/api/auth/validate', authenticateToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'user-service' });
});

app.listen(PORT, () => {
  console.log(`User Service running on port ${PORT}`);
  console.log(`Using JWT Secret: ${JWT_SECRET ? 'Set' : 'Not Set'}`);
});