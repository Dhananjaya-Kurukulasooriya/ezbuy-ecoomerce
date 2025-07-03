// order-service/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');


const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(express.json());
app.use(cors());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ezbuy', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Order Schema
const orderSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  items: [{
    productId: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    image: { type: String }
  }],
  totalAmount: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  shippingAddress: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true }
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'debit_card', 'paypal', 'cash_on_delivery'],
    required: true
  },
  orderDate: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', orderSchema);

// Middleware to validate user token
const validateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:3001';
    const response = await axios.get(`${userServiceUrl}/api/auth/validate`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    req.user = response.data.user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const adminAuth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                error: 'Access denied. No token provided.',
                code: 'NO_TOKEN'
            });
        }

        // Validate token with user service
        const userServiceUrl = process.env.USER_SERVICE_URL || 'http://user-service:3001';
        
        try {
            const response = await axios.get(`${userServiceUrl}/api/auth/validate-token`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                timeout: 5000
            });

            if (!response.data.valid || !response.data.user.isAdmin) {
                console.log(`🚨 Unauthorized order admin access:`, {
                    valid: response.data.valid,
                    isAdmin: response.data.user?.isAdmin,
                    ip: req.ip,
                    route: req.originalUrl,
                    timestamp: new Date().toISOString()
                });
                
                return res.status(403).json({ 
                    error: 'Access denied. Admin privileges required.',
                    code: 'INSUFFICIENT_PRIVILEGES'
                });
            }

            req.user = response.data.user;
            next();

        } catch (userServiceError) {
            console.error('User service validation failed:', userServiceError.message);
            return res.status(401).json({ 
                error: 'Token validation failed.',
                code: 'VALIDATION_FAILED'
            });
        }

    } catch (error) {
        console.error('Order admin auth error:', error);
        res.status(500).json({ 
            error: 'Server error during authentication.',
            code: 'SERVER_ERROR'
        });
    }
};

// ADD THESE NEW ADMIN ROUTES

