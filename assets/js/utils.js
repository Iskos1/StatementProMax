// DOM Safety Utilities
export function safeGetElement(id) {
    return document.getElementById(id) || null;
}

function safeQuerySelector(selector) {
    try {
        return document.querySelector(selector);
    } catch (error) {
        return null;
    }
}

// Smooth scrolling for anchor links
export function initSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href !== '#' && href.length > 1) {
                e.preventDefault();
                const target = safeQuerySelector(href);
                if (target) {
                    window.scrollTo({
                        top: target.offsetTop - 80,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });
}

// Show notification
export function showNotification(message, type = 'info') {
    if (!message) return;
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = String(message);
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Format file size
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Format currency
export function formatCurrency(amount, showDecimals = true) {
    const abs = Math.abs(amount);
    return showDecimals 
        ? `$${abs.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`
        : `$${Math.round(abs).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

// Format date
export function formatDate(date) {
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Escape HTML
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Generate unique ID
export function generateId(prefix = 'id') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// Email validation
export function validateEmail(email) {
    if (!email || typeof email !== 'string') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// SessionStorage utilities
export function safeSessionStorageGet(key) {
    try {
        const item = sessionStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch {
        return null;
    }
}

export function safeSessionStorageSet(key, value) {
    try {
        sessionStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
}

export function safeSessionStorageRemove(key) {
    try {
        sessionStorage.removeItem(key);
    } catch {}
}

// Error Handler
export function handleError(error, context = '', showToUser = true) {
    const errorMessage = error?.message || 'An unexpected error occurred';
    if (showToUser) {
        showNotification(getFriendlyErrorMessage(errorMessage), 'error');
    }
    return errorMessage;
}

function getFriendlyErrorMessage(error) {
    const errorStr = String(error).toLowerCase();
    if (errorStr.includes('network') || errorStr.includes('fetch')) return 'Network error. Please check your connection.';
    if (errorStr.includes('timeout')) return 'Request timed out. Please try again.';
    if (errorStr.includes('quota')) return 'Storage limit reached. Please clear some data.';
    if (errorStr.includes('file')) return 'Error processing file. Please check the file format.';
    return 'An error occurred. Please try again.';
}
