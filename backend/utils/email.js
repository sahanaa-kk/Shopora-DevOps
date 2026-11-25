
const nodemailer = require('nodemailer');

function createTransporter() {
  const port = Number(process.env.SMTP_PORT || 587);

  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS ||
    !process.env.EMAIL_FROM
  ) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

// Send order confirmation email
async function sendOrderConfirmation(order) {
  const transporter = createTransporter();

  if (!transporter) {
    console.log('Email not configured. Order confirmation email skipped.');
    return;
  }

  const items = order.items.map(item => `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td>${item.quantity}</td>
      <td>₹${item.price}</td>
    </tr>
  `).join('');

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: order.customer.email,
      subject: `Shopora Order Confirmation - ${order.orderId}`,
      text: `Hello ${order.customer.name},

Your Shopora order has been placed successfully.

Order ID: ${order.orderId}
Total: ₹${order.totalAmount}
Payment method: ${order.paymentMethod}
Payment status: ${order.paymentStatus}
Order status: ${order.orderStatus}

Thank you for shopping with Shopora!`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
          <h2 style="color:#2563eb;">Shopora</h2>
          <h3>Thank you for your order!</h3>
          <p>Hello ${escapeHtml(order.customer.name)},</p>
          <p>Your order has been placed successfully.</p>
          <p><strong>Order ID:</strong> ${escapeHtml(order.orderId)}</p>
          <table border="1" cellpadding="10" cellspacing="0"
            style="border-collapse:collapse;width:100%;">
            <tr>
              <th>Product</th>
              <th>Quantity</th>
              <th>Price</th>
            </tr>
            ${items}
          </table>
          <p><strong>Total:</strong> ₹${order.totalAmount}</p>
          <p><strong>Payment:</strong> ${escapeHtml(order.paymentMethod)}</p>
          <p><strong>Payment status:</strong> ${escapeHtml(order.paymentStatus)}</p>
          <p><strong>Order status:</strong> ${escapeHtml(order.orderStatus)}</p>
          <p>Thank you for shopping with Shopora!</p>
        </div>
      `
    });

    console.log(`Order confirmation email sent: ${order.orderId}`);
  } catch (error) {
    console.error('Order confirmation email failed:', error.message);
  }
}

// Send order status update email
async function sendOrderStatusUpdate(order) {
  const transporter = createTransporter();

  if (!transporter) {
    console.log('Email not configured. Status update email skipped.');
    return;
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: order.customer.email,
      subject: `Shopora Order Update - ${order.orderId}`,
      text: `Hello ${order.customer.name},

Your Shopora order ${order.orderId} has been updated.

New order status: ${order.orderStatus}

Thank you for shopping with Shopora!`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">
          <h2 style="color:#2563eb;">Shopora</h2>
          <h3>Your order has been updated!</h3>
          <p>Hello ${escapeHtml(order.customer.name)},</p>
          <p>Your order <strong>${escapeHtml(order.orderId)}</strong>
             has a new status:</p>
          <h2>${escapeHtml(order.orderStatus)}</h2>
          <p>Thank you for shopping with Shopora!</p>
        </div>
      `
    });

    console.log(`Order status email sent: ${order.orderId}`);
  } catch (error) {
    console.error('Order status email failed:', error.message);
  }
}

module.exports = {
  sendOrderConfirmation,
  sendOrderStatusUpdate
};
