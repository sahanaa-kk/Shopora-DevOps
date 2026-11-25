
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true
  },

  customer: {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true }
  },

  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    image: { type: String, default: '' }
  }],

  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },

  paymentMethod: {
    type: String,
    enum: ['COD', 'RAZORPAY'],
    required: true
  },

  paymentStatus: {
    type: String,
    enum: ['PENDING', 'PAID', 'FAILED'],
    default: 'PENDING'
  },

  paymentId: {
    type: String,
    default: ''
  },

  razorpayOrderId: {
    type: String,
    default: ''
  },

  orderStatus: {
    type: String,
    enum: ['Confirmed', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Confirmed'
  }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
