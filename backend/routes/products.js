const express = require('express');
const Product = require('../models/Product');
const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 }).lean();
    res.json({ products, count: products.length });
  } catch (error) {
    console.error('Product list error:', error);
    res.status(500).json({ message: 'Unable to fetch products' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ product });
  } catch (error) {
    res.status(400).json({ message: 'Invalid product ID' });
  }
});

module.exports = router;
