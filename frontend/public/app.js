// frontend/public/app.js - CLEANED UP VERSION

const API_BASE = '';
let currentUser = null;
let cart = JSON.parse(localStorage.getItem('cart') || '[]');

// Professional Notification System
function showNotification(options) {
    const {
        title = 'Notification',
        message = '',
        type = 'info',
        showCancel = false,
        confirmText = 'OK',
        cancelText = 'Cancel',
        onConfirm = null,
        onCancel = null
    } = options;

    return new Promise((resolve) => {
        const overlay = document.getElementById('notification-overlay');
        const titleEl = document.getElementById('notification-title');
        const iconEl = document.getElementById('notification-icon');
        const messageEl = document.getElementById('notification-message');
        const confirmBtn = document.getElementById('notification-confirm');
        const cancelBtn = document.getElementById('notification-cancel');

        titleEl.textContent = title;
        messageEl.textContent = message;
        confirmBtn.textContent = confirmText;
        cancelBtn.textContent = cancelText;

        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ',
            question: '?'
        };

        iconEl.textContent = icons[type] || icons.info;
        iconEl.className = `notification-icon ${type}`;
        cancelBtn.style.display = showCancel ? 'inline-block' : 'none';

        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        const handleConfirm = () => {
            hideNotification();
            if (onConfirm) onConfirm();
            resolve(true);
        };

        const handleCancel = () => {
            hideNotification();
            if (onCancel) onCancel();
            resolve(false);
        };

        const newConfirmBtn = confirmBtn.cloneNode(true);
        const newCancelBtn = cancelBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

        document.getElementById('notification-confirm').addEventListener('click', handleConfirm);
        document.getElementById('notification-cancel').addEventListener('click', handleCancel);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) handleCancel();
        });

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                handleCancel();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    });
}

function hideNotification() {
    const overlay = document.getElementById('notification-overlay');
    overlay.style.display = 'none';
    document.body.style.overflow = 'auto';
}

function showToast(message, type = 'success', duration = 4000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };

    toast.innerHTML = `
        <div class="toast-icon">${icons[type] || icons.info}</div>
        <div class="toast-message">${message}</div>
        <button class="toast-close">&times;</button>
    `;

    container.appendChild(toast);

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => removeToast(toast));

    setTimeout(() => removeToast(toast), duration);
}

function removeToast(toast) {
    if (toast && toast.parentNode) {
        toast.style.animation = 'toastSlideOut 0.3s ease-out forwards';
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }
}

// Cart page functions
async function loadCartItems() {
    const cartContainer = document.getElementById('cart-items');
    const cartSummary = document.getElementById('cart-summary');
    
    if (!cartContainer) return;
    
    if (cart.length === 0) {
        cartContainer.innerHTML = '<p>Your cart is empty</p>';
        if (cartSummary) cartSummary.innerHTML = '';
        return;
    }
    
    let total = 0;
    const cartHTML = [];
    
    for (const item of cart) {
        try {
            const response = await apiCallWithRetry(`/api/products/${item.productId}`);
            if (!response || !response.ok) continue;
            
            const product = await response.json();
            const itemTotal = product.price * item.quantity;
            total += itemTotal;
            
            cartHTML.push(`
                <div class="cart-item">
                    <img src="${product.image || 'https://via.placeholder.com/80x80'}" alt="${product.name}">
                    <div class="cart-item-details">
                        <h4>${product.name}</h4>
                        <p class="cart-item-price">${product.price}</p>
                        <div class="quantity-controls">
                            <button onclick="updateCartQuantity('${product._id}', ${item.quantity - 1})">-</button>
                            <input type="number" value="${item.quantity}" 
                                   onchange="updateCartQuantity('${product._id}', this.value)"
                                   min="1" max="${product.stock}">
                            <button onclick="updateCartQuantity('${product._id}', ${item.quantity + 1})">+</button>
                        </div>
                        <p>Subtotal: ${itemTotal.toFixed(2)}</p>
                    </div>
                    <button onclick="removeFromCart('${product._id}')" class="btn-danger">Remove</button>
                </div>
            `);
        } catch (error) {
            console.error('Error loading cart item:', error);
        }
    }
    
    cartContainer.innerHTML = cartHTML.join('');
    if (cartSummary) {
        cartSummary.innerHTML = `
            <div class="cart-total">Total: ${total.toFixed(2)}</div>
            <button onclick="proceedToCheckout()" class="btn-primary" style="width: 100%;">
                Proceed to Checkout
            </button>
        `;
    }
}

// Checkout functions
async function proceedToCheckout() {
    if (!currentUser) {
        const shouldLogin = await customConfirm(
            'You need to be logged in to checkout. Would you like to login now?',
            'Login Required',
            'Login',
            'Cancel'
        );
        if (shouldLogin) {
            window.location.href = '/login';
        }
        return;
    }
    
    if (cart.length === 0) {
        await customAlert('Your cart is empty. Add some items before checkout.', 'warning', '🛒 Empty Cart');
        return;
    }
    
    showCheckoutModal();
}

