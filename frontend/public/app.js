// frontend/public/app.js - COMPLETE FIXED VERSION
const API_BASE = '';
let currentUser = null;
let cart = JSON.parse(localStorage.getItem('cart') || '[]');

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
        
        window.location.href = '/';
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
        
        alert('Registration successful! Please login.');
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
    window.location.href = '/';
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
function addToCart(productId) {
    if (!currentUser) {
        alert('Please login to add items to cart');
        window.location.href = '/login';
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
    alert('Item added to cart!');
}

function updateCartCount() {
    const cartCount = document.getElementById('cart-count');
    if (cartCount) {
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartCount.textContent = totalItems;
    }
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.productId !== productId);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    if (window.location.pathname === '/cart') {
        loadCartItems();
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

// Enhanced product loading with better error handling
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
                        <p class="cart-item-price">$${product.price}</p>
                        <div class="quantity-controls">
                            <button onclick="updateCartQuantity('${product._id}', ${item.quantity - 1})">-</button>
                            <input type="number" value="${item.quantity}" 
                                   onchange="updateCartQuantity('${product._id}', this.value)"
                                   min="1" max="${product.stock}">
                            <button onclick="updateCartQuantity('${product._id}', ${item.quantity + 1})">+</button>
                        </div>
                        <p>Subtotal: $${itemTotal.toFixed(2)}</p>
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
            <div class="cart-total">Total: $${total.toFixed(2)}</div>
            <button onclick="proceedToCheckout()" class="btn-primary" style="width: 100%;">
                Proceed to Checkout
            </button>
        `;
    }
}

function proceedToCheckout() {
    if (!currentUser) {
        alert('Please login to checkout');
        window.location.href = '/login';
        return;
    }
    
    const address = prompt('Enter shipping address:');
    if (!address) return;
    
    const paymentMethod = prompt('Enter payment method (credit_card, debit_card, paypal, cash_on_delivery):');
    if (!paymentMethod) return;
    
    checkout(address, paymentMethod);
}

async function checkout(address, paymentMethod) {
    try {
        const orderItems = cart.map(item => ({
            productId: item.productId,
            quantity: item.quantity
        }));
        
        const response = await apiCallWithRetry('/api/orders', {
            method: 'POST',
            body: JSON.stringify({
                items: orderItems,
                shippingAddress: {
                    street: address,
                    city: 'Default City',
                    state: 'Default State',
                    zipCode: '12345',
                    country: 'Default Country'
                },
                paymentMethod
            })
        });
        
        if (response && response.ok) {
            cart = [];
            localStorage.setItem('cart', JSON.stringify(cart));
            updateCartCount();
            alert('Order placed successfully!');
            window.location.href = '/orders';
        } else {
            const error = await response.json();
            alert(error.error || 'Error placing order');
        }
    } catch (error) {
        alert('Error placing order: ' + error.message);
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
                        <p><strong>Total: $${order.totalAmount}</strong></p>
                    </div>
                </div>
                <div class="order-items">
                    ${order.items.map(item => `
                        <div class="order-item">
                            <img src="${item.image || 'https://via.placeholder.com/60x60'}" alt="${item.name}">
                            <div>
                                <h4>${item.name}</h4>
                                <p>Quantity: ${item.quantity}</p>
                                <p>Price: $${item.price}</p>
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
    }
}

async function cancelOrder(orderId) {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    
    try {
        const response = await apiCallWithRetry(`/api/orders/${orderId}/cancel`, {
            method: 'PATCH'
        });
        
        if (response && response.ok) {
            alert('Order cancelled successfully');
            loadOrders();
        } else {
            const error = await response.json();
            alert(error.error || 'Error cancelling order');
        }
    } catch (error) {
        alert('Error cancelling order: ' + error.message);
    }
}

// Admin functions
let currentAdminTab = 'dashboard';

function showAdminTab(tabName) {
    currentAdminTab = tabName;
    
    // Update tab buttons
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    const activeTab = document.querySelector(`[onclick="showAdminTab('${tabName}')"]`);
    if (activeTab) activeTab.classList.add('active');
    
    // Show appropriate content
    switch (tabName) {
        case 'dashboard':
            loadAdminDashboard();
            break;
        case 'products':
            loadAdminProducts();
            break;
        case 'orders':
            loadAdminOrders();
            break;
    }
}

