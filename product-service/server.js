// product-service/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

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
          specifications: {
            voltage: "110-240V",
            power: "40W",
            warranty: "3 years",
            color: "Black"
          }
        }
      ];

      await Product.insertMany(sampleProducts);
      console.log('Sample products inserted');
    }
  } catch (error) {
    console.error('Error initializing products:', error);
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