function showCheckoutModal() {
    // Pre-fill user email if available
    if (currentUser && currentUser.email) {
        const emailField = document.getElementById('email');
        if (emailField) emailField.value = currentUser.email;
    }
    
    // Load order summary
    loadCheckoutSummary();
    
    // Show modal
    const modal = document.getElementById('checkout-modal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeCheckoutModal() {
    const modal = document.getElementById('checkout-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

async function loadCheckoutSummary() {
    let subtotal = 0;
    const summaryContainer = document.getElementById('checkout-order-summary');
    if (!summaryContainer) return;
    
    const summaryHTML = [];
    
    for (const item of cart) {
        try {
            const response = await apiCallWithRetry(`/api/products/${item.productId}`);
            if (!response || !response.ok) continue;
            
            const product = await response.json();
            const itemTotal = product.price * item.quantity;
            subtotal += itemTotal;
            
            summaryHTML.push(`
                <div class="order-summary-item">
                    <div>
                        <strong>${product.name}</strong><br>
                        <small>Qty: ${item.quantity} × ${product.price}</small>
                    </div>
                    <div><strong>${itemTotal.toFixed(2)}</strong></div>
                </div>
            `);
        } catch (error) {
            console.error('Error loading checkout item:', error);
        }
    }
    
    summaryContainer.innerHTML = summaryHTML.join('');
    
    // Calculate totals
    const shipping = subtotal > 100 ? 0 : 9.99;
    const tax = subtotal * 0.08;
    const total = subtotal + shipping + tax;
    
    const subtotalEl = document.getElementById('checkout-subtotal');
    const shippingEl = document.getElementById('checkout-shipping');
    const taxEl = document.getElementById('checkout-tax');
    const totalEl = document.getElementById('checkout-total');
    
    if (subtotalEl) subtotalEl.textContent = `${subtotal.toFixed(2)}`;
    if (shippingEl) shippingEl.textContent = shipping === 0 ? 'FREE' : `${shipping.toFixed(2)}`;
    if (taxEl) taxEl.textContent = `${tax.toFixed(2)}`;
    if (totalEl) totalEl.textContent = `${total.toFixed(2)}`;
}

async function processCheckout() {
    try {
        // Collect form data
        const formData = {
            firstName: document.getElementById('first-name')?.value || '',
            lastName: document.getElementById('last-name')?.value || '',
            email: document.getElementById('email')?.value || '',
            phone: document.getElementById('phone')?.value || '',
            address: document.getElementById('address')?.value || '',
            city: document.getElementById('city')?.value || '',
            state: document.getElementById('state')?.value || '',
            zip: document.getElementById('zip')?.value || '',
            country: document.getElementById('country')?.value || '',
            paymentMethod: document.querySelector('input[name="payment-method"]:checked')?.value || 'credit_card'
        };
        
        // Validate required fields
        const requiredFields = ['firstName', 'lastName', 'email', 'address', 'city', 'state', 'zip', 'country'];
        for (const field of requiredFields) {
            if (!formData[field]) {
                await customAlert(
                    `Please fill in the ${field.replace(/([A-Z])/g, ' $1').toLowerCase()} field.`,
                    'warning',
                    '⚠️ Missing Information'
                );
                return;
            }
        }
        
        // Prepare order items
        const orderItems = cart.map(item => ({
            productId: item.productId,
            quantity: item.quantity
        }));
        
        // Submit order
        const response = await apiCallWithRetry('/api/orders', {
            method: 'POST',
            body: JSON.stringify({
                items: orderItems,
                shippingAddress: {
                    street: formData.address,
                    city: formData.city,
                    state: formData.state,
                    zipCode: formData.zip,
                    country: formData.country
                },
                paymentMethod: formData.paymentMethod
            })
        });
        
        if (response && response.ok) {
            // Clear cart
            cart = [];
            localStorage.setItem('cart', JSON.stringify(cart));
            updateCartCount();
            
            // Close modal
            closeCheckoutModal();
            
            // Show success message
            await customAlert(
                'Your order has been placed successfully! You will receive a confirmation email shortly.',
                'success',
                '🎉 Order Placed!'
            );
            
            // Redirect to orders page
            window.location.href = '/orders';
        } else {
            const error = await response.json();
            await customAlert(
                error.error || 'Failed to place order. Please try again.',
                'error',
                '❌ Order Failed'
            );
        }
    } catch (error) {
        console.error('Checkout error:', error);
        await customAlert(
            'An error occurred while processing your order. Please try again.',
            'error',
            '❌ Checkout Error'
        );
    }
}

// Orders page functions
async function loadOrders() {
    if (!currentUser) {
        window.location.href = '/login';
        return;
    }
    
    try {
        const response = await apiCallWithRetry('/api/orders');
        if (!response || !response.ok) {
            throw new Error('Failed to load orders');
        }
        
        const orders = await response.json();
        
        const ordersContainer = document.getElementById('orders-container');
        if (!ordersContainer) return;
        
        if (orders.length === 0) {
            ordersContainer.innerHTML = '<p>No orders found</p>';
            return;
        }
        
        ordersContainer.innerHTML = orders.map(order => `
            <div class="order-card">
                <div class="order-header">
                    <div>
                        <h3>Order #${order._id.substr(-8)}</h3>
                        <p>Date: ${new Date(order.orderDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                        <span class="order-status ${order.status}">${order.status.toUpperCase()}</span>
                        <p><strong>Total: ${order.totalAmount}</strong></p>
                    </div>
                </div>
                <div class="order-items">
                    ${order.items.map(item => `
                        <div class="order-item">
                            <img src="${item.image || 'https://via.placeholder.com/60x60'}" alt="${item.name}">
                            <div>
                                <h4>${item.name}</h4>
                                <p>Quantity: ${item.quantity}</p>
                                <p>Price: ${item.price}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
                ${order.status === 'pending' || order.status === 'confirmed' ? 
                    `<button onclick="cancelOrder('${order._id}')" class="btn-danger">Cancel Order</button>` : 
                    ''
                }
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading orders:', error);
        await customAlert(
            'Failed to load your orders. Please try again.',
            'error',
            '❌ Loading Error'
        );
    }
}

async function cancelOrder(orderId) {
    const shouldCancel = await customConfirm(
        'Are you sure you want to cancel this order? This action cannot be undone.',
        'Cancel Order',
        'Yes, Cancel',
        'Keep Order'
    );
    
    if (!shouldCancel) return;
    
    try {
        const response = await apiCallWithRetry(`/api/orders/${orderId}/cancel`, {
            method: 'PATCH'
        });
        
        if (response && response.ok) {
            showToast('Order cancelled successfully', 'success');
            loadOrders();
        } else {
            const error = await response.json();
            await customAlert(
                error.error || 'Failed to cancel order.',
                'error',
                '❌ Cancellation Failed'
            );
        }
    } catch (error) {
        await customAlert(
            'An error occurred while cancelling the order.',
            'error',
            '❌ Error'
        );
    }
}

async function loadFilters() {
    try {
        // Load categories
        const categoriesResponse = await apiCallWithRetry('/api/categories');
        if (categoriesResponse && categoriesResponse.ok) {
            const categories = await categoriesResponse.json();
            
            const categorySelect = document.getElementById('category-filter');
            if (categorySelect) {
                categories.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category;
                    option.textContent = category;
                    categorySelect.appendChild(option);
                });
            }
        }

        // Load brands
        const brandsResponse = await apiCallWithRetry('/api/brands');
        if (brandsResponse && brandsResponse.ok) {
            const brands = await brandsResponse.json();
            
            const brandSelect = document.getElementById('brand-filter');
            if (brandSelect) {
                brands.forEach(brand => {
                    const option = document.createElement('option');
                    option.value = brand;
                    option.textContent = brand;
                    brandSelect.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error loading filters:', error);
    }

function customAlert(message, type = 'info', title = null) {
    const titles = {
        success: '✅ Success',
        error: '❌ Error',
        warning: '⚠️ Warning',
        info: 'ℹ️ Information'
    };

    return showNotification({
        title: title || titles[type] || 'Notification',
        message: message,
        type: type,
        showCancel: false,
        confirmText: 'OK'
    });
}

function customConfirm(message, title = 'Confirm Action', confirmText = 'Yes', cancelText = 'No') {
    return showNotification({
        title: title,
        message: message,
        type: 'question',
        showCancel: true,
        confirmText: confirmText,
        cancelText: cancelText
    });
}

// Add retry mechanism for API calls
async function apiCallWithRetry(url, options = {}, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const token = localStorage.getItem('token');
            const headers = {
                'Content-Type': 'application/json',
                ...options.headers
            };
            
            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }
            
            const response = await fetch(`${API_BASE}${url}`, {
                ...options,
                headers
            });
            
            if (response.status === 401) {
                logout();
                return null;
            }
            
            return response;
        } catch (error) {
            console.log(`API call attempt ${i + 1} failed:`, error);
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}

// Authentication functions
async function login(email, password) {
    try {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        currentUser = data.user;
        
        showToast('Login successful! Welcome back.', 'success');
        setTimeout(() => {
            window.location.href = '/';
        }, 1000);
    } catch (error) {
        throw error;
    }
}

async function register(username, email, password) {
    try {
        const response = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        
        await customAlert(
            'Registration successful! You can now login with your credentials.',
            'success',
            '🎉 Welcome to EzBuy!'
        );
        window.location.reload();
    } catch (error) {
        throw error;
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('cart');
    currentUser = null;
    cart = [];
    
    updateNavigation();
    updateCartCount();
    showToast('Logged out successfully', 'info');
    
    setTimeout(() => {
        window.location.href = '/';
    }, 1000);
}

async function checkAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
        currentUser = JSON.parse(user);
        updateNavigation();
        updateCartCount();
    }
}

function updateNavigation() {
    const loginLink = document.getElementById('login-link');
    const logoutLink = document.getElementById('logout-link');
    const adminLink = document.getElementById('admin-link');
    
    if (currentUser) {
        if (loginLink) loginLink.style.display = 'none';
        if (logoutLink) logoutLink.style.display = 'block';
        if (adminLink && currentUser.role === 'admin') {
            adminLink.style.display = 'block';
        }
    } else {
        if (loginLink) loginLink.style.display = 'block';
        if (logoutLink) logoutLink.style.display = 'none';
        if (adminLink) adminLink.style.display = 'none';
    }
}

// Cart functions
async function addToCart(productId) {
    if (!currentUser) {
        const shouldLogin = await customConfirm(
            'You need to be logged in to add items to cart. Would you like to login now?',
            'Login Required',
            'Login',
            'Cancel'
        );
        if (shouldLogin) {
            window.location.href = '/login';
        }
        return;
    }
    
    const existingItem = cart.find(item => item.productId === productId);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ productId, quantity: 1 });
    }
    
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    showToast('Item added to cart!', 'success');
}

function updateCartCount() {
    const cartCount = document.getElementById('cart-count');
    if (cartCount) {
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartCount.textContent = totalItems;
    }
}

async function removeFromCart(productId) {
    const shouldRemove = await customConfirm(
        'Are you sure you want to remove this item from your cart?',
        'Remove Item',
        'Remove',
        'Cancel'
    );
    
    if (shouldRemove) {
        cart = cart.filter(item => item.productId !== productId);
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartCount();
        showToast('Item removed from cart', 'info');
        if (window.location.pathname === '/cart') {
            loadCartItems();
        }
    }
}

function updateCartQuantity(productId, quantity) {
    const item = cart.find(item => item.productId === productId);
    if (item) {
        if (quantity <= 0) {
            removeFromCart(productId);
        } else {
            item.quantity = quantity;
            localStorage.setItem('cart', JSON.stringify(cart));
            updateCartCount();
            loadCartItems();
        }
    }
}

// Product loading functions
async function loadFeaturedProducts() {
    try {
        console.log('Loading featured products...');
        const response = await apiCallWithRetry('/api/products');
        
        if (!response) {
            console.error('No response from products API');
            return;
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const products = await response.json();
        console.log('Products loaded:', products);
        
        const grid = document.getElementById('featured-products-grid');
        if (!grid) {
            console.error('Featured products grid element not found');
            return;
        }
        
        if (products && products.length > 0) {
            grid.innerHTML = products.slice(0, 4).map(product => `
                <div class="product-card">
                    <img src="${product.image || 'https://via.placeholder.com/300x200'}" alt="${product.name}">
                    <h3>${product.name}</h3>
                    <p class="price">$${product.price}</p>
                    <button onclick="addToCart('${product._id}')" class="btn-secondary">Add to Cart</button>
                </div>
            `).join('');
        } else {
            grid.innerHTML = '<p>No products available at the moment. Please try again later.</p>';
        }
    } catch (error) {
        console.error('Error loading featured products:', error);
        const grid = document.getElementById('featured-products-grid');
        if (grid) {
            grid.innerHTML = '<p>Unable to load products. Please check your connection and try again.</p>';
        }
    }
}

async function loadProducts() {
    try {
        console.log('Loading products...');
        const category = document.getElementById('category-filter')?.value || '';
        const brand = document.getElementById('brand-filter')?.value || '';
        const search = document.getElementById('search-input')?.value || '';
        
        let url = '/api/products?';
        if (category) url += `category=${category}&`;
        if (brand) url += `brand=${brand}&`;
        if (search) url += `search=${search}&`;
        
        const response = await apiCallWithRetry(url);
        if (!response || !response.ok) {
            throw new Error(`Failed to fetch products: ${response?.status}`);
        }
        
        const products = await response.json();
        console.log('Products loaded:', products);
        
        const grid = document.getElementById('products-grid');
        if (!grid) {
            console.error('Products grid element not found');
            return;
        }
        
        if (products && products.length > 0) {
            grid.innerHTML = products.map(product => `
                <div class="product-card">
                    <img src="${product.image || 'https://via.placeholder.com/300x200'}" alt="${product.name}">
                    <h3>${product.name}</h3>
                    <p class="description">${product.description}</p>
                    <p class="brand">Brand: ${product.brand}</p>
                    <p class="price">$${product.price}</p>
                    <p class="stock">Stock: ${product.stock}</p>
                    <button onclick="addToCart('${product._id}')" 
                            class="btn-secondary" 
                            ${product.stock === 0 ? 'disabled' : ''}>
                        ${product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                    </button>
                </div>
            `).join('');
        } else {
            grid.innerHTML = '<p>No products found matching your criteria.</p>';
        }
    } catch (error) {
        console.error('Error loading products:', error);
        const grid = document.getElementById('products-grid');
        if (grid) {
            grid.innerHTML = '<p>Unable to load products. Please try again later.</p>';
        }
    }
}

// ADMIN FUNCTIONS - These are used by admin.html
async function loadAdminDashboard() {
    console.log('🔄 Loading admin dashboard...');
    if (currentUser?.role !== 'admin') {
        window.location.href = '/';
        return;
    }
    
    try {
        const response = await apiCallWithRetry('/api/admin/orders/stats');
        if (!response || !response.ok) {
            throw new Error('Failed to load admin stats');
        }
        
        const stats = await response.json();
        
        const adminContent = document.getElementById('admin-content');
        if (adminContent) {
            adminContent.innerHTML = `
                <h2>📊 Dashboard Overview</h2>
                <div class="stats-grid">
                    <div class="stat-card">
                        <h3>${stats.totalOrders || 0}</h3>
                        <p>Total Orders</p>
                    </div>
                    <div class="stat-card">
                        <h3>$${(stats.totalRevenue || 0).toFixed(2)}</h3>
                        <p>Total Revenue</p>
                    </div>
                    <div class="stat-card">
                        <h3>${getStatusCount(stats, 'pending')}</h3>
                        <p>Pending Orders</p>
                    </div>
                    <div class="stat-card">
                        <h3>${getStatusCount(stats, 'delivered')}</h3>
                        <p>Delivered Orders</p>
                    </div>
                </div>
                <h3>📈 Order Status Breakdown</h3>
                <div class="stats-grid">
                    ${(stats.statusStats || []).map(stat => `
                        <div class="stat-card">
                            <h3>${stat.count}</h3>
                            <p>${stat._id.charAt(0).toUpperCase() + stat._id.slice(1)}</p>
                        </div>
                    `).join('')}
                </div>
                <div style="margin-top: 40px; text-align: center;">
                    <button onclick="showAdminTab('products')" class="btn-primary" style="margin-right: 15px;">
                        📦 Manage Products
                    </button>
                    <button onclick="showAdminTab('orders')" class="btn-secondary">
                        📋 Manage Orders
                    </button>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading admin dashboard:', error);
        const adminContent = document.getElementById('admin-content');
        if (adminContent) {
            adminContent.innerHTML = `
                <div class="admin-error">
                    <h3>🚨 Dashboard Loading Error</h3>
                    <p>Unable to load dashboard statistics.</p>
                    <button onclick="loadAdminDashboard()" class="btn-primary">🔄 Retry</button>
                </div>
            `;
        }
    }
}

function getStatusCount(stats, status) {
    if (!stats.statusStats) return 0;
    const statusStat = stats.statusStats.find(s => s._id === status);
    return statusStat ? statusStat.count : 0;
}

async function loadAdminProducts() {
    console.log('🔄 Loading admin products...');
    try {
        const response = await apiCallWithRetry('/api/products');
        if (!response || !response.ok) {
            throw new Error('Failed to load products');
        }
        
        const products = await response.json();
        
        const adminContent = document.getElementById('admin-content');
        if (adminContent) {
            adminContent.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
                    <h2>📦 Products Management</h2>
                    <button onclick="showAddProductForm()" class="btn-primary">
                        ➕ Add New Product
                    </button>
                </div>
                
                <div id="product-form-container"></div>
                
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Image</th>
                                <th>Name</th>
                                <th>Category</th>
                                <th>Brand</th>
                                <th>Price</th>
                                <th>Stock</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${products.map(product => `
                                <tr>
                                    <td>
                                        <img src="${product.image || 'https://via.placeholder.com/60x60'}" 
                                             alt="${product.name}" 
                                             style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;">
                                    </td>
                                    <td><strong>${product.name}</strong></td>
                                    <td>${product.category}</td>
                                    <td>${product.brand}</td>
                                    <td><strong>$${product.price}</strong></td>
                                    <td>
                                        <span style="color: ${product.stock > 10 ? '#059669' : product.stock > 0 ? '#f59e0b' : '#dc2626'}">
                                            ${product.stock}
                                        </span>
                                    </td>
                                    <td>
                                        <div class="action-buttons">
                                            <button onclick="editProduct('${product._id}')" class="btn-small btn-edit">
                                                ✏️ Edit
                                            </button>
                                            <button onclick="deleteProduct('${product._id}')" class="btn-small btn-delete">
                                                🗑️ Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading admin products:', error);
        const adminContent = document.getElementById('admin-content');
        if (adminContent) {
            adminContent.innerHTML = `
                <div class="admin-error">
                    <h3>🚨 Products Loading Error</h3>
                    <p>Unable to load products for management.</p>
                    <button onclick="loadAdminProducts()" class="btn-primary">🔄 Retry</button>
                </div>
            `;
        }
    }
}

function showAddProductForm() {
    const container = document.getElementById('product-form-container');
    if (container) {
        container.innerHTML = `
            <div class="product-form">
                <h3>➕ Add New Product</h3>
                <form onsubmit="submitProductForm(event)" id="product-form">
                    <div class="form-grid">
                        <div class="form-group">
                            <label>Product Name *</label>
                            <input type="text" id="product-name" required 
                                   placeholder="Enter product name">
                        </div>
                        <div class="form-group">
                            <label>Price *</label>
                            <input type="number" id="product-price" step="0.01" required 
                                   placeholder="0.00" min="0">
                        </div>
                        <div class="form-group">
                            <label>Category *</label>
                            <input type="text" id="product-category" required 
                                   placeholder="e.g., Electronics, Clothing">
                        </div>
                        <div class="form-group">
                            <label>Brand *</label>
                            <input type="text" id="product-brand" required 
                                   placeholder="Enter brand name">
                        </div>
                        <div class="form-group">
                            <label>Stock Quantity *</label>
                            <input type="number" id="product-stock" required min="0" 
                                   placeholder="Available quantity">
                        </div>
                        <div class="form-group">
                            <label>Image URL</label>
                            <input type="url" id="product-image" 
                                   placeholder="https://example.com/image.jpg">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Description *</label>
                        <textarea id="product-description" required rows="4" 
                                  placeholder="Detailed product description..."></textarea>
                    </div>
                    <div style="display: flex; gap: 15px; margin-top: 30px;">
                        <button type="submit" class="btn-primary">
                            💾 Add Product
                        </button>
                        <button type="button" onclick="hideProductForm()" class="btn-secondary">
                            ❌ Cancel
                        </button>
                    </div>
                </form>
            </div>
        `;
        container.scrollIntoView({ behavior: 'smooth' });
    }
}

function hideProductForm() {
    const formContainer = document.getElementById('product-form-container');
    if (formContainer) {
        formContainer.innerHTML = '';
    }
}

async function submitProductForm(event) {
    event.preventDefault();
    
    const productData = {
        name: document.getElementById('product-name').value.trim(),
        description: document.getElementById('product-description').value.trim(),
        price: parseFloat(document.getElementById('product-price').value),
        category: document.getElementById('product-category').value.trim(),
        brand: document.getElementById('product-brand').value.trim(),
        stock: parseInt(document.getElementById('product-stock').value),
        image: document.getElementById('product-image').value.trim() || 
               'https://via.placeholder.com/300x200?text=Product+Image'
    };
    
    try {
        const response = await apiCallWithRetry('/api/products', {
            method: 'POST',
            body: JSON.stringify(productData)
        });
        
        if (response && response.ok) {
            showToast('Product added successfully!', 'success');
            hideProductForm();
            loadAdminProducts();
        } else {
            const error = await response.json();
            await customAlert(
                error.error || 'Failed to add product.',
                'error',
                '❌ Add Product Failed'
            );
        }
    } catch (error) {
        await customAlert(
            'An error occurred while adding the product.',
            'error',
            '❌ Error'
        );
    }
}

async function deleteProduct(productId) {
    const shouldDelete = await customConfirm(
        'Are you sure you want to delete this product? This action cannot be undone.',
        'Delete Product',
        'Yes, Delete',
        'Cancel'
    );
    
    if (!shouldDelete) return;
    
    try {
        const response = await apiCallWithRetry(`/api/products/${productId}`, {
            method: 'DELETE'
        });
        
        if (response && response.ok) {
            showToast('Product deleted successfully!', 'success');
            loadAdminProducts();
        } else {
            const error = await response.json();
            await customAlert(
                error.error || 'Failed to delete product.',
                'error',
                '❌ Delete Failed'
            );
        }
    } catch (error) {
        await customAlert(
            'An error occurred while deleting the product.',
            'error',
            '❌ Error'
        );
    }
}

async function loadAdminOrders() {
    console.log('🔄 Loading admin orders...');
    try {
        const response = await apiCallWithRetry('/api/admin/orders');
        if (!response || !response.ok) {
            throw new Error('Failed to load admin orders');
        }
        
        const data = await response.json();
        const orders = data.orders || [];
        
        const adminContent = document.getElementById('admin-content');
        if (adminContent) {
            adminContent.innerHTML = `
                <h2>📋 Orders Management</h2>
                
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Order ID</th>
                                <th>Date</th>
                                <th>Customer</th>
                                <th>Items</th>
                                <th>Total</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${orders.map(order => `
                                <tr>
                                    <td><strong>#${order._id.slice(-8)}</strong></td>
                                    <td>${new Date(order.orderDate).toLocaleDateString()}</td>
                                    <td>${order.userId?.email || order.userId?.username || 'Unknown'}</td>
                                    <td>${order.items.length} item(s)</td>
                                    <td><strong>$${order.totalAmount.toFixed(2)}</strong></td>
                                    <td>
                                        <span class="order-status ${order.status}" style="
                                            padding: 5px 10px; 
                                            border-radius: 20px; 
                                            font-size: 12px; 
                                            font-weight: bold;
                                            text-transform: uppercase;
                                            ${getStatusColor(order.status)}
                                        ">
                                            ${order.status}
                                        </span>
                                    </td>
                                    <td>
                                        <select onchange="updateOrderStatus('${order._id}', this.value)" 
                                                style="padding: 8px; border-radius: 6px; border: 2px solid #e5e7eb;">
                                            <option value="">Change Status</option>
                                            <option value="confirmed">Confirmed</option>
                                            <option value="processing">Processing</option>
                                            <option value="shipped">Shipped</option>
                                            <option value="delivered">Delivered</option>
                                            <option value="cancelled">Cancelled</option>
                                        </select>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                ${orders.length === 0 ? 
                    '<div style="text-align: center; margin-top: 50px; color: #64748b;"><p>No orders found.</p></div>' : 
                    ''
                }
            `;
        }
    } catch (error) {
        console.error('Error loading admin orders:', error);
        const adminContent = document.getElementById('admin-content');
        if (adminContent) {
            adminContent.innerHTML = `
                <div class="admin-error">
                    <h3>🚨 Orders Loading Error</h3>
                    <p>Unable to load orders for management.</p>
                    <button onclick="loadAdminOrders()" class="btn-primary">🔄 Retry</button>
                </div>
            `;
        }
    }
}

function getStatusColor(status) {
    const colors = {
        'pending': 'background: #fef3c7; color: #92400e;',
        'confirmed': 'background: #dbeafe; color: #1e40af;',
        'processing': 'background: #f3e8ff; color: #7c3aed;',
        'shipped': 'background: #ecfdf5; color: #059669;',
        'delivered': 'background: #d1fae5; color: #065f46;',
        'cancelled': 'background: #fee2e2; color: #dc2626;'
    };
    return colors[status] || 'background: #f1f5f9; color: #64748b;';
}

async function updateOrderStatus(orderId, newStatus) {
    if (!newStatus) return;
    
    const confirmed = await customConfirm(
        `Are you sure you want to change this order status to "${newStatus.toUpperCase()}"?`,
        'Update Order Status',
        'Yes, Update',
        'Cancel'
    );
    
    if (!confirmed) {
        event.target.value = '';
        return;
    }
    
    try {
        const response = await apiCallWithRetry(`/api/orders/${orderId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: newStatus })
        });
        
        if (response && response.ok) {
            showToast('Order status updated successfully!', 'success');
            loadAdminOrders();
        } else {
            const error = await response.json();
            await customAlert(
                error.error || 'Failed to update order status.',
                'error',
                '❌ Update Failed'
            );
            event.target.value = '';
        }
    } catch (error) {
        await customAlert(
            'An error occurred while updating the order status.',
            'error',
            '❌ Error'
        );
        event.target.value = '';
    }
}

// SINGLE DOMContentLoaded EVENT LISTENER
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 App initializing...');
    
    // Initialize auth and cart
    checkAuth();
    updateCartCount();
    
    // Initialize event handlers with robust delegation
    initializeEventHandlers();
    
    // Initialize page-specific content
    initializePageContent();
});

