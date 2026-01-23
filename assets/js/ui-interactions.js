// UI/UX Enhancement Interactions - Performance Optimized
// Keyboard shortcuts, scroll progress, and other interactive improvements

// Utilities for Performance
const debounce = (fn, wait) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), wait);
    };
};

const throttle = (fn, wait) => {
    let inThrottle, lastFn, lastTime;
    return (...args) => {
        if (!inThrottle) {
            fn.apply(this, args);
            lastTime = Date.now();
            inThrottle = true;
        } else {
            clearTimeout(lastFn);
            lastFn = setTimeout(() => {
                if (Date.now() - lastTime >= wait) {
                    fn.apply(this, args);
                    lastTime = Date.now();
                }
            }, Math.max(wait - (Date.now() - lastTime), 0));
        }
    };
};

// Scroll Progress Indicator - Optimized with rAF
function initScrollProgress() {
    const scrollIndicatorBar = document.getElementById('scrollIndicatorBar');
    const mainNav = document.getElementById('mainNav');
    let ticking = false;
    
    // Cache dimensions to avoid layout thrashing
    let docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    
    // Update cached dimensions on resize
    window.addEventListener('resize', debounce(() => {
        docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    }, 100), { passive: true });

    function updateScrollProgress() {
        // Read layout properties (fastest if cached, but scrollPos needs to be fresh)
        const scrollPos = window.scrollY;
        const scrolled = (scrollPos / docHeight) * 100;
        
        // Write styles (batched via rAF)
        if (scrollIndicatorBar) {
            scrollIndicatorBar.style.transform = `scaleX(${scrolled / 100})`;
            scrollIndicatorBar.style.transformOrigin = 'left';
        }

        // Nav scroll effect
        if (mainNav) {
            if (scrollPos > 10) {
                if (!mainNav.classList.contains('scrolled')) {
                    mainNav.classList.add('scrolled');
                }
            } else {
                if (mainNav.classList.contains('scrolled')) {
                    mainNav.classList.remove('scrolled');
                }
            }
        }
        
        ticking = false;
    }

    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(updateScrollProgress);
            ticking = true;
        }
    }, { passive: true });
    
    // Initial call
    updateScrollProgress();
}

// Keyboard Shortcuts
function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + O: Open file browser
        if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
            e.preventDefault();
            const fileInput = document.getElementById('fileInput');
            if (fileInput) fileInput.click();
        }

        // Ctrl/Cmd + E: Export to Excel (dashboard only)
        if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
            e.preventDefault();
            const exportBtn = document.getElementById('exportToExcelBtn');
            if (exportBtn && exportBtn.style.display !== 'none') {
                exportBtn.click();
            }
        }

        // Ctrl/Cmd + U: Upload new files (dashboard only)
        if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
            e.preventDefault();
            const uploadNewBtn = document.getElementById('uploadNewBtn');
            if (uploadNewBtn && uploadNewBtn.style.display !== 'none') {
                uploadNewBtn.click();
            }
        }

        // Ctrl/Cmd + H: View history
        if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
            e.preventDefault();
            const historyBtn = document.getElementById('viewHistoryBtn') || document.getElementById('viewHistoryBtnHome');
            if (historyBtn) {
                historyBtn.click();
            }
        }

        // Escape: Close modals (except year-modal which has its own handler)
        if (e.key === 'Escape') {
            const modals = document.querySelectorAll('.modal.show, .auth-modal.show, .recategorize-modal.show, .learned-patterns-modal, .categorization-review-modal');
            modals.forEach(modal => {
                const closeBtn = modal.querySelector('[class*="close"]');
                if (closeBtn && modal.style.display !== 'none') {
                    closeBtn.click();
                }
            });
        }

        // ? or /: Show keyboard shortcuts help
        if (e.key === '?' || (e.key === '/' && !e.target.matches('input, textarea'))) {
            e.preventDefault();
            showKeyboardShortcutsHelp();
        }
    });
}

