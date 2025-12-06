// Mock Data for initial testing
const MOCK_MENU = [
    { id: 1, name: 'חומוס', price: 25, description: 'חומוס ביתי מעולה', category: 'תוספות', image: 'hummus.png', inStock: true },
    { id: 2, name: 'פלאפל', price: 15, description: 'כדורי פלאפל פריכים', category: 'תוספות', image: 'falafel.png', inStock: false },
    { id: 3, name: 'סלט קצוץ', price: 20, description: 'ירקות טריים', category: 'ירקות', image: 'salad.png', inStock: true },
    { id: 4, name: 'קולה', price: 8, description: 'קר', category: 'שתייה', image: 'https://drive.google.com/file/d/1zUbI2wZ_pJ2EANSiIEGb4VaOzj1oEZ-L/view?usp=drive_link', inStock: true },
    { id: 5, name: 'טוסט', price: 15, description: 'טוסט גבינה צהובה', category: 'מאפים', image: 'https://placehold.co/150?text=Toast', inStock: true }
];

// State
let cart = [];
let menuItems = [];
let activeCategory = 'all';
let bitLink = '';

// DOM Elements
const menuContainer = document.getElementById('menu-container');
const cartBtn = document.getElementById('cart-btn');
const cartCount = document.getElementById('cart-count');
const cartModal = document.getElementById('cart-modal');
const closeModal = document.querySelector('.close-btn');
const cartItemsContainer = document.getElementById('cart-items');
const totalPriceEl = document.getElementById('total-price');
const orderForm = document.getElementById('order-form');

// Configuration
const API_URL = 'https://script.google.com/macros/s/AKfycbx7hfgjMYZn5L5q1DpHfJOZVQQAla7ngPe8qtFtWJNGWTOhAkV7p2Av-VYvwP86IJ3v/exec'
const USE_MOCK_DATA = false; // Set to false to use the real API

// Initialize
async function init() {
    if (USE_MOCK_DATA || !API_URL) {
        console.log('Using Mock Data');
        menuItems = MOCK_MENU;
    } else {
        console.log('Fetching from API...');
        try {
            await fetchMenu();
        } catch (error) {
            console.error('Failed to fetch menu:', error);
            alert('שגיאה בטעינת התפריט. מציג נתונים לדוגמה.');
            menuItems = MOCK_MENU;
        }
    }
    renderMenu();
    updateCartUI();
    setupEventListeners();
}

async function fetchMenu() {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();

    // Convert new structure or fallback to old array if needed
    if (Array.isArray(data)) {
        menuItems = data;
    } else {
        menuItems = data.menu;
        bitLink = data.settings?.bitLink || '';
    }
}

async function sendOrderToAPI(orderData) {
    // Google Apps Script requires 'no-cors' mode or specific handling for POST from web
    // However, 'no-cors' makes the response opaque. 
    // Standard fetch usually works if the GAS script handles OPTIONS/CORS correctly, 
    // but GAS is tricky. We often use 'application/x-www-form-urlencoded' or text/plain 
    // to avoid preflight checks if possible, or just standard JSON with redirect: follow.

    // We use text/plain to avoid CORS preflight (OPTIONS request) which GAS doesn't handle.
    // This allows us to NOT use 'no-cors' mode, so we can actually read the response.
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain',
        },
        body: JSON.stringify(orderData)
    });

    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
}

function renderMenu() {
    const filteredItems = activeCategory === 'all'
        ? menuItems
        : menuItems.filter(item => item.category === activeCategory);

    menuContainer.innerHTML = filteredItems.map(item => {
        const outOfStock = item.inStock === false;
        const imageUrl = getImageUrl(item.image);
        return `
        <div class="menu-item ${outOfStock ? 'out-of-stock' : ''}">
            <div class="item-image" style="background-image: url('${imageUrl}')">
            </div>
            <div class="item-content">
                <h3>${item.name}</h3>
                <p>${item.description}</p>
                <div class="price">₪${item.price}</div>
                <button class="btn-add" 
                    onclick="addToCart(${item.id})" 
                    ${outOfStock ? 'disabled' : ''}>
                    ${outOfStock ? 'אזל מהמלאי' : 'הוסף להזמנה'}
                </button>
            </div>
        </div>
    `}).join('');
}

