// UI/UX Enhancement Interactions
// Keyboard shortcuts, scroll progress, and other interactive improvements

// Scroll Progress Indicator
function initScrollProgress() {
    const scrollIndicatorBar = document.getElementById('scrollIndicatorBar');
    if (!scrollIndicatorBar) return;

    function updateScrollProgress() {
        const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (winScroll / height) * 100;
        scrollIndicatorBar.style.width = scrolled + '%';
    }

    window.addEventListener('scroll', updateScrollProgress, { passive: true });
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
    modal.innerHTML = `
        <div class="auth-modal-content" style="max-width: 600px;">
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

    document.body.appendChild(modal);

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Smart Loading States
function showSmartLoader(message = 'Processing...') {
    const existingLoader = document.getElementById('smartLoader');
    if (existingLoader) return;

    const loader = document.createElement('div');
    loader.id = 'smartLoader';
    loader.className = 'loading-overlay';
    loader.innerHTML = `
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <p class="loading-text">${message}</p>
            <p class="loading-subtext">This may take a few moments...</p>
        </div>
    `;

    document.body.appendChild(loader);
}

function hideSmartLoader() {
    const loader = document.getElementById('smartLoader');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => loader.remove(), 300);
    }
}

// Expose loader functions globally
window.showSmartLoader = showSmartLoader;
window.hideSmartLoader = hideSmartLoader;

// Enhanced File Drop Visual Feedback
function initEnhancedDropZone() {
    const uploadAreas = document.querySelectorAll('#uploadArea');
    
    uploadAreas.forEach(area => {
        let dragCounter = 0;

        area.addEventListener('dragenter', (e) => {
            e.preventDefault();
            dragCounter++;
            if (dragCounter === 1) {
                area.style.transform = 'scale(1.02)';
                area.style.borderWidth = '4px';
            }
        });

        area.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dragCounter--;
            if (dragCounter === 0) {
                area.style.transform = 'scale(1)';
                area.style.borderWidth = '3px';
            }
        });

        area.addEventListener('drop', () => {
            dragCounter = 0;
            area.style.transform = 'scale(1)';
            area.style.borderWidth = '3px';
            
            // Show success animation
            area.style.borderColor = '#22c55e';
            setTimeout(() => {
                area.style.borderColor = '';
            }, 1000);
        });
    });
}

// Smooth Scroll to Section - uses utils.js initSmoothScrolling() instead
// REMOVED: smoothScrollTo() and initSmoothScrollAnchors() - duplicated utils.js functionality

// Auto-hide elements on scroll (like promotional banner)
function initScrollAutoHide() {
    let lastScrollTop = 0;
    const banner = document.querySelector('.promo-banner');
    const nav = document.querySelector('.nav');

    if (!nav) return;

    window.addEventListener('scroll', () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        if (scrollTop > lastScrollTop && scrollTop > 100) {
            // Scrolling down
            if (banner && !banner.classList.contains('hidden')) {
                banner.style.transform = 'translateY(-100%)';
            }
            nav.style.transform = 'translateY(-100%)';
        } else {
            // Scrolling up
            if (banner && !banner.classList.contains('hidden')) {
                banner.style.transform = 'translateY(0)';
            }
            nav.style.transform = 'translateY(0)';
        }

        lastScrollTop = scrollTop;
    }, { passive: true });
}

// Toast Notifications Enhancement (replaces basic notifications)
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `notification notification-${type} show`;
    
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

    // Auto remove
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);

    // Click to dismiss
    toast.addEventListener('click', () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    });
}

// Expose toast globally
window.showToast = showToast;

// Form Validation Visual Feedback
function enhanceFormValidation() {
    const forms = document.querySelectorAll('form');
    
    forms.forEach(form => {
        const inputs = form.querySelectorAll('input, select, textarea');
        
        inputs.forEach(input => {
            // Real-time validation on blur
            input.addEventListener('blur', () => {
                if (input.checkValidity()) {
                    input.parentElement?.classList.add('success');
                    input.parentElement?.classList.remove('error');
                } else if (input.value) {
                    input.parentElement?.classList.add('error');
                    input.parentElement?.classList.remove('success');
                }
            });

            // Clear validation on focus
            input.addEventListener('focus', () => {
                input.parentElement?.classList.remove('error', 'success');
            });
        });
    });
}

// Clipboard Copy with Feedback
function copyToClipboard(text, successMessage = 'Copied to clipboard!') {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast(successMessage, 'success', 2000);
        }).catch(err => {
            console.error('Failed to copy:', err);
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

// Add "Copied!" feedback to copy buttons
function initCopyButtons() {
    document.querySelectorAll('[data-copy]').forEach(button => {
        button.addEventListener('click', () => {
            const textToCopy = button.getAttribute('data-copy');
            copyToClipboard(textToCopy);
        });
    });
}

// Mobile Menu Toggle
function initMobileMenu() {
    const toggle = document.getElementById('mobileMenuToggle');
    const navLinks = document.getElementById('navLinks');
    
    if (!toggle || !navLinks) return;
    
    toggle.addEventListener('click', () => {
        toggle.classList.toggle('active');
        navLinks.classList.toggle('mobile-open');
    });
    
    // Close menu when clicking a link
    const links = navLinks.querySelectorAll('a');
    links.forEach(link => {
        link.addEventListener('click', () => {
            toggle.classList.remove('active');
            navLinks.classList.remove('mobile-open');
        });
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!toggle.contains(e.target) && !navLinks.contains(e.target)) {
            toggle.classList.remove('active');
            navLinks.classList.remove('mobile-open');
        }
    });
}

// Initialize all UI enhancements
function initUIEnhancements() {
    initScrollProgress();
    initKeyboardShortcuts();
    initEnhancedDropZone();
    initScrollAutoHide();
    enhanceFormValidation();
    initCopyButtons();
    initMobileMenu();
    
    // Add keyboard shortcut hint to footer
    addKeyboardShortcutHint();
    
    console.log('✨ UI Enhancements loaded');
}

// Add keyboard shortcut hint (DISABLED - removed from footer)
function addKeyboardShortcutHint() {
    // Disabled: User requested removal of keyboard shortcut hint from footer
    return;
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

