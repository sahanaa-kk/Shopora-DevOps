
const express = require('express');
const jwt = require('jsonwebtoken');

const Order = require('../models/Order');
const adminAuth = require('../middleware/adminAuth');

const {
  sendOrderStatusUpdate
} = require('../utils/email');

const router = express.Router();

// Admin login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (
    !email ||
    !password ||
    email !== process.env.ADMIN_EMAIL ||
    password !== process.env.ADMIN_PASSWORD
  ) {
    return res.status(401).json({
      message: 'Invalid admin email or password.'
    });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({
      message: 'Admin authentication is not configured.'
    });
  }

  const token = jwt.sign(
    { role: 'admin', email },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({
    message: 'Admin login successful.',
    token
  });
});

// Get all customer orders
router.get('/orders', adminAuth, async (_req, res) => {
  try {
    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      count: orders.length,
      orders
    });
  } catch (error) {
    console.error('Admin orders error:', error);

    res.status(500).json({
      message: 'Unable to fetch orders.'
    });
  }
});

// Update order status and notify customer
router.patch('/orders/:id/status', adminAuth, async (req, res) => {
  try {
    const allowedStatuses = [
      'Confirmed',
      'Shipped',
      'Delivered',
      'Cancelled'
    ];

    const { status } = req.body;

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: 'Invalid order status.'
      });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        message: 'Order not found.'
      });
    }

    const previousStatus = order.orderStatus;

    if (previousStatus === status) {
      return res.json({
        message: 'Order already has this status.',
        order
      });
    }

    order.orderStatus = status;
    await order.save();

    // Notify customer about the status change
    await sendOrderStatusUpdate(order);

    res.json({
      message: 'Order status updated successfully.',
      previousStatus,
      order
    });

  } catch (error) {
    console.error('Update order error:', error);

    res.status(500).json({
      message: 'Unable to update order status.'
    });
  }
});

module.exports = router;