function getImageUrl(url) {
    if (!url) return 'https://placehold.co/150?text=No+Image';

    // Handle Google Drive "View" links
    // Convert https://drive.google.com/file/d/ID/view... to https://drive.google.com/uc?export=view&id=ID
    if (url.includes('drive.google.com') && url.includes('/view')) {
        const idMatch = url.match(/\/d\/(.*?)\//);
        if (idMatch && idMatch[1]) {
            // Use thumbnail endpoint for better embedding reliability (avoiding 403s)
            return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w800`;
        }
    }
    return url;
}

function addToCart(id) {
    const item = menuItems.find(i => i.id === id);
    const existing = cart.find(i => i.id === id);

    if (existing) {
        existing.quantity++;
    } else {
        cart.push({ ...item, quantity: 1 });
    }

    updateCartUI();
}

function updateCartUI() {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = count;

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    totalPriceEl.textContent = total;

    cartItemsContainer.innerHTML = cart.map(item => `
        <div class="cart-item">
            <div class="cart-item-info">
                <span>${item.name} x${item.quantity}</span>
                <span class="cart-item-price">₪${item.price * item.quantity}</span>
            </div>
            <button class="btn-remove" onclick="removeFromCart(${item.id})">הסר</button>
        </div>
    `).join('');

    // Disable submit button if cart is empty
    const submitBtn = orderForm.querySelector('button[type="submit"]');
    if (cart.length === 0) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'העגלה ריקה';
        submitBtn.style.cursor = 'not-allowed';
    } else {
        submitBtn.disabled = false;
        submitBtn.textContent = 'בצע הזמנה';
        submitBtn.style.cursor = 'pointer';
    }
}

function removeFromCart(id) {
    const itemIndex = cart.findIndex(i => i.id === id);
    if (itemIndex > -1) {
        cart[itemIndex].quantity--;
        if (cart[itemIndex].quantity === 0) {
            cart.splice(itemIndex, 1);
        }
        updateCartUI();
    }
}

function setupEventListeners() {
    cartBtn.addEventListener('click', () => {
        updateCartUI(); // Ensure fresh state on open
        cartModal.classList.remove('hidden');
    });

    closeModal.addEventListener('click', () => {
        cartModal.classList.add('hidden');
    });

    orderForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleOrderSubmit();
    });

    // Close modal if clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === cartModal) {
            cartModal.classList.add('hidden');
        }
    });

    // Category Filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Update Active Class
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            // Update State
            activeCategory = e.target.dataset.category;
            renderMenu();
        });
    });
}

async function handleOrderSubmit() {
    if (cart.length === 0) {
        alert('העגלה ריקה! אנא הוסף פריטים להזמנה.');
        return;
    }
    const submitBtn = orderForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'שולח...';
    submitBtn.disabled = true;

    const formData = {
        name: document.getElementById('name').value,
        lastname: document.getElementById('lastname').value,
        classNum: document.getElementById('class-num').value,
        payment: document.querySelector('input[name="payment"]:checked').value,
        items: cart,
        total: parseFloat(totalPriceEl.textContent)
    };

    try {
        if (!USE_MOCK_DATA && API_URL) {
            await sendOrderToAPI(formData);
        } else {
            console.log('Mock Order Submitted:', formData);
            await new Promise(r => setTimeout(r, 1000)); // Simulate delay
        }

        if (formData.payment === 'bit') {
            if (bitLink) {
                alert('הזמנה התקבלה! מעביר לתשלום ב-Bit...');
                window.open(bitLink, '_blank');
            } else {
                alert('הזמנה התקבלה! אנא בצע תשלום ב-Bit לפי ההנחיות.');
            }
        } else {
            alert('הזמנה התקבלה! תשלום במזומן.');
        }

        // Reset
        cart = [];
        updateCartUI();
        cartModal.classList.add('hidden');
        orderForm.reset();
    } catch (error) {
        console.error(error);
        alert('שגיאה בשליחת ההזמנה. אנא נסה שנית.');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// Global scope for onclick handlers
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;

init();
