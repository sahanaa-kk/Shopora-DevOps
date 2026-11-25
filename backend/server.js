
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const Product = require('./models/Product');

const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');

const app = express();

const PORT = process.env.PORT || 5000;
const MONGO_URI =
  process.env.MONGO_URI || 'mongodb://localhost:27017/shopora';

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'shopora-api'
  });
});

// API routes
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

// Sample products
const sampleProducts = [
  {
    name: 'Wireless Headphones',
    description: 'Comfortable over-ear headphones with clear, balanced sound for everyday listening.',
    price: 1499,
    category: 'Electronics',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=85',
    stock: 18
  },
  {
    name: 'Smart Watch',
    description: 'Everyday smartwatch with activity tracking and a clean, modern look.',
    price: 2299,
    category: 'Electronics',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900&q=85',
    stock: 12
  },
  {
    name: 'Travel Backpack',
    description: 'Durable backpack for work, college and weekend travel.',
    price: 999,
    category: 'Accessories',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=900&q=85',
    stock: 25
  },
  {
    name: 'Running Shoes',
    description: 'Lightweight shoes designed for daily walks and running.',
    price: 1899,
    category: 'Fashion',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900&q=85',
    stock: 15
  },
  {
    name: 'Desk Lamp',
    description: 'Minimal adjustable lamp to brighten your study or work desk.',
    price: 699,
    category: 'Home',
    image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=900&q=85',
    stock: 30
  },
  {
    name: 'Water Bottle',
    description: 'Reusable stainless-steel bottle for daily hydration.',
    price: 399,
    category: 'Home',
    image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=900&q=85',
    stock: 40
  }
];

// Start server
async function start() {
  try {
    await mongoose.connect(MONGO_URI);

    console.log('Connected to MongoDB');

    const count = await Product.countDocuments();

    if (count === 0) {
      await Product.insertMany(sampleProducts);
      console.log('Sample products inserted.');
    } else {
      for (const sample of sampleProducts) {
        await Product.updateOne(
          {
            name: sample.name,
            $or: [
              { image: '' },
              { image: { $exists: false } }
            ]
          },
          {
            $set: {
              image: sample.image
            }
          }
        );
      }

      console.log(
        'Existing products checked; missing images filled where possible.'
      );
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Shopora API listening on port ${PORT}`);
    });

  } catch (error) {
    console.error('Startup failed:', error);
    process.exit(1);
  }
}

start();