// Get all orders for admin dashboard
app.get('/api/admin/orders', adminAuth, async (req, res) => {
    try {
        const orders = await Order.find()
            .sort({ orderDate: -1 })
            .limit(100); // Limit for performance

        // If you need user details, you might need to call user-service
        // for each order's userId, or include user info when creating orders

        res.json({ orders });
    } catch (error) {
        console.error('Get admin orders error:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// Get order statistics for admin dashboard
app.get('/api/admin/orders/stats', adminAuth, async (req, res) => {
    try {
        // Total orders
        const totalOrders = await Order.countDocuments();
        
        // Total revenue
        const revenueResult = await Order.aggregate([
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);
        const totalRevenue = revenueResult[0]?.total || 0;

        // Orders by status
        const statusStats = await Order.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        // Recent orders (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentOrders = await Order.countDocuments({
            orderDate: { $gte: thirtyDaysAgo }
        });

        res.json({
            totalOrders,
            totalRevenue,
            statusStats,
            recentOrders
        });
    } catch (error) {
        console.error('Get order stats error:', error);
        res.status(500).json({ error: 'Failed to fetch order statistics' });
    }
});

// Admin validation endpoint 
app.post('/api/admin/validate-admin', adminAuth, async (req, res) => {
    try {
        res.json({
            valid: true,
            user: {
                id: req.user.id,
                username: req.user.username,
                email: req.user.email,
                role: req.user.role || 'admin'
            }
        });
    } catch (error) {
        console.error('Admin validation error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get detailed order information (admin only)
app.get('/api/admin/orders/:orderId', adminAuth, async (req, res) => {
    try {
        const { orderId } = req.params;
        
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json(order);
    } catch (error) {
        console.error('Get order details error:', error);
        res.status(500).json({ error: 'Failed to fetch order details' });
    }
});

// UPDATE YOUR EXISTING ORDER STATUS ROUTE - Add adminAuth middleware
app.patch('/api/orders/:id/status', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Validate status
        const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const order = await Order.findByIdAndUpdate(
            id,
            { 
                status, 
                updatedAt: new Date()
            },
            { new: true }
        );

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Log status change
        console.log(`📋 Order status updated by admin:`, {
            orderId: id,
            newStatus: status,
            adminId: req.user.id,
            adminEmail: req.user.email,
            timestamp: new Date().toISOString()
        });

        res.json(order);
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ error: 'Failed to update order status' });
    }
});

// DELETE order (admin only, use with caution)
app.delete('/api/admin/orders/:orderId', adminAuth, async (req, res) => {
    try {
        const { orderId } = req.params;
        
        const order = await Order.findByIdAndDelete(orderId);
        
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        console.log(`🗑️ Order deleted by admin:`, {
            orderId,
            adminId: req.user.id,
            timestamp: new Date().toISOString()
        });

        res.json({ message: 'Order deleted successfully' });
    } catch (error) {
        console.error('Delete order error:', error);
        res.status(500).json({ error: 'Failed to delete order' });
    }
});


// Routes
// Create order
app.post('/api/orders', validateUser, async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod } = req.body;
    const userId = req.user.userId;

    // Validate products and calculate total
    const productServiceUrl = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002';
    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      try {
        const productResponse = await axios.get(`${productServiceUrl}/api/products/${item.productId}`);
        const product = productResponse.data;

        if (product.stock < item.quantity) {
          return res.status(400).json({ 
            error: `Insufficient stock for ${product.name}. Available: ${product.stock}` 
          });
        }

        const itemTotal = product.price * item.quantity;
        totalAmount += itemTotal;

        orderItems.push({
          productId: product._id,
          name: product.name,
          price: product.price,
          quantity: item.quantity,
          image: product.image
        });

        // Update product stock
        await axios.patch(`${productServiceUrl}/api/products/${product._id}/stock`, {
          quantity: -item.quantity
        });
      } catch (error) {
        return res.status(400).json({ error: `Invalid product: ${item.productId}` });
      }
    }

    // Create order
    const order = new Order({
      userId,
      items: orderItems,
      totalAmount,
      shippingAddress,
      paymentMethod
    });

    await order.save();
    res.status(201).json(order);
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user orders
app.get('/api/orders', validateUser, async (req, res) => {
  try {
    const userId = req.user.userId;
    const orders = await Order.find({ userId }).sort({ orderDate: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single order
app.get('/api/orders/:id', validateUser, async (req, res) => {
  try {
    const userId = req.user.userId;
    const order = await Order.findOne({ _id: req.params.id, userId });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update order status (Admin only)
app.patch('/api/orders/:id/status', validateUser, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status, updatedAt: Date.now() },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Cancel order
app.patch('/api/orders/:id/cancel', validateUser, async (req, res) => {
  try {
    const userId = req.user.userId;
    const order = await Order.findOne({ _id: req.params.id, userId });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status !== 'pending' && order.status !== 'confirmed') {
      return res.status(400).json({ error: 'Order cannot be cancelled' });
    }

    // Restore product stock
    const productServiceUrl = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002';
    for (const item of order.items) {
      await axios.patch(`${productServiceUrl}/api/products/${item.productId}/stock`, {
        quantity: item.quantity
      });
    }

    order.status = 'cancelled';
    order.updatedAt = Date.now();
    await order.save();

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all orders (Admin only)
app.get('/api/admin/orders', validateUser, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { status, page = 1, limit = 10 } = req.query;
    const query = status ? { status } : {};

    const orders = await Order.find(query)
      .sort({ orderDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(query);

    res.json({
      orders,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get order statistics (Admin only)
app.get('/api/admin/orders/stats', validateUser, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const stats = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    const totalOrders = await Order.countDocuments();
    const totalRevenue = await Order.aggregate([
      { $match: { status: { $in: ['delivered', 'shipped'] } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    res.json({
      statusStats: stats,
      totalOrders,
      totalRevenue: totalRevenue[0]?.total || 0
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'order-service' });
});

app.listen(PORT, () => {
  console.log(`Order Service running on port ${PORT}`);
});

