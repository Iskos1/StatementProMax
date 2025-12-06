import { initSmoothScrolling, validateEmail } from './utils.js';

const APP_ID = '76a8365b-a4b6-48b0-a63b-d7a14d3587ec';

async function initializeApp() {
    try {
        const { init } = await import('https://cdn.jsdelivr.net/npm/@instantdb/core@0.14.30/+esm');
        return init({ appId: APP_ID });
    } catch (error) {
        console.error('Failed to load InstantDB:', error);
        return null;
    }
}

initializeApp().then(db => {
    if (!db) return;
    setupAuth(db);
});

function setupAuth(db) {
    // Global state
    let currentUser = null;
    let sentEmail = '';
    let modalRequired = false;

    // DOM Elements
    const modal = document.getElementById('signInModal');
    const signInBtn = document.getElementById('signInBtn');
    const authButtonText = document.getElementById('authButtonText');
    const userMenu = document.getElementById('userMenu');
    const userEmail = document.getElementById('userEmail');
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdown = document.getElementById('userDropdown');
    const closeAuthModalBtn = document.getElementById('closeAuthModal');

    // Modal steps
    const emailStep = document.getElementById('emailStep');
    const codeStep = document.getElementById('codeStep');

    // Inputs
    const emailInput = document.getElementById('emailInput');
    const codeInput = document.getElementById('codeInput');

    // Error messages
    const emailError = document.getElementById('emailError');
    const codeError = document.getElementById('codeError');

    // Buttons
    const sendCodeBtn = document.getElementById('sendCodeBtn');
    const verifyCodeBtn = document.getElementById('verifyCodeBtn');
    const googleSignInBtn = document.getElementById('googleSignIn');
    const backToEmailBtn = document.getElementById('backToEmailBtn');
    const resendCodeBtn = document.getElementById('resendCodeBtn');
    const signOutBtn = document.getElementById('signOutBtn');

    // Display elements
    const sentEmailDisplay = document.getElementById('sentEmail');

    // Check if element exists before adding listeners
    if (!modal || !signInBtn) {
        console.warn('Auth elements not found on this page');
        return;
    }

    // Listen to auth state changes
    db.subscribeAuth((auth) => {
        currentUser = auth.user;
        updateUIForAuthState(auth.user);
        // Cache auth state for instant load on next page
        cacheAuthState(auth.user);
    });

    // Cache auth state in localStorage for instant UI on page load
    function cacheAuthState(user) {
        try {
            if (user) {
                localStorage.setItem('cachedAuthUser', JSON.stringify({
                    email: user.email,
                    timestamp: Date.now()
                }));
            } else {
                localStorage.removeItem('cachedAuthUser');
            }
        } catch (e) {
            // localStorage might not be available
        }
    }

    // Update UI based on auth state - uses CSS classes to prevent layout shift
    function updateUIForAuthState(user) {
        if (user) {
            // User is signed in - use CSS classes for smooth transition
            if (signInBtn) {
                signInBtn.classList.add('auth-hidden');
            }
            if (userMenu) {
                userMenu.classList.remove('auth-hidden');
            }
            if (userEmail) {
                userEmail.textContent = user.email.split('@')[0];
            }
        } else {
            // User is signed out
            if (signInBtn) {
                signInBtn.classList.remove('auth-hidden');
            }
            if (userMenu) {
                userMenu.classList.add('auth-hidden');
            }
        }
    }

    // Show modal
    function showSignInModal(required = false) {
        modalRequired = required;
        modal.classList.add('show');
        if (required) {
            modal.classList.add('required');
        }
        document.body.style.overflow = 'hidden';
        showEmailView();
        
        // Store return URL for post-login redirect
        if (!sessionStorage.getItem('returnUrl')) {
            sessionStorage.setItem('returnUrl', window.location.pathname);
        }
    }

    // Hide modal
    function hideSignInModal() {
        if (modalRequired && !currentUser) {
            // Don't allow closing if auth is required and user not logged in
            return;
        }
        modal.classList.remove('show');
        modal.classList.remove('required');
        document.body.style.overflow = 'auto';
        setTimeout(() => {
            showEmailView();
        }, 300);
    }

    // Show different views
    function showEmailView() {
        emailStep.style.display = 'block';
        codeStep.style.display = 'none';
        emailInput.value = '';
        clearError(emailError);
        emailInput.focus();
    }

    function showCodeView(email) {
        emailStep.style.display = 'none';
        codeStep.style.display = 'block';
        if (sentEmailDisplay) sentEmailDisplay.textContent = email;
        codeInput.value = '';
        clearError(codeError);
        codeInput.focus();
    }

    // Open modal
    signInBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showSignInModal(false);
    });

    // Close modal
    if (closeAuthModalBtn) {
        closeAuthModalBtn.addEventListener('click', () => {
            hideSignInModal();
        });
    }

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideSignInModal();
        }
    });

    // Close modal with ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('show')) {
            hideSignInModal();
        }
    });

    // validateEmail is now imported from utils.js

    function showError(errorElement, message) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }

    function clearError(errorElement) {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    }

    // Send magic code
    sendCodeBtn.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        
        // Validate email
        if (!email) {
            showError(emailError, 'Email is required');
            emailInput.classList.add('error');
            return;
        }
        
        if (!validateEmail(email)) {
            showError(emailError, 'Please enter a valid email address');
            emailInput.classList.add('error');
            return;
        }
        
        clearError(emailError);
        emailInput.classList.remove('error');
        
        // Send magic code
        const originalText = sendCodeBtn.textContent;
        sendCodeBtn.textContent = 'Sending code...';
        sendCodeBtn.disabled = true;
        
        try {
            await db.auth.sendMagicCode({ email });
            sentEmail = email;
            showCodeView(email);
        } catch (error) {
            console.error('Error sending magic code:', error);
            showError(emailError, error.message || 'Failed to send code. Please try again.');
        } finally {
            sendCodeBtn.textContent = originalText;
            sendCodeBtn.disabled = false;
        }
    });

    // Real-time email validation
    emailInput.addEventListener('input', () => {
        if (emailInput.classList.contains('error')) {
            emailInput.classList.remove('error');
            clearError(emailError);
        }
    });

    // Allow Enter key to submit
    emailInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendCodeBtn.click();
        }
    });

    // Verify code
    verifyCodeBtn.addEventListener('click', async () => {
        const code = codeInput.value.trim();
        
        // Validate code
        if (!code) {
            showError(codeError, 'Verification code is required');
            codeInput.classList.add('error');
            return;
        }
        
        if (code.length !== 6 || !/^\d+$/.test(code)) {
            showError(codeError, 'Please enter a valid 6-digit code');
            codeInput.classList.add('error');
            return;
        }
        
        clearError(codeError);
        codeInput.classList.remove('error');
        
        // Verify code
        const originalText = verifyCodeBtn.textContent;
        verifyCodeBtn.textContent = 'Verifying...';
        verifyCodeBtn.disabled = true;
        
        try {
            await db.auth.signInWithMagicCode({ email: sentEmail, code });
            // Auth state will update via subscribeAuth listener
            // Close modal and redirect after successful sign in
            setTimeout(() => {
                hideSignInModal();
                // Handle redirect
                const returnUrl = sessionStorage.getItem('returnUrl');
                if (returnUrl && returnUrl !== window.location.pathname) {
                    sessionStorage.removeItem('returnUrl');
                    window.location.href = returnUrl;
                }
            }, 500);
        } catch (error) {
            console.error('Error verifying code:', error);
            showError(codeError, error.message || 'Invalid code. Please try again.');
            verifyCodeBtn.textContent = originalText;
            verifyCodeBtn.disabled = false;
        }
    });

    // Real-time code validation
    codeInput.addEventListener('input', () => {
        if (codeInput.classList.contains('error')) {
            codeInput.classList.remove('error');
            clearError(codeError);
        }
        
        // Auto-submit when 6 digits are entered
        if (codeInput.value.length === 6 && /^\d{6}$/.test(codeInput.value)) {
            verifyCodeBtn.click();
        }
    });

    // Allow Enter key to submit
    codeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            verifyCodeBtn.click();
        }
    });

    // Back to email button
    backToEmailBtn.addEventListener('click', () => {
        showEmailView();
    });

    // Resend code button
    resendCodeBtn.addEventListener('click', async () => {
        const originalText = resendCodeBtn.textContent;
        resendCodeBtn.textContent = 'Sending...';
        resendCodeBtn.disabled = true;
        
        try {
            await db.auth.sendMagicCode({ email: sentEmail });
            showError(codeError, 'New code sent! Check your email.');
            codeError.style.background = '#f0f8f5';
            codeError.style.borderColor = '#2d7a5f';
            codeError.style.color = '#2d7a5f';
        } catch (error) {
            console.error('Error resending code:', error);
            showError(codeError, 'Failed to resend code. Please try again.');
        } finally {
            resendCodeBtn.textContent = originalText;
            resendCodeBtn.disabled = false;
        }
    });

    // Google Sign In
    googleSignInBtn.addEventListener('click', async () => {
        const originalText = googleSignInBtn.textContent;
        googleSignInBtn.disabled = true;
        googleSignInBtn.textContent = 'Connecting...';
        
        try {
            await db.auth.signInWithGoogle();
            // Redirect will happen automatically after auth state updates
        } catch (error) {
            console.error('Error signing in with Google:', error);
            showError(emailError, 'Failed to sign in with Google. Please try again.');
            googleSignInBtn.disabled = false;
            googleSignInBtn.textContent = originalText;
        }
    });

    // User menu dropdown toggle
    if (userMenuBtn) {
        userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('show');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!userMenu.contains(e.target)) {
                userDropdown.classList.remove('show');
            }
        });
    }

    // Sign out
    if (signOutBtn) {
        signOutBtn.addEventListener('click', async () => {
            const originalText = signOutBtn.textContent;
            signOutBtn.disabled = true;
            signOutBtn.textContent = 'Signing out...';
            
            try {
                await db.auth.signOut();
                userDropdown.classList.remove('show');
                // Redirect to homepage after sign out
                window.location.href = 'index.html';
            } catch (error) {
                console.error('Error signing out:', error);
                alert('Failed to sign out. Please try again.');
                signOutBtn.disabled = false;
                signOutBtn.textContent = originalText;
            }
        });
    }

    // Expose showSignInModal globally for use in other scripts
    window.showSignInModal = showSignInModal;
    window.currentDb = db;
    window.getCurrentUser = () => currentUser;
}

// Initialize smooth scrolling from utils.js
initSmoothScrolling();
