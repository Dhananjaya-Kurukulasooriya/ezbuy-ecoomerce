// product-service/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(express.json());
app.use(cors());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ezbuy', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Product Schema
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  brand: { type: String, required: true },
  image: { type: String, default: 'https://via.placeholder.com/300x200' },
  stock: { type: Number, required: true, default: 0 },
  specifications: {
    voltage: String,
    power: String,
    warranty: String,
    color: String
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', productSchema);

// Initialize with sample electrical devices
const initializeProducts = async () => {
  try {
    const count = await Product.countDocuments();
    if (count === 0) {
      const sampleProducts = [
        {
          name: "Samsung 65-inch 4K Smart TV",
          description: "Ultra HD 4K Smart TV with HDR and built-in streaming apps",
          price: 799.99,
          category: "Television",
          brand: "Samsung",
          stock: 15,
          image: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=400&h=300&fit=crop&auto=format",
          specifications: {
            voltage: "110-240V",
            power: "150W",
            warranty: "2 years",
            color: "Black"
          }
        },
        {
          name: "iPhone 15 Pro",
          description: "Latest iPhone with A17 Pro chip and titanium design",
          price: 999.99,
          category: "Smartphone",
          brand: "Apple",
          stock: 25,
          image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=300&fit=crop&auto=format",
          specifications: {
            voltage: "5V",
            power: "20W",
            warranty: "1 year",
            color: "Space Gray"
          }
        },
        {
          name: "Dell XPS 13 Laptop",
          description: "Premium ultrabook with Intel Core i7 processor",
          price: 1299.99,
          category: "Laptop",
          brand: "Dell",
          stock: 10,
          image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=300&fit=crop&auto=format",
          specifications: {
            voltage: "19.5V",
            power: "65W",
            warranty: "2 years",
            color: "Silver"
          }
        },
        {
          name: "Sony WH-1000XM4 Headphones",
          description: "Wireless noise-canceling headphones with premium sound",
          price: 299.99,
          category: "Audio",
          brand: "Sony",
          stock: 30,
          image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop&auto=format",
          specifications: {
            voltage: "5V",
            power: "1.5W",
            warranty: "1 year",
            color: "Black"
          }
        },
        {
          name: "LG 27-inch Gaming Monitor",
          description: "144Hz gaming monitor with 1ms response time",
          price: 399.99,
          category: "Monitor",
          brand: "LG",
          stock: 20,
          image: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&h=300&fit=crop&auto=format",
          specifications: {
            voltage: "110-240V",
            power: "40W",
            warranty: "3 years",
            color: "Black"
          }
        },
        {
          name: "MacBook Pro 16-inch",
          description: "Powerful laptop with M3 Pro chip for professionals",
          price: 2499.99,
          category: "Laptop",
          brand: "Apple",
          stock: 8,
          image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=300&fit=crop&auto=format",
          specifications: {
            voltage: "20V",
            power: "96W",
            warranty: "1 year",
            color: "Space Gray"
          }
        },
        {
          name: "PlayStation 5 Console",
          description: "Next-gen gaming console with ultra-high-speed SSD",
          price: 499.99,
          category: "Gaming",
          brand: "Sony",
          stock: 12,
          image: "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=400&h=300&fit=crop&auto=format",
          specifications: {
            voltage: "110-240V",
            power: "200W",
            warranty: "1 year",
            color: "White"
          }
        },
        {
          name: "AirPods Pro 2nd Gen",
          description: "Active noise cancellation with spatial audio",
          price: 249.99,
          category: "Audio",
          brand: "Apple",
          stock: 40,
          image: "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=400&h=300&fit=crop&auto=format",
          specifications: {
            voltage: "5V",
            power: "0.5W",
            warranty: "1 year",
            color: "White"
          }
        }
      ];

      await Product.insertMany(sampleProducts);
      console.log('Sample products with real images inserted');
    }
  } catch (error) {
    console.error('Error initializing products:', error);
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
                console.log(`🚨 Unauthorized product admin access:`, {
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
        console.error('Product admin auth error:', error);
        res.status(500).json({ 
            error: 'Server error during authentication.',
            code: 'SERVER_ERROR'
        });
    }
};


// Routes
// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const { category, brand, minPrice, maxPrice, search } = req.query;
    let query = {};

    if (category) query.category = category;
    if (brand) query.brand = brand;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const products = await Product.find(query);
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single product
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create product (Admin only)
app.post('/api/products', async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update product (Admin only)
app.put('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true }
    );
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete product (Admin only)
app.delete('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get categories
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await Product.distinct('category');
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get brands
app.get('/api/brands', async (req, res) => {
  try {
    const brands = await Product.distinct('brand');
    res.json(brands);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update stock
app.patch('/api/products/:id/stock', async (req, res) => {
  try {
    const { quantity } = req.body;
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    product.stock = Math.max(0, product.stock + quantity);
    await product.save();

    res.json({ stock: product.stock });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'product-service' });
});

// Initialize products on startup
mongoose.connection.once('open', () => {
  initializeProducts();
});

app.listen(PORT, () => {
  console.log(`Product Service running on port ${PORT}`);
});



app.post('/api/products', adminAuth, async (req, res) => {
    try {
        const { name, description, price, category, brand, stock, image } = req.body;

        // Enhanced validation
        if (!name || !description || !category || !brand) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (price <= 0) {
            return res.status(400).json({ error: 'Price must be greater than 0' });
        }

        if (stock < 0) {
            return res.status(400).json({ error: 'Stock cannot be negative' });
        }

        // Your existing product creation logic here
        const product = new Product({
            name: name.trim(),
            description: description.trim(),
            price: parseFloat(price),
            category: category.trim(),
            brand: brand.trim(),
            stock: parseInt(stock),
            image: image?.trim() || 'https://via.placeholder.com/300x200?text=Product+Image'
        });

        await product.save();

        console.log(`📦 Product created by admin:`, {
            productId: product._id,
            name: product.name,
            adminId: req.user.id,
            timestamp: new Date().toISOString()
        });

        res.status(201).json(product);
    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({ error: 'Failed to create product' });
    }
});

// UPDATE: Add adminAuth to UPDATE route
app.put('/api/products/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, price, category, brand, stock, image } = req.body;

        // Enhanced validation
        if (!name || !description || !category || !brand) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (price <= 0) {
            return res.status(400).json({ error: 'Price must be greater than 0' });
        }

        if (stock < 0) {
            return res.status(400).json({ error: 'Stock cannot be negative' });
        }

        const product = await Product.findByIdAndUpdate(
            id,
            {
                name: name.trim(),
                description: description.trim(),
                price: parseFloat(price),
                category: category.trim(),
                brand: brand.trim(),
                stock: parseInt(stock),
                image: image?.trim() || 'https://via.placeholder.com/300x200?text=Product+Image',
                updatedAt: new Date()
            },
            { new: true }
        );

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        console.log(`📦 Product updated by admin:`, {
            productId: id,
            name: product.name,
            adminId: req.user.id,
            timestamp: new Date().toISOString()
        });

        res.json(product);
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// UPDATE: Add adminAuth to DELETE route
app.delete('/api/products/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const product = await Product.findByIdAndDelete(id);

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        console.log(`🗑️ Product deleted by admin:`, {
            productId: id,
            name: product.name,
            adminId: req.user.id,
            timestamp: new Date().toISOString()
        });

        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});