function initializeEventHandlers() {
    console.log('📋 Setting up event handlers...');
    
    // Universal form submission handler
    document.addEventListener('submit', function(e) {
        console.log('📝 Form submitted:', e.target.id);
        
        // Handle login form
        if (e.target.id === 'login-form') {
            e.preventDefault();
            handleLogin(e.target);
        }
        
        // Handle register form  
        if (e.target.id === 'register-form') {
            e.preventDefault();
            handleRegister(e.target);
        }
        
        // Handle checkout form
        if (e.target.id === 'checkout-form') {
            e.preventDefault();
            processCheckout();
        }
    });
    
    // Universal click handler for buttons
    document.addEventListener('click', function(e) {
        // Login button clicks
        if (e.target.classList.contains('login-btn') || e.target.id === 'login-btn') {
            e.preventDefault();
            console.log('🔐 Login button clicked');
            
            const form = e.target.closest('form') || document.getElementById('login-form');
            if (form) {
                handleLogin(form);
            } else {
                console.error('❌ Login form not found');
                customAlert('Login form not found. Please refresh the page.', 'error');
            }
        }
        
        // Register button clicks
        if (e.target.classList.contains('register-btn') || e.target.id === 'register-btn') {
            e.preventDefault();
            console.log('📝 Register button clicked');
            
            const form = e.target.closest('form') || document.getElementById('register-form');
            if (form) {
                handleRegister(form);
            } else {
                console.error('❌ Register form not found');
                customAlert('Register form not found. Please refresh the page.', 'error');
            }
        }
        
        // Logout button clicks
        if (e.target.classList.contains('logout-btn') || e.target.id === 'logout-btn') {
            e.preventDefault();
            console.log('🚪 Logout button clicked');
            logout();
        }
    });
    
    // Payment method toggle
    document.addEventListener('change', (e) => {
        if (e.target.name === 'payment-method') {
            const cardDetails = document.getElementById('card-details');
            if (cardDetails) {
                const isCard = e.target.value === 'credit_card' || e.target.value === 'debit_card';
                cardDetails.style.display = isCard ? 'block' : 'none';
            }
        }
    });
    
    // Card number formatting
    document.addEventListener('input', (e) => {
        if (e.target.id === 'card-number') {
            let value = e.target.value.replace(/\s/g, '').replace(/[^0-9]/gi, '');
            let matches = value.match(/\d{4,16}/g);
            let match = matches && matches[0] || '';
            let parts = [];
            for (let i = 0, len = match.length; i < len; i += 4) {
                parts.push(match.substring(i, i + 4));
            }
            if (parts.length) {
                e.target.value = parts.join(' ');
            } else {
                e.target.value = value;
            }
        }
        
        if (e.target.id === 'expiry') {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length >= 2) {
                value = value.substring(0, 2) + '/' + value.substring(2, 4);
            }
            e.target.value = value;
        }
        
        if (e.target.id === 'cvv') {
            e.target.value = e.target.value.replace(/\D/g, '');
        }
    });
    
    // Checkout form submission
    document.addEventListener('submit', (e) => {
        if (e.target.id === 'checkout-form') {
            e.preventDefault();
            processCheckout();
        }
    });
    
    // Close modal when clicking outside
    document.addEventListener('click', (e) => {
        const modal = document.getElementById('checkout-modal');
        if (e.target === modal) {
            closeCheckoutModal();
        }
    });
    
    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeCheckoutModal();
        }
    });
    
    console.log('✅ Event handlers initialized');
}

