
const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');

const Order = require('../models/Order');
const Product = require('../models/Product');

const {
  sendOrderConfirmation
} = require('../utils/email');

const router = express.Router();

// Generate unique order ID
function createOrderId() {
  return 'SHOP-' + Date.now() + '-' +
    crypto.randomBytes(3).toString('hex').toUpperCase();
}

// Validate customer details
function validateCustomer(customer) {
  const required = [
    'name',
    'email',
    'phone',
    'address',
    'city',
    'pincode'
  ];

  return customer &&
    required.every(field =>
      typeof customer[field] === 'string' &&
      customer[field].trim().length > 0
    ) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email);
}

// Validate products and calculate total using database prices
async function prepareItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Your cart is empty.');
  }

  const quantities = new Map();

  for (const item of items) {
    if (
      !item.productId ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1
    ) {
      throw new Error('Invalid cart item.');
    }

    quantities.set(
      String(item.productId),
      (quantities.get(String(item.productId)) || 0) +
        item.quantity
    );
  }

  const prepared = [];
  let totalAmount = 0;

  for (const [productId, quantity] of quantities) {
    if (!/^[a-f\d]{24}$/i.test(productId)) {
      throw new Error('Invalid product ID.');
    }

    const product = await Product.findById(productId);

    if (!product) {
      throw new Error('A product in your cart no longer exists.');
    }

    if (quantity > product.stock) {
      throw new Error(
        `${product.name} does not have enough stock.`
      );
    }

    prepared.push({
      product: product._id,
      name: product.name,
      price: product.price,
      quantity,
      image: product.image
    });

    totalAmount += product.price * quantity;
  }

  return { prepared, totalAmount };
}

// Create Cash on Delivery order
router.post('/cod', async (req, res) => {
  try {
    const { customer, items } = req.body;

    if (!validateCustomer(customer)) {
      return res.status(400).json({
        message: 'Please enter valid delivery details.'
      });
    }

    const { prepared, totalAmount } =
      await prepareItems(items);

    const order = await Order.create({
      orderId: createOrderId(),
      customer,
      items: prepared,
      totalAmount,
      paymentMethod: 'COD',
      paymentStatus: 'PENDING',
      orderStatus: 'Confirmed'
    });

    // Send order confirmation email
    await sendOrderConfirmation(order);

    res.status(201).json({
      message: 'Order placed successfully.',
      orderId: order.orderId,
      totalAmount: order.totalAmount,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus
    });

  } catch (error) {
    console.error('COD order error:', error);

    res.status(400).json({
      message: error.message || 'Unable to place order.'
    });
  }
});

// Create Razorpay test payment order
router.post('/razorpay', async (req, res) => {
  try {
    const { customer, items } = req.body;

    if (!validateCustomer(customer)) {
      return res.status(400).json({
        message: 'Please enter valid delivery details.'
      });
    }

    if (
      !process.env.RAZORPAY_KEY_ID ||
      !process.env.RAZORPAY_KEY_SECRET
    ) {
      return res.status(503).json({
        message: 'Online payment is not configured yet.'
      });
    }

    const { prepared, totalAmount } =
      await prepareItems(items);

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const receipt = createOrderId();

    const paymentOrder = await razorpay.orders.create({
      amount: Math.round(totalAmount * 100),
      currency: 'INR',
      receipt
    });

    const order = await Order.create({
      orderId: receipt,
      customer,
      items: prepared,
      totalAmount,
      paymentMethod: 'RAZORPAY',
      paymentStatus: 'PENDING',
      razorpayOrderId: paymentOrder.id,
      orderStatus: 'Confirmed'
    });

    res.status(201).json({
      message: 'Payment order created.',
      orderId: order.orderId,
      razorpayOrderId: paymentOrder.id,
      amount: paymentOrder.amount,
      currency: paymentOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    console.error('Razorpay order error:', error);

    res.status(400).json({
      message: error.message || 'Unable to create payment order.'
    });
  }
});

// Verify Razorpay payment
router.post('/verify-payment', async (req, res) => {
  try {
    const {
      orderId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    if (
      !orderId ||
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        message: 'Payment verification details are incomplete.'
      });
    }

    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({
        message: 'Payment verification is not configured.'
      });
    }

    const order = await Order.findOne({ orderId });

    if (
      !order ||
      order.razorpayOrderId !== razorpay_order_id
    ) {
      return res.status(404).json({
        message: 'Order not found.'
      });
    }

    if (order.paymentStatus === 'PAID') {
      return res.json({
        message: 'Payment already verified.',
        orderId: order.orderId
      });
    }

    const expectedSignature = crypto
      .createHmac(
        'sha256',
        process.env.RAZORPAY_KEY_SECRET
      )
      .update(
        `${razorpay_order_id}|${razorpay_payment_id}`
      )
      .digest('hex');

    if (!/^[a-f\d]{128}$/i.test(razorpay_signature)) {
      return res.status(400).json({
        message: 'Invalid payment signature.'
      });
    }

    const supplied = Buffer.from(
      razorpay_signature,
      'hex'
    );

    const expected = Buffer.from(
      expectedSignature,
      'hex'
    );

    if (
      supplied.length !== expected.length ||
      !crypto.timingSafeEqual(supplied, expected)
    ) {
      order.paymentStatus = 'FAILED';
      await order.save();

      return res.status(400).json({
        message: 'Payment verification failed.'
      });
    }

    order.paymentStatus = 'PAID';
    order.paymentId = razorpay_payment_id;
    await order.save();

    // Send confirmation after successful payment
    await sendOrderConfirmation(order);

    res.json({
      message: 'Payment successful. Your order is confirmed.',
      orderId: order.orderId,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus
    });

  } catch (error) {
    console.error('Payment verification error:', error);

    res.status(500).json({
      message: 'Unable to verify payment.'
    });
  }
});

// Customer order tracking using Order ID and email
router.post('/track', async (req, res) => {
  try {
    const { orderId, email } = req.body;

    if (
      typeof orderId !== 'string' ||
      typeof email !== 'string' ||
      !orderId.trim() ||
      !email.trim()
    ) {
      return res.status(400).json({
        message: 'Please enter your order ID and email.'
      });
    }

    const order = await Order.findOne({
      orderId: orderId.trim(),
      'customer.email': email.trim().toLowerCase()
    }).select(
      'orderId items totalAmount paymentMethod paymentStatus orderStatus createdAt'
    );

    if (!order) {
      return res.status(404).json({
        message: 'No order found with these details.'
      });
    }

    res.json({ order });

  } catch (error) {
    console.error('Order tracking error:', error);

    res.status(500).json({
      message: 'Unable to track order.'
    });
  }
});

module.exports = router;