async function loadAdminDashboard() {
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
                <h2>Dashboard</h2>
                <div class="stats-grid">
                    <div class="stat-card">
                        <h3>${stats.totalOrders}</h3>
                        <p>Total Orders</p>
                    </div>
                    <div class="stat-card">
                        <h3>$${stats.totalRevenue}</h3>
                        <p>Total Revenue</p>
                    </div>
                    <div class="stat-card">
                        <h3>${stats.statusStats.find(s => s._id === 'pending')?.count || 0}</h3>
                        <p>Pending Orders</p>
                    </div>
                    <div class="stat-card">
                        <h3>${stats.statusStats.find(s => s._id === 'delivered')?.count || 0}</h3>
                        <p>Delivered Orders</p>
                    </div>
                </div>
                <h3>Order Status Breakdown</h3>
                <div class="stats-grid">
                    ${stats.statusStats.map(stat => `
                        <div class="stat-card">
                            <h3>${stat.count}</h3>
                            <p>${stat._id.toUpperCase()}</p>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading admin dashboard:', error);
    }
}

async function loadAdminProducts() {
    try {
        const response = await apiCallWithRetry('/api/products');
        if (!response || !response.ok) {
            throw new Error('Failed to load products');
        }
        
        const products = await response.json();
        
        const adminContent = document.getElementById('admin-content');
        if (adminContent) {
            adminContent.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <h2>Products Management</h2>
                    <button onclick="showAddProductForm()" class="btn-primary">Add New Product</button>
                </div>
                <div id="product-form-container"></div>
                <div class="products-grid">
                    ${products.map(product => `
                        <div class="product-card">
                            <img src="${product.image || 'https://via.placeholder.com/300x200'}" alt="${product.name}">
                            <h3>${product.name}</h3>
                            <p class="price">$${product.price}</p>
                            <p class="stock">Stock: ${product.stock}</p>
                            <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                                <button onclick="editProduct('${product._id}')" class="btn-secondary">Edit</button>
                                <button onclick="deleteProduct('${product._id}')" class="btn-danger">Delete</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading admin products:', error);
    }
}

function showAddProductForm() {
    const formContainer = document.getElementById('product-form-container');
    if (formContainer) {
        formContainer.innerHTML = `
            <div style="background: white; padding: 2rem; border-radius: 12px; margin-bottom: 2rem; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                <h3>Add New Product</h3>
                <form onsubmit="submitProductForm(event)">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="form-group">
                            <label>Name</label>
                            <input type="text" id="product-name" required>
                        </div>
                        <div class="form-group">
                            <label>Price</label>
                            <input type="number" id="product-price" step="0.01" required>
                        </div>
                        <div class="form-group">
                            <label>Category</label>
                            <input type="text" id="product-category" required>
                        </div>
                        <div class="form-group">
                            <label>Brand</label>
                            <input type="text" id="product-brand" required>
                        </div>
                        <div class="form-group">
                            <label>Stock</label>
                            <input type="number" id="product-stock" required>
                        </div>
                        <div class="form-group">
                            <label>Image URL</label>
                            <input type="url" id="product-image">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea id="product-description" required></textarea>
                    </div>
                    <div style="display: flex; gap: 1rem;">
                        <button type="submit" class="btn-primary">Add Product</button>
                        <button type="button" onclick="hideProductForm()" class="btn-secondary">Cancel</button>
                    </div>
                </form>
            </div>
        `;
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
        name: document.getElementById('product-name').value,
        description: document.getElementById('product-description').value,
        price: parseFloat(document.getElementById('product-price').value),
        category: document.getElementById('product-category').value,
        brand: document.getElementById('product-brand').value,
        stock: parseInt(document.getElementById('product-stock').value),
        image: document.getElementById('product-image').value || 'https://via.placeholder.com/300x200'
    };
    
    try {
        const response = await apiCallWithRetry('/api/products', {
            method: 'POST',
            body: JSON.stringify(productData)
        });
        
        if (response && response.ok) {
            alert('Product added successfully!');
            hideProductForm();
            loadAdminProducts();
        } else {
            const error = await response.json();
            alert(error.error || 'Error adding product');
        }
    } catch (error) {
        alert('Error adding product: ' + error.message);
    }
}

async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    try {
        const response = await apiCallWithRetry(`/api/products/${productId}`, {
            method: 'DELETE'
        });
        
        if (response && response.ok) {
            alert('Product deleted successfully!');
            loadAdminProducts();
        } else {
            const error = await response.json();
            alert(error.error || 'Error deleting product');
        }
    } catch (error) {
        alert('Error deleting product: ' + error.message);
    }
}

async function loadAdminOrders() {
    try {
        const response = await apiCallWithRetry('/api/admin/orders');
        if (!response || !response.ok) {
            throw new Error('Failed to load admin orders');
        }
        
        const data = await response.json();
        
        const adminContent = document.getElementById('admin-content');
        if (adminContent) {
            adminContent.innerHTML = `
                <h2>Orders Management</h2>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Order ID</th>
                            <th>Date</th>
                            <th>Total</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.orders.map(order => `
                            <tr>
                                <td>#${order._id.substr(-8)}</td>
                                <td>${new Date(order.orderDate).toLocaleDateString()}</td>
                                <td>$${order.totalAmount}</td>
                                <td><span class="order-status ${order.status}">${order.status.toUpperCase()}</span></td>
                                <td>
                                    <select onchange="updateOrderStatus('${order._id}', this.value)">
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
            `;
        }
    } catch (error) {
        console.error('Error loading admin orders:', error);
    }
}

async function updateOrderStatus(orderId, status) {
    if (!status) return;
    
    try {
        const response = await apiCallWithRetry(`/api/orders/${orderId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
        
        if (response && response.ok) {
            alert('Order status updated successfully!');
            loadAdminOrders();
        } else {
            const error = await response.json();
            alert(error.error || 'Error updating order status');
        }
    } catch (error) {
        alert('Error updating order status: ' + error.message);
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize cart count on page load
document.addEventListener('DOMContentLoaded', () => {
    updateCartCount();
});