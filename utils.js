// DOM Safety Utilities
export function safeGetElement(id) {
    try {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`Element with id '${id}' not found`);
        }
        return element;
    } catch (error) {
        console.error(`Error getting element '${id}':`, error);
        return null;
    }
}

export function safeQuerySelector(selector) {
    try {
        return document.querySelector(selector);
    } catch (error) {
        console.error(`Error querying selector '${selector}':`, error);
        return null;
    }
}

export function validateElement(element, elementName = 'Element') {
    if (!element) {
        console.warn(`${elementName} is null or undefined`);
        return false;
    }
    return true;
}

// Smooth scrolling for anchor links
export function initSmoothScrolling() {
    try {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                const href = this.getAttribute('href');
                if (href !== '#' && href.length > 1) {
                    e.preventDefault();
                    const target = safeQuerySelector(href);
                    if (target) {
                        const offset = 80;
                        const targetPosition = target.offsetTop - offset;
                        window.scrollTo({
                            top: targetPosition,
                            behavior: 'smooth'
                        });
                    }
                }
            });
        });
    } catch (error) {
        console.error('Error initializing smooth scrolling:', error);
    }
}

// Show notification with error handling
export function showNotification(message, type = 'info') {
    try {
        if (!message) {
            console.warn('showNotification called with empty message');
            return;
        }

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = String(message);

        document.body.appendChild(notification);

        setTimeout(() => notification.classList.add('show'), 10);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                try {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                } catch (e) {
                    console.error('Error removing notification:', e);
                }
            }, 300);
        }, 3000);
    } catch (error) {
        console.error('Error showing notification:', error);
    }
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
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

// Escape HTML
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function generateId(prefix = 'id') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// Validation Utilities
export function validateFile(file, maxSize = 50 * 1024 * 1024, allowedTypes = []) {
    if (!file || !(file instanceof File)) {
        return { valid: false, error: 'Invalid file object' };
    }

    if (maxSize && file.size > maxSize) {
        return { valid: false, error: `File size exceeds ${formatFileSize(maxSize)}` };
    }

    if (allowedTypes.length > 0) {
        const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        const isValidType = allowedTypes.some(type => 
            file.type === type || fileExt === type || file.name.toLowerCase().endsWith(type)
        );
        if (!isValidType) {
            return { valid: false, error: 'Invalid file type' };
        }
    }

    return { valid: true };
}

export function validateEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email.trim());
}

export function validateYear(year) {
    const yearNum = parseInt(year);
    return !isNaN(yearNum) && yearNum >= 1900 && yearNum <= 2100;
}

export function sanitizeFileName(fileName) {
    if (!fileName || typeof fileName !== 'string') return 'file';
    return fileName.replace(/[<>:"/\\|?*]/g, '_').substring(0, 255);
}

// SessionStorage Safety
export function safeSessionStorageGet(key) {
    try {
        if (typeof sessionStorage === 'undefined') return null;
        const item = sessionStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch (error) {
        console.error(`Error reading from sessionStorage (${key}):`, error);
        return null;
    }
}

export function safeSessionStorageSet(key, value) {
    try {
        if (typeof sessionStorage === 'undefined') return false;
        sessionStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        if (error.name === 'QuotaExceededError') {
            console.error('SessionStorage quota exceeded');
            showNotification('Storage limit reached. Please clear old data.', 'warning');
        } else {
            console.error(`Error writing to sessionStorage (${key}):`, error);
        }
        return false;
    }
}

export function safeSessionStorageRemove(key) {
    try {
        if (typeof sessionStorage === 'undefined') return;
        sessionStorage.removeItem(key);
    } catch (error) {
        console.error(`Error removing from sessionStorage (${key}):`, error);
    }
}

// Fetch with timeout and retry
export async function fetchWithTimeout(url, options = {}, timeout = 30000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Request timeout');
        }
        throw error;
    }
}

export async function fetchWithRetry(url, options = {}, maxRetries = 3, timeout = 30000) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetchWithTimeout(url, options, timeout);
            
            if (response.status === 429) {
                const retryAfter = parseInt(response.headers.get('Retry-After') || '2');
                await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                continue;
            }
            
            return response;
        } catch (error) {
            lastError = error;
            if (i < maxRetries - 1) {
                const delay = Math.pow(2, i) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError || new Error('Max retries exceeded');
}

// Error Handler
export function handleError(error, context = '', showToUser = true) {
    const errorMessage = error?.message || 'An unexpected error occurred';
    console.error(`Error in ${context}:`, error);
    
    if (showToUser) {
        const userMessage = getFriendlyErrorMessage(errorMessage);
        showNotification(userMessage, 'error');
    }
    
    return errorMessage;
}

function getFriendlyErrorMessage(error) {
    const errorStr = String(error).toLowerCase();
    
    if (errorStr.includes('network') || errorStr.includes('fetch')) {
        return 'Network error. Please check your connection.';
    }
    if (errorStr.includes('timeout')) {
        return 'Request timed out. Please try again.';
    }
    if (errorStr.includes('quota')) {
        return 'Storage limit reached. Please clear some data.';
    }
    if (errorStr.includes('file')) {
        return 'Error processing file. Please check the file format.';
    }
    
    return 'An error occurred. Please try again.';
}

