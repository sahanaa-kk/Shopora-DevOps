
import { useEffect, useMemo, useState } from 'react';
import {
  ShoppingBag, Search, ShoppingCart, Plus, Minus, Trash2,
  PackageCheck, RefreshCw, X, Heart, CheckCircle2, Truck,
  LogOut, ShieldCheck, ClipboardList
} from 'lucide-react';

const money = value => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
}).format(value || 0);

const initialCustomer = {
  name: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  pincode: ''
};

const orderStatuses = [
  'Confirmed',
  'Shipped',
  'Delivered',
  'Cancelled'
];

function App() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState('');

  // Checkout states
  const [showCheckout, setShowCheckout] = useState(false);
  const [customer, setCustomer] = useState(initialCustomer);
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [placingOrder, setPlacingOrder] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [orderResult, setOrderResult] = useState(null);

  // Customer tracking states
  const [showTracking, setShowTracking] = useState(false);
  const [trackingOrderId, setTrackingOrderId] = useState('');
  const [trackingEmail, setTrackingEmail] = useState('');
  const [trackedOrder, setTrackedOrder] = useState(null);
  const [trackingError, setTrackingError] = useState('');
  const [trackingLoading, setTrackingLoading] = useState(false);

  // Admin states
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminToken, setAdminToken] = useState('');
  const [adminOrders, setAdminOrders] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [updatingOrder, setUpdatingOrder] = useState('');

  async function loadProducts() {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/products');

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      setProducts(Array.isArray(data.products) ? data.products : []);
    } catch (err) {
      setError(`${err.message}. Please check that Docker containers are running.`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  const categories = useMemo(
    () => ['All', ...new Set(products.map(p => p.category).filter(Boolean))],
    [products]
  );

  const visible = products.filter(p =>
    (category === 'All' || p.category === category) &&
    `${p.name} ${p.description}`.toLowerCase().includes(search.toLowerCase())
  );

  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  function showMessage(message) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2500);
  }

  function add(product) {
    if (!product.stock) return;

    setCart(old => {
      const existing = old.find(item => item._id === product._id);

      if (existing) {
        if (existing.quantity >= product.stock) return old;

        return old.map(item =>
          item._id === product._id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...old, { ...product, quantity: 1 }];
    });

    showMessage(`${product.name} added to your bag`);
  }

  function changeQuantity(id, amount) {
    setCart(old =>
      old.map(item =>
        item._id === id
          ? {
              ...item,
              quantity: Math.min(item.stock, item.quantity + amount)
            }
          : item
      ).filter(item => item.quantity > 0)
    );
  }

  function toggleFavorite(id) {
    setFavorites(old =>
      old.includes(id)
        ? old.filter(x => x !== id)
        : [...old, id]
    );
  }

  function updateCustomer(event) {
    const { name, value } = event.target;

    setCustomer(old => ({
      ...old,
      [name]: value
    }));
  }

  function validateCheckout() {
    for (const value of Object.values(customer)) {
      if (!value.trim()) {
        setCheckoutError('Please fill in all delivery details.');
        return false;
      }
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
      setCheckoutError('Please enter a valid email address.');
      return false;
    }

    if (!/^\d{10}$/.test(customer.phone)) {
      setCheckoutError('Please enter a valid 10-digit phone number.');
      return false;
    }

    if (!/^\d{6}$/.test(customer.pincode)) {
      setCheckoutError('Please enter a valid 6-digit PIN code.');
      return false;
    }

    if (cart.length === 0) {
      setCheckoutError('Your shopping bag is empty.');
      return false;
    }

    return true;
  }

  function getOrderItems() {
    return cart.map(item => ({
      productId: item._id,
      quantity: item.quantity
    }));
  }

  // Cash on Delivery checkout
  async function placeCODOrder() {
    setCheckoutError('');
    setPlacingOrder(true);

    try {
      const response = await fetch('/api/orders/cod', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customer,
          items: getOrderItems()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Unable to place order.');
      }

      setOrderResult(data);
      setCart([]);
      setShowCheckout(false);
      setShowCart(false);

    } catch (err) {
      setCheckoutError(err.message);
    } finally {
      setPlacingOrder(false);
    }
  }

  // Load Razorpay Checkout script
  function loadRazorpayScript() {
    return new Promise(resolve => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';

      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);

      document.body.appendChild(script);
    });
  }

  // Razorpay test payment checkout
  async function placeRazorpayOrder() {
    setCheckoutError('');
    setPlacingOrder(true);

    try {
      const scriptLoaded = await loadRazorpayScript();

      if (!scriptLoaded) {
        throw new Error('Unable to load Razorpay. Check your internet connection.');
      }

      const response = await fetch('/api/orders/razorpay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customer,
          items: getOrderItems()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Unable to create payment order.');
      }

      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: 'Shopora',
        description: 'E-Commerce Order',
        order_id: data.razorpayOrderId,

        prefill: {
          name: customer.name,
          email: customer.email,
          contact: customer.phone
        },

        theme: {
          color: '#2563eb'
        },

        handler: async function (paymentResponse) {
          try {
            const verifyResponse = await fetch('/api/orders/verify-payment', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                orderId: data.orderId,
                razorpay_order_id: paymentResponse.razorpay_order_id,
                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                razorpay_signature: paymentResponse.razorpay_signature
              })
            });

            const verification = await verifyResponse.json();

            if (!verifyResponse.ok) {
              throw new Error(verification.message || 'Payment verification failed.');
            }

            setOrderResult({
              ...verification,
              totalAmount: data.amount / 100,
              paymentMethod: 'RAZORPAY'
            });

            setCart([]);
            setShowCheckout(false);
            setShowCart(false);

          } catch (err) {
            setCheckoutError(err.message);
          } finally {
            setPlacingOrder(false);
          }
        },

        modal: {
          ondismiss: function () {
            setPlacingOrder(false);
            setCheckoutError('Payment was not completed. You can try again.');
          }
        }
      };

      const payment = new window.Razorpay(options);

      payment.on('payment.failed', function (failure) {
        setPlacingOrder(false);
        setCheckoutError(
          failure.error?.description || 'Payment failed. Please try again.'
        );
      });

      payment.open();

    } catch (err) {
      setCheckoutError(err.message);
      setPlacingOrder(false);
    }
  }

  async function submitCheckout(event) {
    event.preventDefault();

    if (!validateCheckout()) return;

    if (paymentMethod === 'COD') {
      await placeCODOrder();
    } else {
      await placeRazorpayOrder();
    }
  }

  // Customer order tracking
  async function trackOrder(event) {
    event.preventDefault();

    setTrackingError('');
    setTrackedOrder(null);
    setTrackingLoading(true);

    try {
      const response = await fetch('/api/orders/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orderId: trackingOrderId.trim(),
          email: trackingEmail.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Unable to find your order.');
      }

      setTrackedOrder(data.order);

    } catch (err) {
      setTrackingError(err.message);
    } finally {
      setTrackingLoading(false);
    }
  }

  // Admin login
  async function adminLogin(event) {
    event.preventDefault();

    setAdminError('');
    setAdminLoading(true);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: adminEmail.trim(),
          password: adminPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Admin login failed.');
      }

      if (!data.token) {
        throw new Error('Login response did not contain an admin token.');
      }

      setAdminToken(data.token);
      setAdminLoggedIn(true);
      setAdminPassword('');

      await loadAdminOrders(data.token);

    } catch (err) {
      setAdminError(err.message);
      setAdminLoggedIn(false);
    } finally {
      setAdminLoading(false);
    }
  }

  // Load all customer orders for admin
  async function loadAdminOrders(token = adminToken) {
    if (!token) return;

    setAdminError('');
    setAdminLoading(true);

    try {
      const response = await fetch('/api/admin/orders', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Unable to load orders.');
      }

      setAdminOrders(Array.isArray(data.orders) ? data.orders : []);

    } catch (err) {
      setAdminError(err.message);
    } finally {
      setAdminLoading(false);
    }
  }

  // Admin updates order status
  async function updateOrderStatus(orderId, newStatus) {
    setAdminError('');
    setUpdatingOrder(orderId);

    try {
      const response = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          orderStatus: newStatus
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Unable to update order status.');
      }

      showMessage('Order status updated successfully.');
      await loadAdminOrders(adminToken);

    } catch (err) {
      setAdminError(err.message);
    } finally {
      setUpdatingOrder('');
    }
  }

  function adminLogout() {
    setAdminToken('');
    setAdminLoggedIn(false);
    setAdminOrders([]);
    setAdminEmail('');
    setAdminPassword('');
    setAdminError('');
  }

  function openTracking() {
    setShowTracking(true);
    setTrackingError('');
    setTrackedOrder(null);
  }

  function openAdmin() {
    setShowAdmin(true);
    setAdminError('');
  }

  function closeAdmin() {
    setShowAdmin(false);
    adminLogout();
  }

  function formatDate(value) {
    if (!value) return 'Not available';

    return new Date(value).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  }

  function statusClass(status) {
    return String(status || '')
      .toLowerCase()
      .replace(/\s+/g, '-');
  }

  return (
    <div className="app-shell">

      <div className="announcement">
        A LITTLE JOY IN EVERY ORDER <span>✦</span> FREE SHIPPING ON ORDERS OVER ₹1,999
      </div>

      <header className="topbar">
        <a className="brand" href="#" aria-label="Shopora home">
          <span className="brand-icon"><ShoppingBag size={20}/></span>
          shopora<span className="brand-dot">.</span>
        </a>

        <label className="searchbox">
          <Search size={18}/>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search your next favourite..."
          />
          {search && (
            <button
              className="clear-search"
              onClick={() => setSearch('')}
              aria-label="Clear search"
            >
              <X size={15}/>
            </button>
          )}
        </label>

        <div className="topbar-actions">
          <button className="track-button" onClick={openTracking}>
            <PackageCheck size={17}/>
            <span>Track Order</span>
          </button>

          <button className="cart-button" onClick={() => setShowCart(true)}>
            <ShoppingCart size={19}/>
            <span className="cart-label">Bag</span>
            <span className="cart-count">{count}</span>
          </button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy-block">
            <p className="eyebrow">
              <span className="eyebrow-line"/> YOUR EVERYDAY MARKETPLACE
            </p>

            <h1>Good finds.<br/><em>Great prices.</em></h1>

            <p className="hero-description">
              Thoughtful everyday essentials, handpicked to make the little things feel special.
            </p>

            <a className="primary-link" href="#products">
              Explore the collection <span>↗</span>
            </a>

            <div className="hero-note">
              <span>✳</span> Curated essentials. Happy everyday living.
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-blob blob-a"/>
            <div className="hero-blob blob-b"/>

            <div className="hero-photo">
              <img
                src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1000&q=85"
                onError={e => {
                  e.currentTarget.style.display = 'none';
                }}
                alt=""
              />
            </div>

            <div className="hero-sticker">
              <ShoppingBag size={34}/>
              <b>SHOP<br/>HAPPY</b>
            </div>

            <div className="floating-note">
              A little something<br/>for every day <span>✦</span>
            </div>
          </div>
        </section>

        <section id="products" className="catalog">
          <div className="catalog-heading">
            <div>
              <p className="eyebrow">
                <span className="eyebrow-line"/> THE COLLECTION
              </p>
              <h2>Shop essentials<span>.</span></h2>
              <p className="section-subtitle">
                The everyday favourites you'll keep reaching for.
              </p>
            </div>

            <button className="refresh-button" onClick={loadProducts}>
              <RefreshCw size={15}/> Refresh
            </button>
          </div>

          <div className="catalog-toolbar">
            <div className="filters">
              {categories.map(c => (
                <button
                  key={c}
                  className={category === c ? 'filter active' : 'filter'}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>

            <span className="result-count">{visible.length} products</span>
          </div>

          {loading ? (
            <div className="state-panel">
              <span className="loader"/>
              <p>Finding your favourites...</p>
            </div>
          ) : error ? (
            <div className="state-panel error-panel">
              <p>{error}</p>
              <button className="primary-button" onClick={loadProducts}>
                Try again
              </button>
            </div>
          ) : visible.length === 0 ? (
            <div className="state-panel">
              <Search size={28}/>
              <h3>No products found</h3>
              <p>Try another search or category.</p>
            </div>
          ) : (
            <div className="product-grid">
              {visible.map(product => (
                <article className="product-card" key={product._id}>
                  <button
                    className="product-image-button"
                    onClick={() => setSelected(product)}
                    aria-label={`View ${product.name} details`}
                  >
                    <img
                      className="product-image"
                      src={product.image}
                      alt={product.name}
                      loading="lazy"
                      onError={e => {
                        e.currentTarget.src =
                          'https://placehold.co/700x600/f1eee8/574d43?text=Shopora+Product';
                      }}
                    />
                    <span className="category-pill">{product.category}</span>
                  </button>

                  <button
                    className={`favorite-button ${favorites.includes(product._id) ? 'favorited' : ''}`}
                    onClick={() => toggleFavorite(product._id)}
                    aria-label="Toggle wishlist"
                  >
                    <Heart
                      size={17}
                      fill={favorites.includes(product._id) ? 'currentColor' : 'none'}
                    />
                  </button>

                  <div className="product-info">
                    <button
                      className="product-title"
                      onClick={() => setSelected(product)}
                    >
                      {product.name}
                    </button>

                    <p>{product.description}</p>

                    <div className="product-bottom">
                      <strong>{money(product.price)}</strong>
                      <button
                        className="add-button"
                        disabled={product.stock < 1}
                        onClick={() => add(product)}
                      >
                        <Plus size={15}/> Add
                      </button>
                    </div>

                    <small>
                      {product.stock > 0
                        ? `${product.stock} available`
                        : 'Out of stock'}
                    </small>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer>
        <a className="footer-brand" href="#">
          shopora<span>.</span>
        </a>
        <span>Made for everyday living.</span>
        <span>React · Node.js · MongoDB · Docker</span>
        <button className="admin-footer-button" onClick={openAdmin}>
          <ShieldCheck size={15}/> Admin
        </button>
      </footer>

      {/* Product details */}
      {selected && (
        <div
          className="overlay"
          onMouseDown={e => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <section className="detail-modal">
            <button
              className="modal-close"
              onClick={() => setSelected(null)}
              aria-label="Close"
            >
              <X/>
            </button>

            <div className="detail-image-wrap">
              <img
                src={selected.image}
                alt={selected.name}
                onError={e => {
                  e.currentTarget.src =
                    'https://placehold.co/700x600/f1eee8/574d43?text=Shopora+Product';
                }}
              />
            </div>

            <div className="detail-copy">
              <p className="eyebrow">{selected.category}</p>
              <h2>{selected.name}</h2>
              <strong className="detail-price">{money(selected.price)}</strong>
              <p>{selected.description}</p>
              <p className="stock-line">{selected.stock} items available</p>

              <button
                className="primary-button wide"
                disabled={!selected.stock}
                onClick={() => add(selected)}
              >
                <ShoppingCart size={17}/> Add to bag
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Shopping cart */}
      {showCart && (
        <div
          className="overlay"
          onMouseDown={e => {
            if (e.target === e.currentTarget) setShowCart(false);
          }}
        >
          <aside className="cart-drawer">
            <div className="drawer-heading">
              <div>
                <p className="eyebrow">YOUR PICKS</p>
                <h2>Your shopping bag</h2>
              </div>

              <button
                className="modal-close inline-close"
                onClick={() => setShowCart(false)}
              >
                <X/>
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="empty-cart">
                <ShoppingBag size={40}/>
                <h3>Your bag is waiting</h3>
                <p>Add something lovely to get started.</p>
                <button
                  className="primary-button"
                  onClick={() => setShowCart(false)}
                >
                  Continue shopping
                </button>
              </div>
            ) : (
              <>
                <div className="cart-items">
                  {cart.map(item => (
                    <div className="cart-row" key={item._id}>
                      <img
                        src={item.image}
                        alt={item.name}
                        onError={e => {
                          e.currentTarget.src =
                            'https://placehold.co/120x120/f1eee8/574d43?text=Shopora';
                        }}
                      />

                      <div className="cart-item-info">
                        <b>{item.name}</b>
                        <span>{money(item.price)}</span>

                        <div className="quantity">
                          <button
                            onClick={() => changeQuantity(item._id, -1)}
                            aria-label="Decrease quantity"
                          >
                            <Minus size={13}/>
                          </button>

                          <span>{item.quantity}</span>

                          <button
                            onClick={() => changeQuantity(item._id, 1)}
                            disabled={item.quantity >= item.stock}
                            aria-label="Increase quantity"
                          >
                            <Plus size={13}/>
                          </button>
                        </div>
                      </div>

                      <button
                        className="remove-button"
                        onClick={() =>
                          setCart(old => old.filter(x => x._id !== item._id))
                        }
                        aria-label="Remove item"
                      >
                        <Trash2 size={16}/>
                      </button>
                    </div>
                  ))}
                </div>

                <div className="cart-summary">
                  <div>
                    <span>Subtotal</span>
                    <strong>{money(total)}</strong>
                  </div>

                  <p>
                    <PackageCheck size={15}/>
                    Delivery details and payment at checkout.
                  </p>

                  <button
                    className="primary-button wide"
                    onClick={() => {
                      setShowCart(false);
                      setShowCheckout(true);
                      setCheckoutError('');
                    }}
                  >
                    Proceed to checkout
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      {/* Checkout form */}
      {showCheckout && (
        <div className="overlay checkout-overlay">
          <section className="checkout-modal">
            <div className="drawer-heading">
              <div>
                <p className="eyebrow">SHOPORA CHECKOUT</p>
                <h2>Delivery & payment</h2>
              </div>

              <button
                className="modal-close inline-close"
                onClick={() => setShowCheckout(false)}
                disabled={placingOrder}
              >
                <X/>
              </button>
            </div>

            <form onSubmit={submitCheckout}>
              <h3>Delivery information</h3>

              <div className="checkout-fields">
                <label>
                  Full name
                  <input
                    name="name"
                    value={customer.name}
                    onChange={updateCustomer}
                    placeholder="Enter your full name"
                    required
                  />
                </label>

                <label>
                  Email address
                  <input
                    name="email"
                    type="email"
                    value={customer.email}
                    onChange={updateCustomer}
                    placeholder="Enter your email"
                    required
                  />
                </label>

                <label>
                  Phone number
                  <input
                    name="phone"
                    type="tel"
                    maxLength="10"
                    value={customer.phone}
                    onChange={updateCustomer}
                    placeholder="10-digit mobile number"
                    required
                  />
                </label>

                <label>
                  Delivery address
                  <textarea
                    name="address"
                    value={customer.address}
                    onChange={updateCustomer}
                    placeholder="House number, street, area"
                    required
                    rows="3"
                  />
                </label>

                <div className="checkout-two-columns">
                  <label>
                    City
                    <input
                      name="city"
                      value={customer.city}
                      onChange={updateCustomer}
                      placeholder="City"
                      required
                    />
                  </label>

                  <label>
                    PIN code
                    <input
                      name="pincode"
                      maxLength="6"
                      value={customer.pincode}
                      onChange={updateCustomer}
                      placeholder="6-digit PIN"
                      required
                    />
                  </label>
                </div>
              </div>

              <h3>Choose payment method</h3>

              <div className="payment-options">
                <label className={paymentMethod === 'COD' ? 'payment-option selected' : 'payment-option'}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="COD"
                    checked={paymentMethod === 'COD'}
                    onChange={e => setPaymentMethod(e.target.value)}
                  />
                  <span>
                    <b>Cash on Delivery</b>
                    <small>Pay when your order arrives</small>
                  </span>
                </label>

                <label className={paymentMethod === 'RAZORPAY' ? 'payment-option selected' : 'payment-option'}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="RAZORPAY"
                    checked={paymentMethod === 'RAZORPAY'}
                    onChange={e => setPaymentMethod(e.target.value)}
                  />
                  <span>
                    <b>Online Payment</b>
                    <small>Razorpay secure test checkout</small>
                  </span>
                </label>
              </div>

              <div className="checkout-total">
                <span>Order total</span>
                <strong>{money(total)}</strong>
              </div>

              {checkoutError && (
                <p className="checkout-error">{checkoutError}</p>
              )}

              <button
                type="submit"
                className="primary-button wide"
                disabled={placingOrder}
              >
                {placingOrder
                  ? 'Please wait...'
                  : paymentMethod === 'COD'
                    ? 'Place Cash on Delivery Order'
                    : 'Continue to Razorpay Payment'}
              </button>
            </form>
          </section>
        </div>
      )}

      {/* Successful order confirmation */}
      {orderResult && (
        <div className="overlay">
          <section className="order-success-modal">
            <button
              className="modal-close inline-close"
              onClick={() => setOrderResult(null)}
            >
              <X/>
            </button>

            <CheckCircle2 size={55} color="#16a34a"/>

            <h2>Thank you for your order!</h2>

            <p>Your Shopora order has been successfully placed.</p>

            <div className="order-info">
              <span>Order ID</span>
              <strong>{orderResult.orderId}</strong>

              <span>Order amount</span>
              <strong>{money(orderResult.totalAmount)}</strong>

              <span>Payment method</span>
              <strong>{orderResult.paymentMethod}</strong>

              <span>Payment status</span>
              <strong>{orderResult.paymentStatus}</strong>

              <span>Order status</span>
              <strong>{orderResult.orderStatus}</strong>
            </div>

            <p className="order-email-note">
              Please keep your Order ID safe to track your order.
            </p>

            <button
              className="primary-button wide"
              onClick={() => {
                setOrderResult(null);
                setTrackingOrderId(orderResult.orderId || '');
                setTrackingEmail(customer.email);
                openTracking();
              }}
            >
              Track this order
            </button>

            <button
              className="secondary-action"
              onClick={() => setOrderResult(null)}
            >
              Continue shopping
            </button>
          </section>
        </div>
      )}

      {/* Customer order tracking */}
      {showTracking && (
        <div
          className="overlay"
          onMouseDown={e => {
            if (e.target === e.currentTarget) setShowTracking(false);
          }}
        >
          <section className="tracking-modal">
            <button
              className="modal-close inline-close"
              onClick={() => setShowTracking(false)}
            >
              <X/>
            </button>

            <div className="tracking-heading">
              <PackageCheck size={34}/>
              <p className="eyebrow">SHOPORA DELIVERY</p>
              <h2>Track your order</h2>
              <p>Enter your Order ID and email address to see the latest update.</p>
            </div>

            <form className="tracking-form" onSubmit={trackOrder}>
              <label>
                Order ID
                <input
                  value={trackingOrderId}
                  onChange={e => setTrackingOrderId(e.target.value)}
                  placeholder="Example: SHOP-123456789"
                  required
                />
              </label>

              <label>
                Email address
                <input
                  type="email"
                  value={trackingEmail}
                  onChange={e => setTrackingEmail(e.target.value)}
                  placeholder="Email used while ordering"
                  required
                />
              </label>

              {trackingError && (
                <p className="tracking-error">{trackingError}</p>
              )}

              <button
                type="submit"
                className="primary-button wide"
                disabled={trackingLoading}
              >
                {trackingLoading ? 'Searching...' : 'Find my order'}
              </button>
            </form>

            {trackedOrder && (
              <div className="tracking-result">
                <div className="tracking-order-header">
                  <div>
                    <small>ORDER NUMBER</small>
                    <strong>{trackedOrder.orderId}</strong>
                  </div>
                  <span className={`status-pill ${statusClass(trackedOrder.orderStatus)}`}>
                    {trackedOrder.orderStatus}
                  </span>
                </div>

                {trackedOrder.orderStatus === 'Cancelled' ? (
                  <div className="cancelled-message">
                    <X size={22}/>
                    <b>This order has been cancelled.</b>
                  </div>
                ) : (
                  <div className="tracking-progress">
                    {['Confirmed', 'Shipped', 'Delivered'].map((stage, index) => {
                      const currentIndex = orderStatuses
                        .filter(s => s !== 'Cancelled')
                        .indexOf(trackedOrder.orderStatus);

                      const completed = index <= currentIndex;

                      return (
                        <div
                          className={`tracking-stage ${completed ? 'completed' : ''}`}
                          key={stage}
                        >
                          <div className="tracking-stage-icon">
                            {index === 0 ? (
                              <CheckCircle2 size={18}/>
                            ) : index === 1 ? (
                              <Truck size={18}/>
                            ) : (
                              <PackageCheck size={18}/>
                            )}
                          </div>
                          <span>{stage}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="tracking-details">
                  <div>
                    <span>Order date</span>
                    <strong>{formatDate(trackedOrder.createdAt)}</strong>
                  </div>

                  <div>
                    <span>Total amount</span>
                    <strong>{money(trackedOrder.totalAmount)}</strong>
                  </div>

                  <div>
                    <span>Payment method</span>
                    <strong>{trackedOrder.paymentMethod}</strong>
                  </div>

                  <div>
                    <span>Payment status</span>
                    <strong>{trackedOrder.paymentStatus}</strong>
                  </div>
                </div>

                <h3>Items in your order</h3>

                <div className="tracked-items">
                  {(trackedOrder.items || []).map((item, index) => (
                    <div className="tracked-item" key={item._id || index}>
                      <span>{item.name} × {item.quantity}</span>
                      <strong>{money(item.price * item.quantity)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Admin panel */}
      {showAdmin && (
        <div className="overlay admin-overlay">
          <section className="admin-modal">
            <div className="admin-heading">
              <div>
                <p className="eyebrow">SHOPORA MANAGEMENT</p>
                <h2><ShieldCheck size={24}/> Admin panel</h2>
              </div>

              <button
                className="modal-close inline-close"
                onClick={closeAdmin}
              >
                <X/>
              </button>
            </div>

            {!adminLoggedIn ? (
              <div className="admin-login">
                <div className="admin-login-icon">
                  <ShieldCheck size={32}/>
                </div>

                <h3>Administrator login</h3>
                <p>Sign in to manage customer orders.</p>

                <form onSubmit={adminLogin}>
                  <label>
                    Admin email
                    <input
                      type="email"
                      value={adminEmail}
                      onChange={e => setAdminEmail(e.target.value)}
                      placeholder="Enter admin email"
                      required
                    />
                  </label>

                  <label>
                    Password
                    <input
                      type="password"
                      value={adminPassword}
                      onChange={e => setAdminPassword(e.target.value)}
                      placeholder="Enter admin password"
                      required
                    />
                  </label>

                  {adminError && (
                    <p className="admin-error">{adminError}</p>
                  )}

                  <button
                    type="submit"
                    className="primary-button wide"
                    disabled={adminLoading}
                  >
                    {adminLoading ? 'Signing in...' : 'Login'}
                  </button>
                </form>
              </div>
            ) : (
              <div className="admin-dashboard">
                <div className="admin-toolbar">
                  <div>
                    <h3><ClipboardList size={19}/> Customer orders</h3>
                    <p>View and update all Shopora orders.</p>
                  </div>

                  <div className="admin-toolbar-actions">
                    <button
                      className="refresh-button"
                      onClick={() => loadAdminOrders()}
                      disabled={adminLoading}
                    >
                      <RefreshCw size={15}/> Refresh
                    </button>

                    <button
                      className="admin-logout"
                      onClick={adminLogout}
                    >
                      <LogOut size={15}/> Logout
                    </button>
                  </div>
                </div>

                <div className="admin-summary">
                  <div>
                    <span>Total orders</span>
                    <strong>{adminOrders.length}</strong>
                  </div>
                  <div>
                    <span>Delivered</span>
                    <strong>
                      {adminOrders.filter(o => o.orderStatus === 'Delivered').length}
                    </strong>
                  </div>
                  <div>
                    <span>Pending delivery</span>
                    <strong>
                      {adminOrders.filter(o =>
                        ['Confirmed', 'Shipped'].includes(o.orderStatus)
                      ).length}
                    </strong>
                  </div>
                </div>

                {adminError && (
                  <p className="admin-error">{adminError}</p>
                )}

                {adminLoading ? (
                  <div className="state-panel">
                    <span className="loader"/>
                    <p>Loading orders...</p>
                  </div>
                ) : adminOrders.length === 0 ? (
                  <div className="admin-empty">
                    <PackageCheck size={35}/>
                    <h3>No orders yet</h3>
                    <p>Customer orders will appear here.</p>
                  </div>
                ) : (
                  <div className="admin-orders">
                    {adminOrders.map(order => (
                      <article className="admin-order-card" key={order._id}>
                        <div className="admin-order-top">
                          <div>
                            <small>ORDER ID</small>
                            <strong>{order.orderId}</strong>
                          </div>

                          <span className={`status-pill ${statusClass(order.orderStatus)}`}>
                            {order.orderStatus}
                          </span>
                        </div>

                        <div className="admin-order-customer">
                          <h4>{order.customer?.name || 'Customer'}</h4>
                          <span>{order.customer?.email}</span>
                          <span>{order.customer?.phone}</span>
                          <span>
                            {[
                              order.customer?.address,
                              order.customer?.city,
                              order.customer?.pincode
                            ].filter(Boolean).join(', ')}
                          </span>
                        </div>

                        <div className="admin-order-details">
                          <div>
                            <small>AMOUNT</small>
                            <strong>{money(order.totalAmount)}</strong>
                          </div>

                          <div>
                            <small>PAYMENT METHOD</small>
                            <strong>{order.paymentMethod}</strong>
                          </div>

                          <div>
                            <small>PAYMENT STATUS</small>
                            <strong>{order.paymentStatus}</strong>
                          </div>

                          <div>
                            <small>ORDER DATE</small>
                            <strong>{formatDate(order.createdAt)}</strong>
                          </div>
                        </div>

                        <div className="admin-order-items">
                          <b>Items:</b>
                          {(order.items || []).map((item, index) => (
                            <span key={item._id || index}>
                              {item.name} × {item.quantity}
                            </span>
                          ))}
                        </div>

                        <div className="admin-status-control">
                          <label>
                            Update order status
                            <select
                              value={order.orderStatus}
                              disabled={updatingOrder === order._id}
                              onChange={e =>
                                updateOrderStatus(order._id, e.target.value)
                              }
                            >
                              {orderStatuses.map(status => (
                                <option value={status} key={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </label>

                          {updatingOrder === order._id && (
                            <small>Updating...</small>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {toast && (
        <div className="toast">
          <CheckCircle2 size={17}/>{toast}
        </div>
      )}
    </div>
  );
}

export default App;
