// frontend/public/app.js
const API_BASE = '';
let currentUser = null;
let cart = JSON.parse(localStorage.getItem('cart') || '[]');

// Authentication functions
async function login(email, password) {
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
}

async function register(username, email, password) {
    const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    
    alert('Registration successful! Please login.');
    window.location.reload();
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('cart');
    currentUser = null;
    cart = [];
    window.location