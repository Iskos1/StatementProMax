// Initialize InstantDB
const APP_ID = '76a8365b-a4b6-48b0-a63b-d7a14d3587ec';

// Dynamic import for InstantDB
async function initializeApp() {
    try {
        const { init } = await import('https://cdn.jsdelivr.net/npm/@instantdb/core@0.14.30/+esm');
        const db = init({ appId: APP_ID });
        return db;
    } catch (error) {
        console.error('Failed to load InstantDB:', error);
        return null;
    }
}

// Initialize and setup auth
initializeApp().then(db => {
    if (!db) {
        console.error('Failed to initialize InstantDB');
        return;
    }
    
    console.log('InstantDB initialized successfully');
    setupAuth(db);
});

function setupAuth(db) {
    // Global state
    let currentUser = null;
    let sentEmail = '';

    // DOM Elements
    const modal = document.getElementById('signInModal');
    const signInBtn = document.getElementById('signInBtn');
    const authButtonText = document.getElementById('authButtonText');
    const closeModal = document.querySelector('.close-modal');

    // Views
    const emailView = document.getElementById('emailView');
    const codeView = document.getElementById('codeView');
    const userView = document.getElementById('userView');

    // Forms
    const emailForm = document.getElementById('emailForm');
    const codeForm = document.getElementById('codeForm');

    // Inputs
    const emailInput = document.getElementById('email');
    const codeInput = document.getElementById('verificationCode');

    // Error messages
    const emailError = document.getElementById('emailError');
    const codeError = document.getElementById('codeError');

    // Buttons
    const googleSignInBtn = document.getElementById('googleSignIn');
    const backToEmailBtn = document.getElementById('backToEmail');
    const signOutBtn = document.getElementById('signOutBtn');

    // Display elements
    const sentToEmail = document.getElementById('sentToEmail');
    const userEmail = document.getElementById('userEmail');

    // Listen to auth state changes
    db.subscribeAuth((auth) => {
        currentUser = auth.user;
        updateUIForAuthState(auth.user);
    });

    // Update UI based on auth state
    function updateUIForAuthState(user) {
        if (user) {
            // User is signed in
            authButtonText.textContent = user.email.split('@')[0];
            showUserView(user.email);
        } else {
            // User is signed out
            authButtonText.textContent = 'Sign In';
        }
    }

    // Show different views
    function showEmailView() {
        emailView.style.display = 'block';
        codeView.style.display = 'none';
        userView.style.display = 'none';
        emailInput.value = '';
        clearError(emailInput, emailError);
    }

    function showCodeView(email) {
        emailView.style.display = 'none';
        codeView.style.display = 'block';
        userView.style.display = 'none';
        sentToEmail.textContent = email;
        codeInput.value = '';
        clearError(codeInput, codeError);
        codeInput.focus();
    }

    function showUserView(email) {
        emailView.style.display = 'none';
        codeView.style.display = 'none';
        userView.style.display = 'block';
        userEmail.textContent = email;
    }

    // Open modal
    signInBtn.addEventListener('click', (e) => {
        e.preventDefault();
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        
        if (currentUser) {
            showUserView(currentUser.email);
        } else {
            showEmailView();
        }
    });

    // Close modal
    closeModal.addEventListener('click', () => {
        closeModalAndReset();
    });

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModalAndReset();
        }
    });

    // Close modal with ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('show')) {
            closeModalAndReset();
        }
    });

    function closeModalAndReset() {
        modal.classList.remove('show');
        document.body.style.overflow = 'auto';
        setTimeout(() => {
            if (!currentUser) {
                showEmailView();
            }
        }, 300);
    }

    // Email validation
    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    function showError(input, errorElement, message) {
        input.classList.add('error');
        errorElement.textContent = message;
        errorElement.classList.add('show');
    }

    function clearError(input, errorElement) {
        input.classList.remove('error');
        errorElement.textContent = '';
        errorElement.classList.remove('show');
    }

    // Email form submission - Send magic code
    emailForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = emailInput.value.trim();
        
        // Validate email
        if (!email) {
            showError(emailInput, emailError, 'Email is required');
            return;
        }
        
        if (!validateEmail(email)) {
            showError(emailInput, emailError, 'Please enter a valid email address');
            return;
        }
        
        clearError(emailInput, emailError);
        
        // Send magic code
        const submitBtn = emailForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Sending code...';
        submitBtn.disabled = true;
        
        try {
            await db.auth.sendMagicCode({ email });
            sentEmail = email;
            showCodeView(email);
        } catch (error) {
            console.error('Error sending magic code:', error);
            showError(emailInput, emailError, error.message || 'Failed to send code. Please try again.');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });

    // Real-time email validation
    emailInput.addEventListener('blur', () => {
        if (emailInput.value && !validateEmail(emailInput.value)) {
            showError(emailInput, emailError, 'Please enter a valid email address');
        } else {
            clearError(emailInput, emailError);
        }
    });

    emailInput.addEventListener('input', () => {
        if (emailInput.classList.contains('error')) {
            clearError(emailInput, emailError);
        }
    });

    // Code form submission - Verify code
    codeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const code = codeInput.value.trim();
        
        // Validate code
        if (!code) {
            showError(codeInput, codeError, 'Verification code is required');
            return;
        }
        
        if (code.length !== 6 || !/^\d+$/.test(code)) {
            showError(codeInput, codeError, 'Please enter a valid 6-digit code');
            return;
        }
        
        clearError(codeInput, codeError);
        
        // Verify code
        const submitBtn = codeForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Verifying...';
        submitBtn.disabled = true;
        
        try {
            await db.auth.signInWithMagicCode({ email: sentEmail, code });
            // Auth state will update via onChange listener
            // Close modal after successful sign in
            setTimeout(() => {
                closeModalAndReset();
            }, 500);
        } catch (error) {
            console.error('Error verifying code:', error);
            showError(codeInput, codeError, error.message || 'Invalid code. Please try again.');
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });

    // Real-time code validation
    codeInput.addEventListener('input', () => {
        if (codeInput.classList.contains('error')) {
            clearError(codeInput, codeError);
        }
        
        // Auto-submit when 6 digits are entered
        if (codeInput.value.length === 6 && /^\d{6}$/.test(codeInput.value)) {
            codeForm.dispatchEvent(new Event('submit'));
        }
    });

    // Back to email button
    backToEmailBtn.addEventListener('click', () => {
        showEmailView();
    });

    // Google Sign In
    googleSignInBtn.addEventListener('click', async () => {
        try {
            googleSignInBtn.disabled = true;
            googleSignInBtn.textContent = 'Connecting...';
            await db.auth.signInWithGoogle();
        } catch (error) {
            console.error('Error signing in with Google:', error);
            alert('Failed to sign in with Google. Please try again.');
            googleSignInBtn.disabled = false;
            googleSignInBtn.textContent = 'Google';
        }
    });

    // Sign out
    signOutBtn.addEventListener('click', async () => {
        try {
            signOutBtn.disabled = true;
            signOutBtn.textContent = 'Signing out...';
            await db.auth.signOut();
            closeModalAndReset();
        } catch (error) {
            console.error('Error signing out:', error);
            alert('Failed to sign out. Please try again.');
        } finally {
            signOutBtn.disabled = false;
            signOutBtn.textContent = 'Sign Out';
        }
    });

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href !== '#' && href.length > 1) {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });

}