async function handleLogin(form) {
    console.log('🔐 Processing login...');
    
    try {
        const emailInput = form.querySelector('input[name="email"]') || 
                          form.querySelector('input[type="email"]') || 
                          form.querySelector('#login-email') ||
                          form.querySelector('#email');
                          
        const passwordInput = form.querySelector('input[name="password"]') || 
                             form.querySelector('input[type="password"]') || 
                             form.querySelector('#login-password') ||
                             form.querySelector('#password');
        
        if (!emailInput || !passwordInput) {
            console.error('❌ Login form inputs not found');
            throw new Error('Login form inputs not found. Please refresh the page.');
        }
        
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        
        if (!email || !password) {
            throw new Error('Please enter both email and password.');
        }
        
        // Disable submit button
        const submitBtn = form.querySelector('button[type="submit"]') || form.querySelector('.login-btn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Logging in...';
        }
        
        // Attempt login
        await login(email, password);
        
    } catch (error) {
        console.error('❌ Login error:', error);
        await customAlert(error.message || 'Login failed. Please try again.', 'error');
        
        // Re-enable submit button
        const submitBtn = form.querySelector('button[type="submit"]') || form.querySelector('.login-btn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Login';
        }
    }
}

async function handleRegister(form) {
    console.log('📝 Processing registration...');
    
    try {
        const usernameInput = form.querySelector('input[name="username"]') || 
                             form.querySelector('#register-username') ||
                             form.querySelector('#username');
                             
        const emailInput = form.querySelector('input[name="email"]') || 
                          form.querySelector('input[type="email"]') || 
                          form.querySelector('#register-email') ||
                          form.querySelector('#email');
                          
        const passwordInput = form.querySelector('input[name="password"]') || 
                             form.querySelector('input[type="password"]') || 
                             form.querySelector('#register-password') ||
                             form.querySelector('#password');
        
        if (!usernameInput || !emailInput || !passwordInput) {
            console.error('❌ Register form inputs not found');
            throw new Error('Registration form inputs not found. Please refresh the page.');
        }
        
        const username = usernameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        
        if (!username || !email || !password) {
            throw new Error('Please fill in all fields.');
        }
        
        // Disable submit button
        const submitBtn = form.querySelector('button[type="submit"]') || form.querySelector('.register-btn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Registering...';
        }
        
        // Attempt registration
        await register(username, email, password);
        
    } catch (error) {
        console.error('❌ Registration error:', error);
        await customAlert(error.message || 'Registration failed. Please try again.', 'error');
        
        // Re-enable submit button
        const submitBtn = form.querySelector('button[type="submit"]') || form.querySelector('.register-btn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Register';
        }
    }
}

function initializePageContent() {
    const currentPath = window.location.pathname;
    console.log('🌐 Current path:', currentPath);
    
    // Initialize page-specific content
    switch (currentPath) {
        case '/':
        case '/index.html':
            if (document.getElementById('featured-products-grid')) {
                console.log('🏠 Loading home page content...');
                loadFeaturedProducts();
            }
            break;
        case '/products':
        case '/products.html':
            if (document.getElementById('products-grid')) {
                console.log('🛍️ Loading products page...');
                loadProducts();
                loadFilters();
            }
            break;
        case '/cart':
        case '/cart.html':
            if (document.getElementById('cart-items')) {
                console.log('🛒 Loading cart page...');
                loadCartItems();
            }
            break;
        case '/orders':
        case '/orders.html':
            if (document.getElementById('orders-container')) {
                console.log('📦 Loading orders page...');
                loadOrders();
            }
            break;
        case '/login':
        case '/login.html':
            console.log('🔐 Login page detected');
            break;
    }
}

console.log('✅ Enhanced app.js loaded successfully');