// Show Keyboard Shortcuts Help Modal
function showKeyboardShortcutsHelp() {
    const existingModal = document.getElementById('keyboardShortcutsModal');
    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'keyboardShortcutsModal';
    modal.className = 'auth-modal show';
    // Use DocumentFragment for cleaner insertion
    const content = `
        <div class="auth-modal-content" style="max-width: 600px; will-change: transform, opacity;">
            <button class="auth-modal-close" onclick="this.closest('.auth-modal').remove()">&times;</button>
            <div class="auth-modal-header">
                <h2>⌨️ Keyboard Shortcuts</h2>
                <p>Speed up your workflow with these handy shortcuts</p>
            </div>
            <div class="auth-modal-body">
                <div style="display: grid; gap: 16px;">
                    <div style="display: flex; justify-content: space-between; padding: 12px; background: #fafafa; border-radius: 8px;">
                        <span><strong>Open Files</strong></span>
                        <span class="kbd">Ctrl + O</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 12px; background: #fafafa; border-radius: 8px;">
                        <span><strong>Export to Excel</strong></span>
                        <span class="kbd">Ctrl + E</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 12px; background: #fafafa; border-radius: 8px;">
                        <span><strong>Upload New Files</strong></span>
                        <span class="kbd">Ctrl + U</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 12px; background: #fafafa; border-radius: 8px;">
                        <span><strong>View History</strong></span>
                        <span class="kbd">Ctrl + H</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 12px; background: #fafafa; border-radius: 8px;">
                        <span><strong>Close Modal</strong></span>
                        <span class="kbd">Esc</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 12px; background: #fafafa; border-radius: 8px;">
                        <span><strong>Show This Help</strong></span>
                        <span class="kbd">?</span>
                    </div>
                </div>
                <div class="callout callout-info" style="margin-top: 24px;">
                    <div class="callout-title">💡 Pro Tip</div>
                    <div>Hover over buttons to see available keyboard shortcuts!</div>
                </div>
            </div>
        </div>
    `;
    modal.innerHTML = content;

    document.body.appendChild(modal);

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Smart Loading States - Optimized
function showSmartLoader(message = 'Processing...') {
    const existingLoader = document.getElementById('smartLoader');
    if (existingLoader) return;

    const loader = document.createElement('div');
    loader.id = 'smartLoader';
    loader.className = 'loading-overlay';
    // Use requestAnimationFrame to ensure smooth paint
    requestAnimationFrame(() => {
        loader.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <p class="loading-text">${message}</p>
                <p class="loading-subtext">This may take a few moments...</p>
            </div>
        `;
        document.body.appendChild(loader);
    });
}

function hideSmartLoader() {
    const loader = document.getElementById('smartLoader');
    if (loader) {
        // Fade out transition before removing
        loader.style.opacity = '0';
        setTimeout(() => {
            if (loader.parentNode) loader.parentNode.removeChild(loader);
        }, 300); // Match CSS transition duration
    }
}

// Expose loader functions globally
window.showSmartLoader = showSmartLoader;
window.hideSmartLoader = hideSmartLoader;

// Enhanced File Drop Visual Feedback - Optimized
function initEnhancedDropZone() {
    const uploadAreas = document.querySelectorAll('#uploadArea');
    
    uploadAreas.forEach(area => {
        let dragCounter = 0;
        let isDragOver = false;

        // Throttled class toggling to prevent flickering/repaints
        const updateDragState = () => {
             if (dragCounter > 0 && !isDragOver) {
                 area.classList.add('drag-over');
                 isDragOver = true;
             } else if (dragCounter === 0 && isDragOver) {
                 area.classList.remove('drag-over');
                 isDragOver = false;
             }
        };

        area.addEventListener('dragenter', (e) => {
            e.preventDefault();
            dragCounter++;
            requestAnimationFrame(updateDragState);
        });

        area.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dragCounter--;
            requestAnimationFrame(updateDragState);
        });

        area.addEventListener('drop', () => {
            dragCounter = 0;
            requestAnimationFrame(updateDragState);
        });
    });
}

// Toast Notifications Enhancement
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `notification notification-${type}`;
    
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    
    toast.innerHTML = `
        <span style="font-size: 18px; margin-right: 8px;">${icons[type] || 'ℹ'}</span>
        <span>${message}</span>
    `;

    document.body.appendChild(toast);

    // Trigger reflow to enable transition
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Auto remove
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }, duration);

    // Click to dismiss
    toast.addEventListener('click', () => {
        toast.classList.remove('show');
        setTimeout(() => {
             if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    });
}

// Expose toast globally
window.showToast = showToast;

// Form Validation Visual Feedback
function enhanceFormValidation() {
    // Use event delegation instead of attaching to every input
    document.addEventListener('blur', (e) => {
        const input = e.target;
        if (input.matches('input, select, textarea') && input.form) {
             if (input.checkValidity()) {
                input.parentElement?.classList.add('success');
                input.parentElement?.classList.remove('error');
            } else if (input.value) {
                input.parentElement?.classList.add('error');
                input.parentElement?.classList.remove('success');
            }
        }
    }, true); // Use capture to ensure we catch blur events

    document.addEventListener('focus', (e) => {
        const input = e.target;
        if (input.matches('input, select, textarea')) {
            input.parentElement?.classList.remove('error', 'success');
        }
    }, true);
}

// Clipboard Copy with Feedback
function copyToClipboard(text, successMessage = 'Copied to clipboard!') {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast(successMessage, 'success', 2000);
        }).catch(err => {
            showToast('Failed to copy to clipboard', 'error');
        });
    } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showToast(successMessage, 'success', 2000);
        } catch (err) {
            showToast('Failed to copy to clipboard', 'error');
        }
        document.body.removeChild(textArea);
    }
}

// Expose clipboard function globally
window.copyToClipboard = copyToClipboard;

// Add "Copied!" feedback to copy buttons using delegation
function initCopyButtons() {
    document.addEventListener('click', (e) => {
        const button = e.target.closest('[data-copy]');
        if (button) {
            const textToCopy = button.getAttribute('data-copy');
            copyToClipboard(textToCopy);
        }
    });
}

// Mobile Menu Toggle
function initMobileMenu() {
    const toggle = document.getElementById('mobileMenuToggle');
    const navLinks = document.getElementById('navLinks');
    
    if (!toggle || !navLinks) return;
    
    // Internal Header Injection (Full-Screen Takeover)
    if (!navLinks.querySelector('.mobile-menu-header')) {
        const header = document.createElement('div');
        header.className = 'mobile-menu-header';
        
        // Clone Logo
        const originalLogoLink = document.querySelector('.logo-link');
        if (originalLogoLink) {
            const logoClone = originalLogoLink.cloneNode(true);
            logoClone.removeAttribute('id');
            header.appendChild(logoClone);
        }
        
        // Create Close Button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'mobile-menu-close-btn';
        closeBtn.innerHTML = '✕';
        closeBtn.ariaLabel = 'Close menu';
        
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggle.classList.remove('active');
            navLinks.classList.remove('mobile-open');
        });
        
        header.appendChild(closeBtn);
        navLinks.insertBefore(header, navLinks.firstChild);
    }
    
    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isActive = toggle.classList.contains('active');
        
        // Use requestAnimationFrame for smooth class toggling
        requestAnimationFrame(() => {
            if (isActive) {
                toggle.classList.remove('active');
                navLinks.classList.remove('mobile-open');
            } else {
                toggle.classList.add('active');
                navLinks.classList.add('mobile-open');
            }
        });
    });
    
    // Close menu when clicking a link (using delegation)
    navLinks.addEventListener('click', (e) => {
        if (e.target.closest('a')) {
            toggle.classList.remove('active');
            navLinks.classList.remove('mobile-open');
        }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && navLinks.classList.contains('mobile-open')) {
            toggle.classList.remove('active');
            navLinks.classList.remove('mobile-open');
        }
    });
}

// Initialize all UI enhancements
function initUIEnhancements() {
    // Check if device is low-power to disable certain effects?
    // For now, just init everything optimized
    initScrollProgress();
    initKeyboardShortcuts();
    initEnhancedDropZone();
    enhanceFormValidation();
    initCopyButtons();
    initMobileMenu();
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUIEnhancements);
} else {
    initUIEnhancements();
}

// Export functions for use in other scripts
export {
    showSmartLoader,
    hideSmartLoader,
    showToast,
    copyToClipboard,
    showKeyboardShortcutsHelp
};
