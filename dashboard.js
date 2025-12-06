// Dashboard App
import { 
    formatFileSize, 
    formatCurrency, 
    formatDate, 
    escapeHtml, 
    showNotification,
    safeGetElement,
    safeSessionStorageGet,
    safeSessionStorageSet,
    safeSessionStorageRemove
} from './utils.js';

import { initializeYearModal, showYearModal } from './year-modal.js';

// Transaction Database for Persistent Learning
import {
    initializeDB,
    saveCategorization,
    findLearnedCategory as dbFindLearnedCategory,
    markDissimilar as dbMarkDissimilar,
    getDBStats,
    saveFileHistory,
    getFileHistoryById
} from './transaction-db.js';

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled rejection:', event.reason);
});

let transactions = [];
let allTransactions = [];
let selectedFiles = [];
let selectedMonths = new Set();
let savedSelections = {};
let charts = {
    incomeExpense: null,
    category: null
};

// File history tracking
let currentFileData = null; // Stores current file data for history
let currentFileYear = null;

// Cache for performance
let cachedRecurringPayments = null;
let lastTransactionsHash = null;

// Track removed transactions from savings optimizer
let removedOptimizerTransactions = new Set();
let maxOptimizerRecommendations = 0; // Track initial recommendation count to prevent adding more when removing
let targetSavingsRate = 50; // Default target savings rate (can be changed by user)

// Categorization Learning System
let learnedCategorizations = new Map(); // Stores approved categorizations with multiple examples
let dissimilarPairs = new Set(); // Stores pairs of descriptions that user marked as NOT similar
let pendingReview = []; // Transactions awaiting review
let isReviewMode = false; // Track if we're in review mode

// DOM Elements - cached for performance
let dom = {};

// Initialize upload button (works without authentication)
function initializeUploadButton() {
    const browseFilesBtn = document.getElementById('browseFilesBtn');
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');
    
    // Browse Files button click handler
    if (browseFilesBtn && fileInput) {
        browseFilesBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            fileInput.click();
        });
    }
    
    // Upload area click handler
    if (uploadArea && fileInput) {
        uploadArea.addEventListener('click', (e) => {
            // Don't trigger if clicking the button (button has its own handler)
            if (!e.target.closest('#browseFilesBtn')) {
                fileInput.click();
            }
        });
    }
}

// Show optional sign-in banner (non-blocking)
function showOptionalSignInBanner() {
    const dashboardHero = document.getElementById('dashboardHero');
    if (!dashboardHero) return;
    
    // Check if banner already exists
    if (document.getElementById('signInBanner')) return;
    
    const banner = document.createElement('div');
    banner.id = 'signInBanner';
    banner.className = 'sign-in-banner';
    banner.innerHTML = `
        <div class="sign-in-banner-content">
            <div class="sign-in-banner-icon">🔐</div>
            <div class="sign-in-banner-text">
                <strong>Want to save your analysis?</strong>
                <span>Sign in to store and access your data across devices.</span>
            </div>
            <button class="btn-primary btn-small" id="bannerSignInBtn">Sign In</button>
            <button class="banner-close-btn" id="closeBanner">&times;</button>
        </div>
    `;
    
    // Insert banner after hero section
    dashboardHero.insertAdjacentElement('afterend', banner);
    
    // Add event listeners
    const bannerSignInBtn = document.getElementById('bannerSignInBtn');
    const closeBanner = document.getElementById('closeBanner');
    
    if (bannerSignInBtn) {
        bannerSignInBtn.addEventListener('click', () => {
            if (typeof window.showSignInModal === 'function') {
                window.showSignInModal(false); // false = optional (can close)
            }
        });
    }
    
    if (closeBanner) {
        closeBanner.addEventListener('click', () => {
            banner.remove();
        });
    }
}

// Initialize Authentication and Dashboard Protection
async function initializeDashboard() {
    
    try {
        // Dynamic import for InstantDB
        const { init } = await import('https://cdn.jsdelivr.net/npm/@instantdb/core@0.14.30/+esm');
        const APP_ID = '76a8365b-a4b6-48b0-a63b-d7a14d3587ec';
        const db = init({ appId: APP_ID });
        
        // Listen to auth state changes
        db.subscribeAuth((auth) => {
            const user = auth.user;
            
            // Update navigation UI
            const signInBtn = document.getElementById('signInBtn');
            const userMenu = document.getElementById('userMenu');
            const userEmail = document.getElementById('userEmail');
            
            if (user) {
                // User is authenticated - show dashboard
                if (signInBtn) signInBtn.style.display = 'none';
                if (userMenu) userMenu.style.display = 'block';
                if (userEmail) userEmail.textContent = user.email.split('@')[0];
                
                // Initialize dashboard features
                initializeDashboardFeatures();
            } else {
                // User is NOT authenticated - show optional login prompt
                if (signInBtn) signInBtn.style.display = 'block';
                if (userMenu) userMenu.style.display = 'none';
                
                // Store current page for redirect after login
                if (!sessionStorage.getItem('returnUrl')) {
                    sessionStorage.setItem('returnUrl', window.location.pathname);
                }
                
                // Allow users to use upload feature without authentication
                // Show optional sign-in banner instead of blocking modal
                showOptionalSignInBanner();
                
                // Initialize dashboard features even without authentication
                // so users can upload and analyze files
                initializeDashboardFeatures();
            }
        });
        
        // Store db globally for use in other functions
        window.dashboardDb = db;
        
    } catch (error) {
        console.error('Failed to initialize authentication:', error);
        alert('Failed to load authentication system. Please refresh the page.');
    }
}

// Cache DOM elements for performance
function cacheDOMElements() {
    dom = {
        fileInput: safeGetElement('fileInput'),
        uploadArea: safeGetElement('uploadArea'),
        uploadSection: safeGetElement('uploadSection'),
        dashboardContent: safeGetElement('dashboardContent'),
        uploadNewBtn: safeGetElement('uploadNewBtn'),
        fileList: safeGetElement('fileList'),
        fileListItems: safeGetElement('fileListItems'),
        fileCount: safeGetElement('fileCount'),
        processFilesBtn: safeGetElement('processFilesBtn'),
        fileName: safeGetElement('fileName'),
        totalIncome: safeGetElement('totalIncome'),
        totalExpenses: safeGetElement('totalExpenses'),
        netBalance: safeGetElement('netBalance'),
        savingsRate: safeGetElement('savingsRate'),
        incomeCount: safeGetElement('incomeCount'),
        expenseCount: safeGetElement('expenseCount'),
        balanceChange: safeGetElement('balanceChange'),
        transactionsBody: safeGetElement('transactionsBody'),
        monthFilterButtons: safeGetElement('monthFilterButtons'),
        recurringPaymentsSection: safeGetElement('recurringPaymentsSection'),
        recurringCount: safeGetElement('recurringCount'),
        recurringSpend: safeGetElement('recurringSpend'),
        recurringPaymentsList: safeGetElement('recurringPaymentsList'),
        recurringSearchInput: safeGetElement('recurringSearchInput'),
        recurringSearchClear: safeGetElement('recurringSearchClear'),
        recurringSearchInfo: safeGetElement('recurringSearchInfo'),
        recurringSearchCount: safeGetElement('recurringSearchCount'),
        recurringTotalCount: safeGetElement('recurringTotalCount'),
        recurringNoResults: safeGetElement('recurringNoResults'),
        incomeExpenseChart: safeGetElement('incomeExpenseChart'),
        categoryChart: safeGetElement('categoryChart'),
        sortFilter: safeGetElement('sortFilter')
    };
}

// Initialize dashboard features (after authentication)
async function initializeDashboardFeatures() {
    
    cacheDOMElements();
    initializeYearModal();
    attachEventListeners();
    initializeQuickGuide();
    
    // Initialize the persistent transaction database
    try {
        await initializeDB();
        console.log('✓ Transaction categorization database ready');
        
        // Load and display database statistics
        await loadDatabaseStats();
    } catch (error) {
        console.error('Failed to initialize transaction database:', error);
        showNotification('Warning: Categorization learning may not persist', 'warning');
    }
    
    // Load learned categorizations and dissimilar pairs from storage (legacy fallback)
    loadLearnedCategorizations();
    loadDissimilarPairs();
    
    // Check for file from converter
    const data = safeSessionStorageGet('pendingAnalysisFile');
    
    if (data) {
            const dataAge = Date.now() - (data.timestamp || 0);
            if (dataAge < 5 * 60 * 1000) {
                loadConvertedFile(data.name, data.data, data.year || null);
            }
        safeSessionStorageRemove('pendingAnalysisFile');
    }
}

// Load and display database statistics
async function loadDatabaseStats() {
    try {
        const stats = await getDBStats();
        console.log('📊 Database Statistics:', stats);
        console.log(`  • ${stats.patterns} learned patterns`);
        console.log(`  • ${stats.transactions} transactions in history`);
        console.log(`  • ${stats.dissimilarPairs} dissimilar pairs`);
        
        if (Object.keys(stats.categoryBreakdown).length > 0) {
            console.log('  • Category breakdown:');
            Object.entries(stats.categoryBreakdown)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .forEach(([cat, count]) => {
                    console.log(`    - ${cat}: ${count} patterns`);
                });
        }
        
        // Store stats globally for potential UI display
        window.transactionDBStats = stats;
        
        // Update UI if elements exist and there are patterns to show
        if (stats.patterns > 0) {
            const learningStatsGuide = document.getElementById('learningStatsGuide');
            const learnedPatternsCount = document.getElementById('learnedPatternsCount');
            const topLearnedCategory = document.getElementById('topLearnedCategory');
            
            if (learnedPatternsCount) {
                learnedPatternsCount.textContent = stats.patterns;
            }
            
            if (topLearnedCategory && Object.keys(stats.categoryBreakdown).length > 0) {
                const topCategory = Object.entries(stats.categoryBreakdown)
                    .sort((a, b) => b[1] - a[1])[0];
                topLearnedCategory.textContent = `${topCategory[0]} (${topCategory[1]} patterns)`;
            }
            
            // Show the learning stats guide if not dismissed
            if (learningStatsGuide && !localStorage.getItem('learningStatsGuideDismissed')) {
                learningStatsGuide.style.display = 'flex';
            }
            
            // Setup close button
            const closeLearningStats = document.getElementById('closeLearningStats');
            if (closeLearningStats) {
                closeLearningStats.onclick = () => {
                    if (learningStatsGuide) {
                        learningStatsGuide.style.display = 'none';
                        localStorage.setItem('learningStatsGuideDismissed', 'true');
                    }
                };
            }
        }
        
        return stats;
    } catch (error) {
        console.error('Failed to load database stats:', error);
        return null;
    }
}

// Initialize Quick Guide (dismissable)
function initializeQuickGuide() {
    const quickGuide = document.getElementById('dashboardQuickGuide');
    const closeBtn = document.getElementById('closeQuickGuide');
    
    if (quickGuide && closeBtn) {
        // Check if user has previously dismissed the guide
        const isDismissed = localStorage.getItem('dashboardQuickGuideDismissed');
        
        if (isDismissed === 'true') {
            quickGuide.style.display = 'none';
        }
        
        // Handle close button
        closeBtn.addEventListener('click', () => {
            quickGuide.style.animation = 'slideUp 0.3s ease-out';
            setTimeout(() => {
                quickGuide.style.display = 'none';
            }, 300);
            localStorage.setItem('dashboardQuickGuideDismissed', 'true');
        });
    }
    
    // Initialize Smart Categorization Guide
    const smartGuide = document.getElementById('smartCategorizationGuide');
    const smartCloseBtn = document.getElementById('closeSmartGuide');
    
    if (smartGuide && smartCloseBtn) {
        // Check if user has previously dismissed the smart guide
        const smartDismissed = localStorage.getItem('smartCategorizationGuideDismissed');
        
        if (smartDismissed !== 'true') {
            // Show smart guide after a brief delay
            setTimeout(() => {
                smartGuide.style.display = 'flex';
            }, 1000);
        }
        
        // Handle close button
        smartCloseBtn.addEventListener('click', () => {
            smartGuide.style.animation = 'slideUp 0.3s ease-out';
            setTimeout(() => {
                smartGuide.style.display = 'none';
            }, 300);
            localStorage.setItem('smartCategorizationGuideDismissed', 'true');
        });
    }
}

// Add slideUp animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideUp {
        from {
            opacity: 1;
            transform: translateY(0);
        }
        to {
            opacity: 0;
            transform: translateY(-20px);
        }
    }
`;
document.head.appendChild(style);

// Track if listeners are attached to prevent duplicates
let listenersAttached = false;

// Attach all event listeners
function attachEventListeners() {
    if (listenersAttached) {
        console.warn('Event listeners already attached');
        return;
    }
    
    if (dom.fileInput) {
        dom.fileInput.addEventListener('change', handleFileSelect);
    }
    
    // Browse Files button handler is now in initializeUploadButton() - called on page load
    
    if (dom.uploadArea) {
        dom.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            dom.uploadArea.classList.add('drag-over');
        });
        
        // Only remove drag-over class when actually leaving the upload area (prevents flicker on child elements)
        dom.uploadArea.addEventListener('dragleave', (e) => {
            if (e.target === dom.uploadArea) {
                dom.uploadArea.classList.remove('drag-over');
            }
        });
        
        dom.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            dom.uploadArea.classList.remove('drag-over');
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
                // Filter out duplicate files by name and size
                const newFiles = files.filter(newFile => {
                    return !selectedFiles.some(existingFile => 
                        existingFile.name === newFile.name && existingFile.size === newFile.size
                    );
                });
                
                if (newFiles.length > 0) {
                    selectedFiles = [...selectedFiles, ...newFiles];
                    displayFileList();
                } else if (files.length > 0) {
                    // All files were duplicates
                    if (typeof showNotification === 'function') {
                        showNotification('File(s) already added', 'warning');
                    }
                }
            }
        });
    }
    
    if (dom.processFilesBtn) {
        dom.processFilesBtn.addEventListener('click', () => {
            if (selectedFiles.length > 0) processAllFiles();
        });
    }
    
    if (dom.uploadNewBtn) {
        dom.uploadNewBtn.addEventListener('click', () => {
            if (dom.uploadSection) dom.uploadSection.style.display = 'block';
            if (dom.dashboardContent) dom.dashboardContent.style.display = 'none';
            if (dom.fileInput) dom.fileInput.value = '';
            selectedFiles = [];
            if (dom.fileList) dom.fileList.style.display = 'none';
            if (dom.fileListItems) dom.fileListItems.innerHTML = '';
        });
    }
    
    // Export to Excel button
    const exportToExcelBtn = document.getElementById('exportToExcelBtn');
    if (exportToExcelBtn) {
        exportToExcelBtn.addEventListener('click', exportToExcel);
    }
    
    listenersAttached = true;
}

// Prevent duplicate initialization
let dashboardInitialized = false;

// Start authentication check on page load
window.addEventListener('DOMContentLoaded', () => {
    if (dashboardInitialized) {
        console.warn('Dashboard already initialized, skipping');
        return;
    }
    dashboardInitialized = true;
    
    initializeDashboard();
    
    // Initialize upload button immediately (don't wait for auth)
    initializeUploadButton();
    
    // IMPORTANT: Attach file input listener immediately, don't wait for auth
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
        console.log('✓ File input listener attached');
    }
    
    // Also attach drag/drop listeners immediately
    const uploadArea = document.getElementById('uploadArea');
    if (uploadArea) {
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });
        
        uploadArea.addEventListener('dragleave', (e) => {
            if (e.target === uploadArea) {
                uploadArea.classList.remove('drag-over');
            }
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
                selectedFiles = [...selectedFiles, ...files];
                displayFileList();
            }
        });
        console.log('✓ Upload area drag/drop listeners attached');
    }
    
    // Attach process files button immediately
    const processFilesBtn = document.getElementById('processFilesBtn');
    if (processFilesBtn) {
        processFilesBtn.addEventListener('click', () => {
            if (selectedFiles.length > 0) processAllFiles();
        });
        console.log('✓ Process files button listener attached');
    }
    
    // Initialize back to top button
    initializeBackToTop();
    
    // Initialize scroll progress indicator
    initializeScrollProgress();
    
    // Setup button event listeners
    const manageBtn = document.getElementById('manageLearnedBtn');
    if (manageBtn) {
        manageBtn.addEventListener('click', showLearnedPatternsModal);
    }
    
    const historyBtn = document.getElementById('viewHistoryBtn');
    if (historyBtn) {
        historyBtn.addEventListener('click', showFileHistoryModal);
    }
    
    // History button in upload section
    const historyBtnUpload = document.getElementById('viewHistoryBtnUpload');
    if (historyBtnUpload) {
        historyBtnUpload.addEventListener('click', showFileHistoryModal);
    }
    
    // Target Savings Rate Slider
    const targetSavingsSlider = document.getElementById('targetSavingsSlider');
    const targetSavingsSliderValue = document.getElementById('targetSavingsSliderValue');
    
    if (targetSavingsSlider && targetSavingsSliderValue) {
        // Update calculations in real-time as user moves the slider
        targetSavingsSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            targetSavingsRate = value;
            targetSavingsSliderValue.textContent = value;
            
            // Recalculate the optimizer with new target rate in real-time
            if (transactions && transactions.length > 0) {
                const income = transactions
                    .filter(t => t.type === 'income')
                    .reduce((sum, t) => sum + t.amount, 0);
                const expenses = Math.abs(transactions
                    .filter(t => t.type === 'expense')
                    .reduce((sum, t) => sum + t.amount, 0));
                
                // Reset removed transactions when changing target
                removedOptimizerTransactions.clear();
                maxOptimizerRecommendations = 0;
                
                updateSavingsOptimizer(income, expenses);
            }
        });
    }
});

// Initialize Scroll Progress Indicator
function initializeScrollProgress() {
    const scrollIndicatorBar = document.getElementById('scrollIndicatorBar');
    
    if (!scrollIndicatorBar) return;
    
    window.addEventListener('scroll', () => {
        const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (window.scrollY / windowHeight) * 100;
        scrollIndicatorBar.style.width = scrolled + '%';
    });
}

// Initialize Back to Top button
function initializeBackToTop() {
    const backToTopBtn = document.getElementById('backToTop');
    
    if (!backToTopBtn) return;
    
    // Show button when user scrolls down
    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) {
            backToTopBtn.classList.add('visible');
        } else {
            backToTopBtn.classList.remove('visible');
        }
    });
    
    // Scroll to top when clicked
    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// Load converted file from converter page
// Made available globally for file-history.js
window.loadConvertedFile = async function loadConvertedFile(fileName, base64Data, providedYear = null) {
    showLoading();
    
    try {
        // Convert base64 to blob
        const response = await fetch(base64Data);
        const blob = await response.blob();
        
        // Create a File object
        const file = new File([blob], fileName, { type: blob.type });
        
        // Process the file with optional year correction
        const fileTransactions = await processFile(file, providedYear);
        allTransactions = fileTransactions;
        transactions = allTransactions;
        
        if (allTransactions.length === 0) {
            hideLoading();
            alert('No transactions found in the converted file.');
            return;
        }
        
        // Sort transactions by date
        allTransactions.sort((a, b) => b.date - a.date);
        
        // Update file name display
        if (dom.fileName) dom.fileName.textContent = fileName;
        
        // Setup month filter
        setupMonthFilter();
        
        // Store file data for history (if single file)
    if (selectedFiles.length === 1) {
        const file = selectedFiles[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            currentFileData = e.target.result; // Base64 data
            currentFileYear = providedYear;
        };
        reader.readAsDataURL(file);
    }
    
    // Show categorization review modal before displaying dashboard
        hideLoading();
        showCategorizationReview(allTransactions);
    } catch (error) {
        hideLoading();
        console.error('Error loading converted file:', error);
        alert('Error loading the converted file. Please try uploading it manually.');
    }
}

function displayFileList() {
    if (selectedFiles.length === 0) {
        if (dom.fileList) dom.fileList.style.display = 'none';
        return;
    }
    
    if (dom.fileList) dom.fileList.style.display = 'block';
    if (dom.fileListItems) dom.fileListItems.innerHTML = '';
    
    // Update file count
    if (dom.fileCount) dom.fileCount.textContent = selectedFiles.length;
    
    selectedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        
        const fileInfo = document.createElement('div');
        const fileName = document.createElement('div');
        fileName.className = 'file-item-name';
        fileName.textContent = file.name;
        
        const fileSize = document.createElement('div');
        fileSize.className = 'file-item-size';
        fileSize.textContent = formatFileSize(file.size);
        
        fileInfo.appendChild(fileName);
        fileInfo.appendChild(fileSize);
        
        const removeBtn = document.createElement('span');
        removeBtn.className = 'file-item-remove';
        removeBtn.textContent = 'Remove';
        removeBtn.onclick = () => removeFile(index);
        
        fileItem.appendChild(fileInfo);
        fileItem.appendChild(removeBtn);
        if (dom.fileListItems) dom.fileListItems.appendChild(fileItem);
    });
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    displayFileList();
}

async function processAllFiles() {
    if (!selectedFiles || selectedFiles.length === 0) {
        showNotification('No files selected', 'warning');
        return;
    }

    // Show year selection modal
    let year;
    try {
        year = await showYearModal();
    } catch (error) {
        // User cancelled - ensure upload section is still visible
        return;
    }
    
    // Hide upload section immediately after year selection to prevent flickering
    if (dom.uploadSection) dom.uploadSection.style.display = 'none';

    // Validate year input (should always be valid from dropdown, but check anyway)
    if (isNaN(year) || year < 1900 || year > 2100) {
        showNotification('Invalid year. Please try again.', 'error');
        if (dom.uploadSection) dom.uploadSection.style.display = 'block';
        return;
    }

    showLoading();
    
    allTransactions = [];
    let fileNames = [];
    let errors = [];
    
    for (const file of selectedFiles) {
        // Validate file
        const validExtensions = ['.xlsx', '.xls', '.csv'];
        const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        
        if (!validExtensions.includes(fileExtension)) {
            errors.push(`${file.name}: Invalid file type`);
            continue;
        }
        
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            errors.push(`${file.name}: Exceeds 10MB limit`);
            continue;
        }
        
        try {
            const fileTransactions = await processFile(file, year);
            if (fileTransactions && fileTransactions.length > 0) {
                allTransactions = allTransactions.concat(fileTransactions);
                fileNames.push(file.name);
            } else {
                errors.push(`${file.name}: No valid transactions found`);
            }
        } catch (error) {
            console.error(`Error processing ${file.name}:`, error);
            console.error('Full error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            errors.push(`${file.name}: ${error.message || 'Processing failed'}`);
        }
    }
    
    // Show errors if any
    if (errors.length > 0 && fileNames.length === 0) {
        hideLoading();
        const errorMsg = 'Failed to process files:\n' + errors.join('\n');
        alert(`Failed to process files:\n\n${errors.join('\n')}\n\nCheck browser console (F12) for details.`);
        showNotification('All files failed to process', 'error');
        console.error('=== PROCESSING ERRORS ===');
        console.error(errorMsg);
        console.error('=========================');
        if (dom.uploadSection) dom.uploadSection.style.display = 'block';
        return;
    } else if (errors.length > 0) {
        // Some files succeeded, show warning
        showNotification(`${errors.length} file(s) had errors, ${fileNames.length} processed successfully`, 'warning');
    }
    
    if (allTransactions.length === 0) {
        hideLoading();
        alert('No transactions found in the uploaded files.');
        if (dom.uploadSection) dom.uploadSection.style.display = 'block';
        return;
    }
    
    // Sort all transactions by date
    allTransactions.sort((a, b) => b.date - a.date);
    transactions = allTransactions;
    
    // Store file data for history (if single file)
    if (selectedFiles.length === 1 && selectedFiles[0]) {
        const file = selectedFiles[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            currentFileData = e.target.result; // Base64 data
            currentFileYear = year;
        };
        reader.readAsDataURL(file);
    }
    
    // Update file name display
    const fileNameDisplay = fileNames.length === 1 
        ? fileNames[0] 
        : `${fileNames.length} files (${fileNames.join(', ')})`;
    if (dom.fileName) dom.fileName.textContent = fileNameDisplay;
    
    // Setup month filter
    setupMonthFilter();
    
    // Show categorization review modal before displaying dashboard
    hideLoading();
    showCategorizationReview(allTransactions);
}

function processFile(file, providedYear = null) {
    return new Promise((resolve, reject) => {
        if (!file || !(file instanceof File)) {
            reject(new Error('Invalid file object'));
            return;
        }
        
        const reader = new FileReader();
        
        // Add timeout for file reading
        const timeout = setTimeout(() => {
            reader.abort();
            reject(new Error('File reading timed out'));
        }, 30000); // 30 second timeout
        
        reader.onload = async (e) => {
            clearTimeout(timeout);
            try {
                if (!e.target || !e.target.result) {
                    throw new Error('No data read from file');
                }
                
                const data = new Uint8Array(e.target.result);
                
                console.log(`Processing file: ${file.name}, Size: ${data.length} bytes`);
                
                if (!window.XLSX) {
                    console.error('XLSX library check failed');
                    throw new Error('XLSX library not loaded. Please refresh the page.');
                }
                
                console.log('XLSX library loaded, version:', window.XLSX.version);
                
                let workbook;
                try {
                    workbook = XLSX.read(data, { type: 'array' });
                } catch (xlsxError) {
                    console.error('XLSX.read failed:', xlsxError);
                    throw new Error(`Failed to parse file: ${xlsxError.message}`);
                }
                
                if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
                    throw new Error('No sheets found in file');
                }
                
                // Get first sheet
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
                
                if (!jsonData || jsonData.length === 0) {
                    throw new Error('No data found in sheet');
                }
                
                // Process transactions with optional year correction (now async)
                const fileTransactions = await parseTransactions(jsonData, providedYear);
                
                if (!fileTransactions || fileTransactions.length === 0) {
                    throw new Error('No valid transactions found');
                }
                
                resolve(fileTransactions);
            } catch (error) {
                reject(new Error(`File parsing error: ${error.message}`));
            }
        };
        
        reader.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('Failed to read file'));
        };
        
        reader.onabort = () => {
            clearTimeout(timeout);
            reject(new Error('File reading was aborted'));
        };
        
        try {
            reader.readAsArrayBuffer(file);
        } catch (error) {
            clearTimeout(timeout);
            reject(new Error(`Failed to start reading file: ${error.message}`));
        }
    });
}

function setupMonthFilter() {
    if (!dom.monthFilterButtons) return;
    const monthFilterButtons = dom.monthFilterButtons;
    
    monthFilterButtons.innerHTML = '';
    
    // Load saved selections from localStorage
    loadSavedSelections();
    
    // Get unique months from transactions
    const monthsSet = new Set();
    allTransactions.forEach(t => {
        const monthKey = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
        monthsSet.add(monthKey);
    });
    
    const months = Array.from(monthsSet).sort().reverse(); // Most recent first
    
    // === QUICK PRESETS SECTION ===
    const presetsSection = document.createElement('div');
    presetsSection.className = 'month-filter-presets';
    presetsSection.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
            <h4 style="font-size: 14px; font-weight: 700; color: #1a1a1a; margin: 0;">Quick Presets</h4>
        </div>
    `;
    
    const presetsContainer = document.createElement('div');
    presetsContainer.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px;';
    
    // Define presets
    const presets = [
        { label: 'Q1', tooltip: 'Jan-Mar', months: getQuarterMonths(1, months) },
        { label: 'Q2', tooltip: 'Apr-Jun', months: getQuarterMonths(2, months) },
        { label: 'Q3', tooltip: 'Jul-Sep', months: getQuarterMonths(3, months) },
        { label: 'Q4', tooltip: 'Oct-Dec', months: getQuarterMonths(4, months) },
        { label: 'H1', tooltip: 'First Half', months: getHalfMonths(1, months) },
        { label: 'H2', tooltip: 'Second Half', months: getHalfMonths(2, months) },
        { label: 'Last 3M', tooltip: 'Last 3 Months', months: getLastNMonths(3, months) },
        { label: 'Last 6M', tooltip: 'Last 6 Months', months: getLastNMonths(6, months) },
        { label: 'YTD', tooltip: 'Year to Date', months: getYTDMonths(months) }
    ];
    
    presets.forEach(preset => {
        if (preset.months.length > 0) {
            const btn = document.createElement('button');
            btn.className = 'preset-btn';
            btn.textContent = preset.label;
            btn.title = preset.tooltip;
            btn.onclick = () => applyPreset(preset.months);
            presetsContainer.appendChild(btn);
        }
    });
    
    presetsSection.appendChild(presetsContainer);
    monthFilterButtons.appendChild(presetsSection);
    
    // Separator
    const separator1 = document.createElement('div');
    separator1.style.cssText = 'height: 1px; background: #e5e5e5; margin: 20px 0 16px 0;';
    monthFilterButtons.appendChild(separator1);
    
    // === CONTROL BUTTONS SECTION ===
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'month-filter-controls';
    controlsDiv.style.cssText = 'display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; align-items: center;';
    
    // Add "All Months" button
    const allBtn = document.createElement('button');
    allBtn.className = 'month-btn month-btn-all active';
    allBtn.textContent = 'All Months';
    allBtn.onclick = () => selectAllMonths();
    controlsDiv.appendChild(allBtn);
    
    // Add "Clear Selection" button
    const clearBtn = document.createElement('button');
    clearBtn.className = 'month-btn month-btn-clear';
    clearBtn.textContent = 'Clear Selection';
    clearBtn.style.display = 'none';
    clearBtn.onclick = () => clearMonthSelection();
    controlsDiv.appendChild(clearBtn);
    
    // Add "Save Selection" button
    const saveBtn = document.createElement('button');
    saveBtn.className = 'month-btn month-btn-save';
    saveBtn.innerHTML = '💾 Save';
    saveBtn.style.display = 'none';
    saveBtn.onclick = () => saveCurrentSelection();
    controlsDiv.appendChild(saveBtn);
    
    // Add "Load Saved" button
    const loadBtn = document.createElement('button');
    loadBtn.className = 'month-btn month-btn-load';
    loadBtn.innerHTML = '📂 Load';
    loadBtn.onclick = () => showSavedSelections();
    if (Object.keys(savedSelections).length === 0) {
        loadBtn.style.display = 'none';
    }
    controlsDiv.appendChild(loadBtn);
    
    // Add selection info
    const selectionInfo = document.createElement('span');
    selectionInfo.id = 'monthSelectionInfo';
    selectionInfo.style.cssText = 'display: none; align-items: center; color: #2d7a5f; font-weight: 600; font-size: 14px;';
    selectionInfo.innerHTML = '<span id="selectedMonthCount">0</span> month(s) selected';
    controlsDiv.appendChild(selectionInfo);
    
    monthFilterButtons.appendChild(controlsDiv);
    
    // Add separator
    const separator = document.createElement('div');
    separator.style.cssText = 'height: 1px; background: #e5e5e5; margin: 8px 0;';
    monthFilterButtons.appendChild(separator);
    
    // Add instruction text with examples
    const instruction = document.createElement('div');
    instruction.style.cssText = 'background: #f0f8f5; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; border-left: 3px solid #2d7a5f;';
    instruction.innerHTML = `
        <p style="font-size: 14px; color: #1a1a1a; margin-bottom: 6px; font-weight: 600;">
            📌 Multi-Month Selection Guide:
        </p>
        <ul style="font-size: 13px; color: #4a4a4a; margin: 0; padding-left: 20px; line-height: 1.7;">
            <li><strong>Single Click:</strong> Select one month only</li>
            <li><strong>Ctrl/Cmd + Click:</strong> Select multiple random months (e.g., Jan + Mar + Jun + Dec)</li>
            <li><strong>Quick Presets:</strong> Use Q1, Q2, H1, H2, etc. buttons above for instant selection</li>
            <li><strong>Save:</strong> After selecting, click 💾 Save to store your custom selection</li>
        </ul>
    `;
    monthFilterButtons.appendChild(instruction);
    
    // Add month buttons container
    const monthBtnsContainer = document.createElement('div');
    monthBtnsContainer.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap;';
    monthBtnsContainer.id = 'monthButtonsContainer';
    
    // Add month buttons
    months.forEach(monthKey => {
        const [year, month] = monthKey.split('-');
        const date = new Date(year, parseInt(month) - 1);
        const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        
        const btn = document.createElement('button');
        btn.className = 'month-btn month-btn-selectable';
        btn.textContent = monthName;
        btn.dataset.month = monthKey;
        btn.onclick = (e) => toggleMonthSelection(monthKey, e);
        monthBtnsContainer.appendChild(btn);
    });
    
    monthFilterButtons.appendChild(monthBtnsContainer);
    
    // Store reference to buttons for easy access
    window.monthFilterElements = {
        allBtn,
        clearBtn,
        saveBtn,
        loadBtn,
        selectionInfo,
        countSpan: document.getElementById('selectedMonthCount')
    };
    window.availableMonths = months; // Store for preset calculations
}

// === PRESET HELPER FUNCTIONS ===
function getQuarterMonths(quarter, availableMonths) {
    const quarterMonths = {
        1: ['01', '02', '03'],
        2: ['04', '05', '06'],
        3: ['07', '08', '09'],
        4: ['10', '11', '12']
    };
    
    const targetMonths = quarterMonths[quarter];
    return availableMonths.filter(month => {
        const [year, monthNum] = month.split('-');
        return targetMonths.includes(monthNum);
    });
}

function getHalfMonths(half, availableMonths) {
    const halfMonths = {
        1: ['01', '02', '03', '04', '05', '06'],
        2: ['07', '08', '09', '10', '11', '12']
    };
    
    const targetMonths = halfMonths[half];
    return availableMonths.filter(month => {
        const [year, monthNum] = month.split('-');
        return targetMonths.includes(monthNum);
    });
}

function getLastNMonths(n, availableMonths) {
    return availableMonths.slice(0, n);
}

function getYTDMonths(availableMonths) {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    
    return availableMonths.filter(month => {
        const [year, monthNum] = month.split('-');
        return parseInt(year) === currentYear && parseInt(monthNum) <= currentMonth;
    });
}

function applyPreset(presetMonths) {
    if (presetMonths.length === 0) {
        showNotification('No months available for this preset', 'warning');
        return;
    }
    
    selectedMonths.clear();
    presetMonths.forEach(month => selectedMonths.add(month));
    
    updateMonthFilterUI();
    applyMonthFilter();
    
    showNotification(`Applied preset: ${presetMonths.length} months selected`, 'success');
}

function selectAllMonths() {
    selectedMonths.clear();
    
    const allBtn = document.querySelector('.month-btn-all');
    const clearBtn = document.querySelector('.month-btn-clear');
    const selectionInfo = document.getElementById('monthSelectionInfo');
    
    if (allBtn) allBtn.classList.add('active');
    if (clearBtn) clearBtn.style.display = 'none';
    if (selectionInfo) selectionInfo.style.display = 'none';
    
    document.querySelectorAll('.month-btn-selectable').forEach(btn => {
        btn.classList.remove('active');
    });
    
    transactions = allTransactions;
    updateDashboard();
}

function clearMonthSelection() {
    selectedMonths.clear();
    updateMonthFilterUI();
    selectAllMonths();
}

function toggleMonthSelection(monthKey, event) {
    // Check if Ctrl/Cmd key is pressed for multi-select
    const isMultiSelect = event.ctrlKey || event.metaKey;
    
    if (!isMultiSelect && selectedMonths.size > 0) {
        // Single click without Ctrl - clear previous and select this one
        selectedMonths.clear();
    }
    
    // Toggle the clicked month
    if (selectedMonths.has(monthKey)) {
        selectedMonths.delete(monthKey);
    } else {
        selectedMonths.add(monthKey);
    }
    
    // If no months selected, show all
    if (selectedMonths.size === 0) {
        selectAllMonths();
        return;
    }
    
    // Show helpful tooltip for first multi-selection
    if (selectedMonths.size === 1 && isMultiSelect && !sessionStorage.getItem('multiMonthTipShown')) {
        showNotification('Keep holding Ctrl/Cmd to select more months!', 'info');
        sessionStorage.setItem('multiMonthTipShown', 'true');
    }
    
    updateMonthFilterUI();
    applyMonthFilter();
}

function updateMonthFilterUI() {
    const allBtn = document.querySelector('.month-btn-all');
    const clearBtn = document.querySelector('.month-btn-clear');
    const saveBtn = document.querySelector('.month-btn-save');
    const selectionInfo = document.getElementById('monthSelectionInfo');
    const countSpan = document.getElementById('selectedMonthCount');
    
    // Update All button
    if (allBtn) {
        allBtn.classList.toggle('active', selectedMonths.size === 0);
    }
    
    // Update Clear, Save buttons and selection info
    if (selectedMonths.size > 0) {
        if (clearBtn) clearBtn.style.display = 'inline-block';
        if (saveBtn) saveBtn.style.display = 'inline-block';
        if (selectionInfo) {
            selectionInfo.style.display = 'flex';
            if (countSpan) countSpan.textContent = selectedMonths.size;
        }
    } else {
        if (clearBtn) clearBtn.style.display = 'none';
        if (saveBtn) saveBtn.style.display = 'none';
        if (selectionInfo) selectionInfo.style.display = 'none';
    }
    
    // Update month buttons
    document.querySelectorAll('.month-btn-selectable').forEach(btn => {
        const monthKey = btn.dataset.month;
        if (selectedMonths.has(monthKey)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}
    
function applyMonthFilter() {
    if (selectedMonths.size === 0) {
        transactions = allTransactions;
    } else {
        transactions = allTransactions.filter(t => {
            const monthKey = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
            return selectedMonths.has(monthKey);
        });
    }
    
    updateDashboard();
}

// === SAVE/LOAD FUNCTIONALITY ===
function saveCurrentSelection() {
    if (selectedMonths.size === 0) {
        showNotification('No months selected to save', 'warning');
        return;
    }
    
    const selectionName = prompt('Enter a name for this selection:');
    if (!selectionName || selectionName.trim() === '') {
        return;
    }
    
    const trimmedName = selectionName.trim();
    const selectionData = {
        name: trimmedName,
        months: Array.from(selectedMonths),
        savedAt: new Date().toISOString()
    };
    
    savedSelections[trimmedName] = selectionData;
    saveSavedSelections();
    
    // Show/update Load button
    const loadBtn = document.querySelector('.month-btn-load');
    if (loadBtn) loadBtn.style.display = 'inline-block';
    
    showNotification(`Selection "${trimmedName}" saved successfully!`, 'success');
}

function loadSavedSelections() {
    try {
        const saved = localStorage.getItem('monthSelections');
        if (saved) {
            savedSelections = JSON.parse(saved);
        }
    } catch (error) {
        console.error('Error loading saved selections:', error);
        savedSelections = {};
    }
}

function saveSavedSelections() {
    try {
        localStorage.setItem('monthSelections', JSON.stringify(savedSelections));
    } catch (error) {
        console.error('Error saving selections:', error);
        showNotification('Failed to save selection', 'error');
    }
}

function showSavedSelections() {
    const selections = Object.values(savedSelections);
    
    if (selections.length === 0) {
        showNotification('No saved selections yet', 'info');
        return;
    }
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'saved-selections-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        backdrop-filter: blur(4px);
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        border-radius: 16px;
        padding: 32px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    `;
    
    modalContent.innerHTML = `
        <h3 style="font-size: 24px; font-weight: 700; margin-bottom: 20px; color: #1a1a1a;">Saved Selections</h3>
        <div id="savedSelectionsList"></div>
        <div style="margin-top: 24px; display: flex; gap: 12px; justify-content: flex-end;">
            <button class="btn-outline" id="closeSavedModal">Close</button>
        </div>
    `;
    
    const list = modalContent.querySelector('#savedSelectionsList');
    
    selections.forEach(selection => {
        const item = document.createElement('div');
        item.style.cssText = `
            padding: 16px;
            border: 2px solid #e5e5e5;
            border-radius: 12px;
            margin-bottom: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: all 0.2s;
        `;
        
        item.innerHTML = `
            <div>
                <div style="font-weight: 600; font-size: 16px; color: #1a1a1a; margin-bottom: 4px;">${escapeHtml(selection.name)}</div>
                <div style="font-size: 13px; color: #6a6a6a;">${selection.months.length} months • Saved ${formatSaveDate(selection.savedAt)}</div>
            </div>
            <div style="display: flex; gap: 8px;">
                <button class="btn-primary" style="padding: 8px 16px; font-size: 14px;" data-action="load" data-name="${escapeHtml(selection.name)}">Load</button>
                <button class="btn-outline" style="padding: 8px 16px; font-size: 14px; color: #dc2626; border-color: #fecaca;" data-action="delete" data-name="${escapeHtml(selection.name)}">Delete</button>
            </div>
        `;
        
        list.appendChild(item);
    });
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Event delegation for buttons
    modalContent.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        
        const action = btn.dataset.action;
        const name = btn.dataset.name;
        
        if (action === 'load') {
            loadSelection(name);
            document.body.removeChild(modal);
        } else if (action === 'delete') {
            if (confirm(`Delete selection "${name}"?`)) {
                delete savedSelections[name];
                saveSavedSelections();
                
                // Refresh modal
                document.body.removeChild(modal);
                showSavedSelections();
                
                // Hide Load button if no selections left
                if (Object.keys(savedSelections).length === 0) {
                    const loadBtn = document.querySelector('.month-btn-load');
                    if (loadBtn) loadBtn.style.display = 'none';
                }
                
                showNotification(`Selection "${name}" deleted`, 'info');
            }
        }
    });
    
    // Close modal
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
    
    modalContent.querySelector('#closeSavedModal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
}

function loadSelection(name) {
    const selection = savedSelections[name];
    if (!selection) {
        showNotification('Selection not found', 'error');
        return;
    }
    
    selectedMonths.clear();
    selection.months.forEach(month => selectedMonths.add(month));
    
    updateMonthFilterUI();
    applyMonthFilter();
    
    showNotification(`Loaded "${name}" (${selection.months.length} months)`, 'success');
}

function formatSaveDate(isoDate) {
    try {
        const date = new Date(isoDate);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (error) {
        return 'recently';
    }
}

// === RECURRING PAYMENTS DETECTION ===
function detectRecurringPayments() {
    // Cache recurring payments for performance
    const currentHash = generateTransactionsHash();
    if (cachedRecurringPayments && lastTransactionsHash === currentHash) {
        return cachedRecurringPayments;
    }
    
    const expenseTransactions = transactions.filter(t => t.type === 'expense');
    
    // Group by similar descriptions and amounts
    const potentialRecurring = {};
    
    expenseTransactions.forEach(transaction => {
        // Normalize description (remove numbers, dates, common variations)
        const normalizedDesc = normalizeDescription(transaction.description);
        const amountKey = Math.round(Math.abs(transaction.amount) * 100); // Cents precision
        const key = `${normalizedDesc}_${amountKey}`;
        
        if (!potentialRecurring[key]) {
            potentialRecurring[key] = {
                description: transaction.description,
                normalizedDesc: normalizedDesc,
                amount: Math.abs(transaction.amount),
                category: transaction.category,
                occurrences: [],
                dates: []
            };
        }
        
        potentialRecurring[key].occurrences.push(transaction);
        potentialRecurring[key].dates.push(transaction.date);
    });
    
    // Filter for recurring (appears 2+ times)
    const recurring = Object.values(potentialRecurring)
        .filter(item => item.occurrences.length >= 2)
        .map(item => {
            // Calculate average interval
            const sortedDates = item.dates.sort((a, b) => a - b);
            const intervals = [];
            
            for (let i = 1; i < sortedDates.length; i++) {
                const diffDays = Math.round((sortedDates[i] - sortedDates[i-1]) / (1000 * 60 * 60 * 24));
                intervals.push(diffDays);
            }
            
            const avgInterval = intervals.length > 0 
                ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length)
                : 0;
            
            // Determine frequency
            let frequency = 'Irregular';
            if (avgInterval >= 25 && avgInterval <= 35) frequency = 'Monthly';
            else if (avgInterval >= 12 && avgInterval <= 17) frequency = 'Bi-weekly';
            else if (avgInterval >= 6 && avgInterval <= 8) frequency = 'Weekly';
            else if (avgInterval >= 85 && avgInterval <= 95) frequency = 'Quarterly';
            else if (avgInterval >= 350 && avgInterval <= 370) frequency = 'Yearly';
            
            return {
                description: item.description,
                amount: item.amount,
                category: item.category,
                count: item.occurrences.length,
                frequency: frequency,
                avgInterval: avgInterval,
                lastDate: sortedDates[sortedDates.length - 1],
                totalSpent: item.amount * item.occurrences.length
            };
        })
        .sort((a, b) => b.totalSpent - a.totalSpent);
    
    // Cache result
    cachedRecurringPayments = recurring;
    lastTransactionsHash = currentHash;
    
    return recurring;
}

function generateTransactionsHash() {
    if (!transactions || transactions.length === 0) return 'empty';
    const count = transactions.length;
    const totalAmount = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    return `${count}-${totalAmount.toFixed(2)}`;
}

function normalizeDescription(description) {
    return description
        .toLowerCase()
        .replace(/\d+/g, '') // Remove numbers
        .replace(/[^\w\s]/g, '') // Remove special characters
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim()
        .substring(0, 50); // Limit length
}

function updateRecurringPayments() {
    if (!dom.recurringPaymentsSection) return;
    
    const recurring = detectRecurringPayments();
    
    if (recurring.length === 0) {
        dom.recurringPaymentsSection.style.display = 'none';
        return;
    }
    
    dom.recurringPaymentsSection.style.display = 'block';
    window.allRecurringPayments = recurring;
    
    const totalRecurringSpend = recurring.reduce((sum, r) => sum + r.totalSpent, 0);
    
    if (dom.recurringCount) dom.recurringCount.textContent = recurring.length;
    if (dom.recurringSpend) dom.recurringSpend.textContent = formatCurrency(totalRecurringSpend);
    if (dom.recurringTotalCount) dom.recurringTotalCount.textContent = recurring.length;
    
    // Initialize search functionality
    initializeRecurringSearch();
    
    // Display all payments initially
    displayRecurringPayments(recurring);
}

function displayRecurringPayments(paymentsToShow) {
    if (!dom.recurringPaymentsList) return;
    
    if (paymentsToShow.length === 0) {
        dom.recurringPaymentsList.style.display = 'none';
        if (dom.recurringNoResults) dom.recurringNoResults.style.display = 'block';
        return;
    }
    
    dom.recurringPaymentsList.style.display = 'flex';
    if (dom.recurringNoResults) dom.recurringNoResults.style.display = 'none';
    
    // Use DocumentFragment for batch updates
    const fragment = document.createDocumentFragment();
    
    paymentsToShow.forEach(payment => {
        const item = document.createElement('div');
        item.className = 'recurring-payment-item';
        
        const frequencyIcon = getFrequencyIcon(payment.frequency);
        const lastDateFormatted = formatDate(payment.lastDate);
        
        item.innerHTML = `
            <div class="recurring-icon">${frequencyIcon}</div>
            <div class="recurring-details">
                <div class="recurring-name">${escapeHtml(payment.description)}</div>
                <div class="recurring-meta">
                    <span class="recurring-frequency">${payment.frequency}</span>
                    <span class="recurring-separator">•</span>
                    <span class="recurring-category">${payment.category}</span>
                    <span class="recurring-separator">•</span>
                    <span class="recurring-occurrences">${payment.count}x occurrences</span>
                    <span class="recurring-separator">•</span>
                    <span class="recurring-last-date">Last: ${lastDateFormatted}</span>
                </div>
            </div>
            <div class="recurring-amounts">
                <div class="recurring-amount">${formatCurrency(payment.amount)}</div>
                <div class="recurring-total">Total: ${formatCurrency(payment.totalSpent)}</div>
            </div>
        `;
        
        fragment.appendChild(item);
    });
    
    // Batch update
    dom.recurringPaymentsList.innerHTML = '';
    dom.recurringPaymentsList.appendChild(fragment);
}

function initializeRecurringSearch() {
    if (!dom.recurringSearchInput || window.recurringSearchInitialized) return;
    
    window.recurringSearchInitialized = true;
    
    // Debounce search for better performance
    const debouncedSearch = debounce((query) => {
        if (query.length > 0) {
            performRecurringSearch(query);
        } else {
            if (dom.recurringSearchInfo) dom.recurringSearchInfo.style.display = 'none';
            displayRecurringPayments(window.allRecurringPayments || []);
        }
    }, 300);
    
    // Search on input
    dom.recurringSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        if (query.length > 0) {
            if (dom.recurringSearchClear) dom.recurringSearchClear.style.display = 'flex';
        } else {
            if (dom.recurringSearchClear) dom.recurringSearchClear.style.display = 'none';
        }
        
        debouncedSearch(query);
    });
    
    // Clear search
    if (dom.recurringSearchClear) {
        dom.recurringSearchClear.addEventListener('click', () => {
            dom.recurringSearchInput.value = '';
            dom.recurringSearchClear.style.display = 'none';
            if (dom.recurringSearchInfo) dom.recurringSearchInfo.style.display = 'none';
            displayRecurringPayments(window.allRecurringPayments || []);
            dom.recurringSearchInput.focus();
        });
    }
    
    // Focus on Ctrl+F or Cmd+F
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'f' && 
            dom.recurringPaymentsSection && dom.recurringPaymentsSection.style.display !== 'none') {
            e.preventDefault();
            dom.recurringSearchInput.focus();
        }
    });
}

// Debounce function for search performance
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

function performRecurringSearch(query) {
    const allPayments = window.allRecurringPayments || [];
    const searchTerm = query.toLowerCase();
    
    const filtered = allPayments.filter(payment => {
        const desc = payment.description.toLowerCase();
        const category = payment.category.toLowerCase();
        const frequency = payment.frequency.toLowerCase();
        
        return desc.includes(searchTerm) || 
               category.includes(searchTerm) || 
               frequency.includes(searchTerm);
    });
    
    if (dom.recurringSearchInfo && dom.recurringSearchCount) {
        dom.recurringSearchCount.textContent = filtered.length;
        dom.recurringSearchInfo.style.display = 'block';
    }
    
    displayRecurringPayments(filtered);
}

function getFrequencyIcon(frequency) {
    const icons = {
        'Monthly': '📅',
        'Bi-weekly': '📆',
        'Weekly': '🔄',
        'Quarterly': '📊',
        'Yearly': '🗓️',
        'Irregular': '🔀'
    };
    return icons[frequency] || '💳';
}

// === SAVINGS OPTIMIZER ===

// Calculate expense breakdown: essential vs cuttable
function calculateExpenseBreakdown(totalIncome, totalExpenses) {
    const expenseTransactions = transactions.filter(t => t.type === 'expense');
    
    let essentialExpenses = 0;
    let cuttableExpenses = 0;
    
    expenseTransactions.forEach(t => {
        const desc = t.description.toLowerCase();
        const amount = Math.abs(t.amount);
        
        // Check if this is an essential/non-cuttable transaction
        const isEssential = 
            desc.includes('transfer') ||
            desc.includes('discover') ||
            desc.includes('zelle') ||
            desc.includes('amex') ||
            desc.includes('american express') ||
            desc.includes('atm withdrawal') ||
            desc.includes('atm') ||
            desc.includes('apple card') ||
            desc.includes('gsbank');
        
        if (isEssential) {
            essentialExpenses += amount;
        } else {
            cuttableExpenses += amount;
        }
    });
    
    return {
        essential: essentialExpenses,
        cuttable: cuttableExpenses,
        total: totalExpenses
    };
}

// Calculate the maximum possible savings rate based on all cuttable expenses
function calculateMaximumSavingsRate(totalIncome, totalExpenses) {
    if (totalIncome <= 0) return 0;
    
    // Get all cuttable expenses (same logic as optimizer)
    const cuttableExpenses = transactions
        .filter(t => {
            if (t.type !== 'expense') return false;
            
            const desc = t.description.toLowerCase();
            
            // Exclude essential/non-cuttable transactions
            if (desc.includes('transfer')) return false;
            if (desc.includes('discover')) return false;
            if (desc.includes('zelle')) return false;
            if (desc.includes('amex')) return false;
            if (desc.includes('american express')) return false;
            if (desc.includes('atm withdrawal')) return false;
            if (desc.includes('atm')) return false;
            if (desc.includes('apple card')) return false;
            if (desc.includes('gsbank')) return false;
            
            return true;
        });
    
    // Calculate total amount of cuttable expenses
    const totalCuttableExpenses = cuttableExpenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    // Maximum savings = current savings + all cuttable expenses
    const currentSavings = totalIncome - totalExpenses;
    const maxPossibleSavings = currentSavings + totalCuttableExpenses;
    const maxSavingsRate = (maxPossibleSavings / totalIncome) * 100;
    
    // Cap at 100%
    return Math.min(maxSavingsRate, 100);
}

// Update slider max indicator position
function updateSliderMaxIndicator(maxRate) {
    const indicator = document.getElementById('sliderMaxIndicator');
    if (!indicator) return;
    
    // Convert max rate to slider position (10% to 90% range)
    const sliderMin = 10;
    const sliderMax = 90;
    const clampedMax = Math.min(Math.max(maxRate, sliderMin), sliderMax);
    const percentage = ((clampedMax - sliderMin) / (sliderMax - sliderMin)) * 100;
    
    indicator.style.left = `${percentage}%`;
}

// Update slider hint text based on target feasibility
function updateSliderHint(target, maxRate, currentRate) {
    const hintElement = document.getElementById('sliderHint');
    const hintText = document.getElementById('sliderHintText');
    if (!hintElement || !hintText) return;
    
    // Remove all classes
    hintElement.classList.remove('warning', 'success');
    
    if (target > maxRate) {
        hintElement.classList.add('warning');
        hintText.textContent = `⚠️ Target ${target}% exceeds maximum ${maxRate.toFixed(1)}% - impossible to reach!`;
    } else if (currentRate >= target) {
        hintElement.classList.add('success');
        hintText.textContent = `✓ You're already at ${currentRate.toFixed(1)}% - above your ${target}% target!`;
    } else {
        hintText.textContent = `Target ${target}% is achievable. Maximum possible: ${maxRate.toFixed(1)}%`;
    }
}

function removeOptimizerTransaction(transactionId) {
    removedOptimizerTransactions.add(transactionId);
    
    // Recalculate optimizer
    const income = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
    const expenses = Math.abs(transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0));
    
    updateSavingsOptimizer(income, expenses);
    
    if (typeof showNotification === 'function') {
        showNotification('Transaction removed from recommendations', 'success');
    }
}

function updateSavingsOptimizer(totalIncome, totalExpenses) {
    const savingsOptimizerSection = document.getElementById('savingsOptimizerSection');
    if (!savingsOptimizerSection) return;
    
    // Only show optimizer if there's income
    if (totalIncome <= 0) {
        savingsOptimizerSection.style.display = 'none';
        maxOptimizerRecommendations = 0; // Reset since optimizer is hidden
        return;
    }
    
    const currentSavingsRate = ((totalIncome - totalExpenses) / totalIncome) * 100;
    
    // Calculate maximum possible savings rate
    const maxPossibleSavingsRate = calculateMaximumSavingsRate(totalIncome, totalExpenses);
    
    // Update target savings rate display in header and subtitle
    const targetRateDisplay = document.getElementById('targetSavingsRateDisplay');
    const targetRateSubtitle = document.getElementById('targetSavingsRateSubtitle');
    if (targetRateDisplay) targetRateDisplay.textContent = targetSavingsRate;
    if (targetRateSubtitle) targetRateSubtitle.textContent = targetSavingsRate;
    
    // Update current rate display
    const currentRateElement = document.getElementById('currentSavingsRate');
    if (currentRateElement) {
        currentRateElement.textContent = currentSavingsRate.toFixed(1) + '%';
    }
    
    // Update maximum rate display
    const maxRateElement = document.getElementById('maxSavingsRate');
    if (maxRateElement) {
        maxRateElement.textContent = maxPossibleSavingsRate.toFixed(1) + '%';
    }
    
    // Update slider max indicator position
    updateSliderMaxIndicator(maxPossibleSavingsRate);
    
    // Update slider hint based on target vs maximum
    updateSliderHint(targetSavingsRate, maxPossibleSavingsRate, currentSavingsRate);
    
    // Check if target is impossible to reach
    if (targetSavingsRate > maxPossibleSavingsRate) {
        savingsOptimizerSection.style.display = 'block';
        const message = document.getElementById('optimizerMessage');
        if (message) {
            // Calculate expense breakdown to explain why it's impossible
            const expenseBreakdown = calculateExpenseBreakdown(totalIncome, totalExpenses);
            
            message.className = 'optimizer-message warning';
            message.innerHTML = `
                <div style="margin-bottom: 12px;">
                    <strong style="font-size: 16px;">⚠️ Target ${targetSavingsRate}% is Impossible to Reach!</strong>
                </div>
                <div style="margin-bottom: 12px;">
                    <strong>Why:</strong> Your maximum achievable savings rate is only <strong>${maxPossibleSavingsRate.toFixed(1)}%</strong>.
                </div>
                <div style="background: white; padding: 12px; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid #f59e0b;">
                    <div style="font-weight: 700; margin-bottom: 8px; font-size: 14px;">📊 Expense Breakdown:</div>
                    <div style="display: grid; gap: 6px; font-size: 13px;">
                        <div style="display: flex; justify-content: space-between;">
                            <span>💰 Total Income:</span>
                            <strong>${formatCurrency(totalIncome)}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>💸 Total Expenses:</span>
                            <strong>${formatCurrency(totalExpenses)}</strong>
                        </div>
                        <hr style="margin: 4px 0; border: none; border-top: 1px solid #e5e5e5;">
                        <div style="display: flex; justify-content: space-between; color: #ef4444;">
                            <span>🔒 Essential Expenses (Can't Cut):</span>
                            <strong>${formatCurrency(expenseBreakdown.essential)}</strong>
                        </div>
                        <div style="display: flex; justify-content: space-between; color: #22c55e;">
                            <span>✂️ Cuttable Expenses (Can Cut):</span>
                            <strong>${formatCurrency(expenseBreakdown.cuttable)}</strong>
                        </div>
                    </div>
                </div>
                <div style="font-size: 13px; line-height: 1.6;">
                    <strong>Explanation:</strong> Even if you eliminate ALL ${formatCurrency(expenseBreakdown.cuttable)} in cuttable expenses, 
                    you still have ${formatCurrency(expenseBreakdown.essential)} in essential expenses (transfers, account payments, etc.). 
                    This limits your maximum savings to ${maxPossibleSavingsRate.toFixed(1)}%.
                </div>
                <div style="margin-top: 12px; padding: 10px; background: #fef3c7; border-radius: 6px; font-size: 13px;">
                    <strong>💡 Suggestions:</strong> Lower your target to ${maxPossibleSavingsRate.toFixed(0)}% or less, OR increase your income to raise the maximum possible savings rate.
                </div>
            `;
        }
        
        // Show all cuttable expenses anyway
        const needToSave = (totalIncome * (targetSavingsRate / 100)) - (totalIncome - totalExpenses);
        document.getElementById('needToSave').textContent = formatCurrency(needToSave);
        
        // Continue to show recommendations for maximum possible
        // Fall through to show all cuttable transactions
    }
    // Check if already at or above target
    else if (currentSavingsRate >= targetSavingsRate) {
        savingsOptimizerSection.style.display = 'block';
        const message = document.getElementById('optimizerMessage');
        if (message) {
            message.className = 'optimizer-message';
            message.innerHTML = `🎉 <strong>Congratulations!</strong> You're already saving ${currentSavingsRate.toFixed(1)}% of your income! Keep up the great work!`;
        }
        document.getElementById('optimizerRecommendations').innerHTML = '';
        document.getElementById('needToSave').textContent = '$0.00';
        maxOptimizerRecommendations = 0; // Reset since no recommendations needed
        return;
    }
    
    // Calculate how much needs to be saved to reach target%
    const targetSavings = totalIncome * (targetSavingsRate / 100);
    const currentSavings = totalIncome - totalExpenses;
    const needToSave = targetSavings - currentSavings;
    
    // Update need to save display
    const needToSaveElement = document.getElementById('needToSave');
    if (needToSaveElement) {
        needToSaveElement.textContent = formatCurrency(needToSave);
    }
    
    savingsOptimizerSection.style.display = 'block';
    
    // Get all expense transactions and sort by amount (highest first)
    // Exclude Transfer, Discover E payments, Zelle, Amex, ATM Withdrawals, and Apple Card transactions
    const expenseTransactions = transactions
        .filter(t => {
            if (t.type !== 'expense') return false;
            
            // Create unique transaction ID
            const transactionId = `${t.date.getTime()}_${t.description}_${t.amount}`;
            
            // Exclude manually removed transactions
            if (removedOptimizerTransactions.has(transactionId)) return false;
            
            const desc = t.description.toLowerCase();
            
            // Exclude transactions related to Transfer, Discover E payments, Zelle, Amex, ATM Withdrawals, and Apple Card
            if (desc.includes('transfer')) return false;
            if (desc.includes('discover')) return false;
            if (desc.includes('zelle')) return false;
            if (desc.includes('amex')) return false;
            if (desc.includes('american express')) return false;
            if (desc.includes('atm withdrawal')) return false;
            if (desc.includes('atm')) return false;
            if (desc.includes('apple card')) return false;
            if (desc.includes('gsbank')) return false;
            
            return true;
        })
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    
    // Find combinations of transactions to cut
    // Determine if this is the initial calculation (no removals yet)
    const isInitialCalculation = removedOptimizerTransactions.size === 0;
    
    const recommendations = [];
    let cumulativeSavings = 0;
    
    for (const transaction of expenseTransactions) {
        // For initial calculation: add transactions until we meet the goal
        // After removals: limit to the initial count to prevent adding replacements
        if (isInitialCalculation) {
            if (cumulativeSavings >= needToSave && recommendations.length > 0) break;
        } else {
            // Don't show more recommendations than initially shown
            if (recommendations.length >= maxOptimizerRecommendations) break;
        }
        
        const transactionAmount = Math.abs(transaction.amount);
        cumulativeSavings += transactionAmount;
        const percentageOfIncome = (transactionAmount / totalIncome) * 100;
        
        // Create unique transaction ID
        const transactionId = `${transaction.date.getTime()}_${transaction.description}_${transaction.amount}`;
        
        recommendations.push({
            id: transactionId,
            description: transaction.description,
            category: transaction.category,
            amount: transactionAmount,
            date: transaction.date,
            percentageOfIncome: percentageOfIncome,
            cumulativeSavings: cumulativeSavings,
            newSavingsRate: ((currentSavings + cumulativeSavings) / totalIncome) * 100
        });
    }
    
    // Store the initial recommendation count
    if (isInitialCalculation && recommendations.length > 0) {
        maxOptimizerRecommendations = recommendations.length;
    }
    
    displayOptimizerRecommendations(recommendations, needToSave, totalIncome, currentSavingsRate);
}

function displayOptimizerRecommendations(recommendations, needToSave, totalIncome, currentSavingsRate) {
    const recommendationsContainer = document.getElementById('optimizerRecommendations');
    const messageContainer = document.getElementById('optimizerMessage');
    
    if (!recommendationsContainer) return;
    
    // Show message
    if (messageContainer) {
        messageContainer.className = 'optimizer-message warning';
        let message = `⚠️ You need to reduce expenses by <strong>${formatCurrency(needToSave)}</strong> to reach a ${targetSavingsRate}% savings rate.`;
        
        if (removedOptimizerTransactions.size > 0) {
            message += ` <em>(${removedOptimizerTransactions.size} transaction${removedOptimizerTransactions.size > 1 ? 's' : ''} hidden)</em>`;
        }
        
        message += ` Here are the recommended cuts:`;
        messageContainer.innerHTML = message;
    }
    
    // Create recommendation items
    const fragment = document.createDocumentFragment();
    const INITIAL_ITEMS_TO_SHOW = 10;
    
    recommendations.forEach((rec, index) => {
        const item = document.createElement('div');
        item.className = 'optimizer-item';
        item.dataset.transactionId = rec.id;
        
        // Hide items after the 10th one initially
        if (index >= INITIAL_ITEMS_TO_SHOW) {
            item.classList.add('optimizer-item-hidden');
        }
        
        const isEnough = rec.cumulativeSavings >= needToSave;
        
        item.innerHTML = `
            <div class="optimizer-rank">#${index + 1}</div>
            <div class="optimizer-details">
                <div class="optimizer-name">${escapeHtml(rec.description)}</div>
                <div class="optimizer-meta">
                    <span class="optimizer-category">${rec.category}</span>
                    <span class="recurring-separator">•</span>
                    <span class="optimizer-date">${formatDate(rec.date)}</span>
                </div>
            </div>
            <div class="optimizer-amounts">
                <div class="optimizer-amount">${formatCurrency(rec.amount)}</div>
                <div class="optimizer-percentage">${rec.percentageOfIncome.toFixed(1)}% of income</div>
            </div>
            <button class="optimizer-remove-btn" title="Remove from recommendations">✕</button>
        `;
        
        // Highlight the final item needed to reach goal
        if (isEnough && (index === 0 || recommendations[index - 1].cumulativeSavings < needToSave)) {
            item.style.border = '2px solid #22c55e';
            item.style.background = '#f0fdf4';
        }
        
        fragment.appendChild(item);
    });
    
    recommendationsContainer.innerHTML = '';
    
    // Add reset button if there are removed transactions
    if (removedOptimizerTransactions.size > 0) {
        const resetDiv = document.createElement('div');
        resetDiv.style.cssText = 'margin-bottom: 16px; text-align: right;';
        resetDiv.innerHTML = `
            <button class="btn-outline" id="resetOptimizerBtn" style="font-size: 14px; padding: 8px 16px;">
                🔄 Show All Removed (${removedOptimizerTransactions.size})
            </button>
        `;
        recommendationsContainer.appendChild(resetDiv);
    }
    
    recommendationsContainer.appendChild(fragment);
    
    // Add "Read More" button if there are more than 10 recommendations
    if (recommendations.length > INITIAL_ITEMS_TO_SHOW) {
        const readMoreDiv = document.createElement('div');
        readMoreDiv.style.cssText = 'margin: 20px 0; text-align: center;';
        readMoreDiv.innerHTML = `
            <button class="btn-primary" id="optimizerReadMoreBtn" style="padding: 12px 32px; font-size: 15px;">
                📖 Read More (${recommendations.length - INITIAL_ITEMS_TO_SHOW} more)
            </button>
        `;
        recommendationsContainer.appendChild(readMoreDiv);
        
        // Add event listener to Read More button
        const readMoreBtn = document.getElementById('optimizerReadMoreBtn');
        if (readMoreBtn) {
            let isExpanded = false;
            readMoreBtn.addEventListener('click', () => {
                const hiddenItems = recommendationsContainer.querySelectorAll('.optimizer-item-hidden');
                
                if (!isExpanded) {
                    // Expand - show all items
                    hiddenItems.forEach(item => {
                        item.classList.remove('optimizer-item-hidden');
                        item.classList.add('optimizer-item-visible');
                    });
                    readMoreBtn.innerHTML = '📕 Show Less';
                    isExpanded = true;
                } else {
                    // Collapse - hide items after 10th
                    const allItems = recommendationsContainer.querySelectorAll('.optimizer-item');
                    allItems.forEach((item, index) => {
                        if (index >= INITIAL_ITEMS_TO_SHOW) {
                            item.classList.remove('optimizer-item-visible');
                            item.classList.add('optimizer-item-hidden');
                        }
                    });
                    readMoreBtn.innerHTML = `📖 Read More (${recommendations.length - INITIAL_ITEMS_TO_SHOW} more)`;
                    isExpanded = false;
                    
                    // Scroll to the optimizer section for better UX
                    const savingsOptimizerSection = document.getElementById('savingsOptimizerSection');
                    if (savingsOptimizerSection) {
                        savingsOptimizerSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            });
        }
    }
    
    // Add event listeners to remove buttons
    recommendationsContainer.querySelectorAll('.optimizer-remove-btn').forEach(btn => {
        // Use { once: true } to ensure the listener only fires once and then is automatically removed
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Get transaction ID from the parent item's dataset
            const item = e.currentTarget.closest('.optimizer-item');
            const transactionId = item ? item.dataset.transactionId : null;
            if (transactionId) {
                removeOptimizerTransaction(transactionId);
            }
        }, { once: true });
    });
    
    // Add event listener to reset button
    // Clone and replace the button to remove any existing event listeners
    const resetBtn = document.getElementById('resetOptimizerBtn');
    if (resetBtn) {
        const newResetBtn = resetBtn.cloneNode(true);
        resetBtn.parentNode.replaceChild(newResetBtn, resetBtn);
        
        newResetBtn.addEventListener('click', () => {
            removedOptimizerTransactions.clear();
            maxOptimizerRecommendations = 0; // Reset the max count for fresh calculation
            const income = transactions
                .filter(t => t.type === 'income')
                .reduce((sum, t) => sum + t.amount, 0);
            const expenses = Math.abs(transactions
                .filter(t => t.type === 'expense')
                .reduce((sum, t) => sum + t.amount, 0));
            updateSavingsOptimizer(income, expenses);
            showNotification('All transactions restored to optimizer', 'success');
        });
    }
    
    // Add summary
    if (recommendations.length > 0) {
        const lastRec = recommendations[recommendations.length - 1];
        const totalToCut = lastRec.cumulativeSavings;
        const finalSavingsRate = lastRec.newSavingsRate;
        
        const summary = document.createElement('div');
        summary.className = 'optimizer-summary';
        summary.innerHTML = `
            <h4>✂️ Summary: Cut These ${recommendations.length} Transaction${recommendations.length !== 1 ? 's' : ''}</h4>
            <div class="optimizer-summary-stats">
                <div class="optimizer-summary-stat">
                    <div class="optimizer-summary-label">Total to Cut</div>
                    <div class="optimizer-summary-value">${formatCurrency(totalToCut)}</div>
                </div>
                <div class="optimizer-summary-stat">
                    <div class="optimizer-summary-label">New Savings Rate</div>
                    <div class="optimizer-summary-value">${finalSavingsRate.toFixed(1)}%</div>
                </div>
                <div class="optimizer-summary-stat">
                    <div class="optimizer-summary-label">Improvement</div>
                    <div class="optimizer-summary-value">+${(finalSavingsRate - currentSavingsRate).toFixed(1)}%</div>
                </div>
            </div>
        `;
        
        recommendationsContainer.appendChild(summary);
    }
}

function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        selectedFiles = [...selectedFiles, ...files];
        displayFileList();
        if (dom.fileInput) dom.fileInput.value = '';
    }
}

async function parseTransactions(data, providedYear = null) {
    console.log('parseTransactions called with:', {
        rowCount: data?.length,
        providedYear: providedYear,
        firstRow: data?.[0]
    });
    
    if (!data || data.length < 2) {
        console.warn('Insufficient data rows for parsing');
        return [];
    }
    
    const transactions = [];
    let skippedRows = 0;
    const headers = data[0].map(h => String(h || '').toLowerCase());
    console.log('Parsed headers:', headers);
    
    // Find column indices
    const dateCol = findColumnIndex(headers, ['date', 'transaction date', 'posting date']);
    const descCol = findColumnIndex(headers, ['description', 'memo', 'details', 'transaction', 'narration']);
    const amountCol = findColumnIndex(headers, ['amount', 'debit', 'credit', 'value']);
    const balanceCol = findColumnIndex(headers, ['balance', 'running balance', 'available balance']);
    
    // Alternative: look for credit/debit columns separately
    const creditCol = findColumnIndex(headers, ['credit', 'deposit', 'cr']);
    const debitCol = findColumnIndex(headers, ['debit', 'withdrawal', 'dr']);
    
    // Log detected columns
    console.log('Column detection:', {
        dateCol, descCol, amountCol, balanceCol, creditCol, debitCol
    });
    
    // Validate required columns
    if (dateCol === -1) {
        console.error('Date column not found in headers:', headers);
        throw new Error('Could not find date column in file. Expected headers: "date", "transaction date", or "posting date"');
    }
    
    if (descCol === -1) {
        console.warn('Description column not found, using default');
    }
    
    if (amountCol === -1 && (creditCol === -1 || debitCol === -1)) {
        console.error('Amount columns not found in headers:', headers);
        throw new Error('Could not find amount column in file. Expected headers: "amount", "debit/credit", or "value"');
    }
    
    // Process each row (skip header)
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;
        
        let date = row[dateCol] || '';
        let description = row[descCol] || 'Unknown Transaction';
        let amount = 0;
        let balance = row[balanceCol] || 0;
        
        // Parse amount
        if (creditCol !== -1 && debitCol !== -1) {
            const credit = parseAmount(row[creditCol]);
            const debit = parseAmount(row[debitCol]);
            amount = credit - debit;
        } else if (amountCol !== -1) {
            amount = parseAmount(row[amountCol]);
        }
        
        // Skip if no valid amount
        if (amount === 0) {
            skippedRows++;
            continue;
        }
        
        // Parse date
        if (typeof date === 'number') {
            // Excel date number
            date = excelDateToJSDate(date);
        } else {
            date = new Date(date);
        }
        
        // Skip invalid dates
        if (isNaN(date.getTime())) {
            skippedRows++;
            continue;
        }
        
        // Apply year correction if provided
        if (providedYear !== null) {
            // Keep the original month and day, but replace the year
            const month = date.getMonth();
            const day = date.getDate();
            date = new Date(providedYear, month, day);
        }
        
        // Categorize transaction (now async)
        const categorizationResult = await categorizeTransaction(description, amount);
        
        transactions.push({
            date: date,
            description: String(description).trim(),
            amount: amount,
            balance: parseAmount(balance),
            category: categorizationResult.category || categorizationResult,
            isLearned: categorizationResult.isLearned || false,
            confidence: categorizationResult.confidence || 0.5,
            source: categorizationResult.source || 'unknown',
            type: amount > 0 ? 'income' : 'expense'
        });
    }
    
    // Sort by date (newest first)
    transactions.sort((a, b) => b.date - a.date);
    
    // Log parsing results
    const autoCategorized = transactions.filter(t => t.isLearned && t.source === 'database').length;
    console.log(`Parsed ${transactions.length} transactions (${autoCategorized} auto-categorized from database), skipped ${skippedRows} invalid rows`);
    
    // Update UI counter if element exists
    const autoCategorizd = document.getElementById('autoCategorizd');
    if (autoCategorizd) {
        autoCategorizd.textContent = autoCategorized;
    }
    
    return transactions;
}

function findColumnIndex(headers, possibilities) {
    for (let possibility of possibilities) {
        const index = headers.findIndex(h => h.includes(possibility));
        if (index !== -1) return index;
    }
    return -1;
}

function parseAmount(value) {
    if (value === null || value === undefined || value === '') return 0;
    
    // Remove currency symbols and commas
    const cleaned = String(value).replace(/[$,₹€£]/g, '').trim();
    
    // Handle parentheses (negative numbers)
    if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
        return -parseFloat(cleaned.replace(/[()]/g, '')) || 0;
    }
    
    return parseFloat(cleaned) || 0;
}

function excelDateToJSDate(excelDate) {
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    return date;
}

// ========================================
// CATEGORIZATION LEARNING SYSTEM
// ========================================

// Load learned categorizations from localStorage
function loadLearnedCategorizations() {
    try {
        const saved = localStorage.getItem('learnedCategorizations');
        if (saved) {
            const parsed = JSON.parse(saved);
            learnedCategorizations = new Map(Object.entries(parsed));
            console.log(`Loaded ${learnedCategorizations.size} learned categorization patterns`);
        }
    } catch (error) {
        console.error('Error loading learned categorizations:', error);
        learnedCategorizations = new Map();
    }
}

// Save learned categorizations to localStorage
function saveLearnedCategorizations() {
    try {
        const obj = Object.fromEntries(learnedCategorizations);
        localStorage.setItem('learnedCategorizations', JSON.stringify(obj));
        console.log(`Saved ${learnedCategorizations.size} learned categorization patterns`);
    } catch (error) {
        console.error('Error saving learned categorizations:', error);
        showNotification('Failed to save categorization patterns', 'error');
    }
}

// Load dissimilar pairs from localStorage
function loadDissimilarPairs() {
    try {
        const saved = localStorage.getItem('dissimilarPairs');
        if (saved) {
            const parsed = JSON.parse(saved);
            dissimilarPairs = new Set(parsed);
            console.log(`Loaded ${dissimilarPairs.size} dissimilar transaction pairs`);
        }
    } catch (error) {
        console.error('Error loading dissimilar pairs:', error);
        dissimilarPairs = new Set();
    }
}

// Save dissimilar pairs to localStorage
function saveDissimilarPairs() {
    try {
        const arr = Array.from(dissimilarPairs);
        localStorage.setItem('dissimilarPairs', JSON.stringify(arr));
        console.log(`Saved ${dissimilarPairs.size} dissimilar transaction pairs`);
    } catch (error) {
        console.error('Error saving dissimilar pairs:', error);
        showNotification('Failed to save similarity exclusions', 'error');
    }
}

// Create a unique key for a pair of descriptions (order-independent)
function createPairKey(desc1, desc2) {
    const normalized1 = String(desc1).toLowerCase().trim();
    const normalized2 = String(desc2).toLowerCase().trim();
    // Sort to ensure same key regardless of order
    return normalized1 < normalized2 
        ? `${normalized1}|||${normalized2}` 
        : `${normalized2}|||${normalized1}`;
}

// Check if two descriptions are marked as dissimilar
// areDissimilar - check in-memory cache first, then database
// Note: This is kept for performance (in-memory cache) but database is source of truth
function areDissimilar(desc1, desc2) {
    const key = createPairKey(desc1, desc2);
    // Check in-memory cache first (faster)
    if (dissimilarPairs.has(key)) return true;
    // Database check happens async in findSimilarTransactions, so return false here
    // The database check is done separately to avoid blocking
    return false;
}

// Mark two descriptions as dissimilar
async function markAsDissimilar(desc1, desc2) {
    const key = createPairKey(desc1, desc2);
    dissimilarPairs.add(key);
    saveDissimilarPairs();
    
    // Also save to database for persistence
    try {
        await dbMarkDissimilar(desc1, desc2);
    } catch (error) {
        console.error('Failed to save dissimilar pair to database:', error);
    }
}

// ========================================
// ENHANCED MERCHANT EXTRACTION & NORMALIZATION
// ========================================

// Extract and normalize merchant name from transaction description
function extractMerchantName(description) {
    if (!description) return '';
    
    let normalized = String(description).toUpperCase().trim();
    
    // Remove common patterns
    normalized = normalized
        // Remove transaction IDs and numbers at the end
        .replace(/#\d+/g, '')
        .replace(/\b\d{4,}\b/g, '')
        // Remove dates (MM/DD, MM-DD, etc.)
        .replace(/\b\d{1,2}[\/\-]\d{1,2}\b/g, '')
        // Remove card numbers (last 4 digits)
        .replace(/\*+\d{4}/g, '')
        // Remove store numbers
        .replace(/\b(STORE|STR|LOC|LOCATION)\s*#?\d+\b/gi, '')
        // Remove common suffixes
        .replace(/\b(INC|LLC|LTD|CORP|CO|COMPANY)\b/gi, '')
        // Remove extra whitespace
        .replace(/\s+/g, ' ')
        .trim();
    
    // Extract first significant word(s) - usually the merchant name
    const words = normalized.split(' ').filter(w => w.length > 2);
    
    // Return first 1-3 meaningful words as merchant identifier
    if (words.length === 0) return normalized;
    if (words.length === 1) return words[0];
    if (words.length === 2) return words.slice(0, 2).join(' ');
    return words.slice(0, 3).join(' ');
}

// Calculate enhanced similarity score between two descriptions
function calculateSimilarity(desc1, desc2) {
    const d1 = String(desc1).toLowerCase().trim();
    const d2 = String(desc2).toLowerCase().trim();
    
    // Exact match
    if (d1 === d2) return 1.0;
    
    // Try merchant-based matching first
    const merchant1 = extractMerchantName(d1);
    const merchant2 = extractMerchantName(d2);
    
    if (merchant1 && merchant2 && merchant1 === merchant2) {
        return 0.95; // Very high confidence for same merchant
    }
    
    // Check if one merchant contains the other
    if (merchant1 && merchant2) {
        if (merchant1.includes(merchant2) || merchant2.includes(merchant1)) {
            return 0.90;
        }
    }
    
    // Fall back to word-based similarity
    const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'inc', 'llc', 'ltd'];
    const words1 = d1.split(/\s+/).filter(w => w.length > 2 && !commonWords.includes(w));
    const words2 = d2.split(/\s+/).filter(w => w.length > 2 && !commonWords.includes(w));
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    // Count matching words with improved fuzzy matching
    let matches = 0;
    for (const word1 of words1) {
        for (const word2 of words2) {
            // Exact word match
            if (word1 === word2) {
                matches += 1.0;
                break;
            }
            // Check if words are similar (Levenshtein-like)
            if (word1.length >= 3 && word2.length >= 3) {
                // Same prefix (first 4 characters)
                if (word1.substring(0, 4) === word2.substring(0, 4)) {
                    matches += 0.8;
                    break;
                }
                // Contains relationship
                if (word1.includes(word2) || word2.includes(word1)) {
                    matches += 0.6;
                    break;
                }
            }
        }
    }
    
    // Calculate weighted Jaccard similarity
    const similarity = matches / Math.max(words1.length, words2.length);
    return Math.min(similarity, 1.0);
}

// Find best matching learned categorization with multi-example support
// Legacy in-memory categorization lookup (fallback)
function findLearnedCategoryFromMemory(description) {
    let bestMatch = null;
    let bestScore = 0;
    const threshold = 0.55; // Lowered threshold with better matching algorithm
    
    const merchantName = extractMerchantName(description);
    
    for (const [key, patternData] of learnedCategorizations.entries()) {
        // Check if this is new format (with examples array) or old format
        const isMultiExample = patternData.examples && Array.isArray(patternData.examples);
        
        let maxScore = 0;
        let matchedExample = null;
        
        if (isMultiExample) {
            // New format: check against all examples
            for (const example of patternData.examples) {
                const score = calculateSimilarity(description, example.description);
                if (score > maxScore) {
                    maxScore = score;
                    matchedExample = example.description;
                }
            }
            
            // Bonus for matching merchant name
            if (merchantName && key.includes(merchantName.toLowerCase())) {
                maxScore = Math.min(maxScore + 0.1, 1.0);
            }
            
            if (maxScore > bestScore && maxScore >= threshold) {
                bestScore = maxScore;
                bestMatch = {
                    category: patternData.category,
                    confidence: maxScore,
                    learnedFrom: matchedExample || key,
                    isLearned: true,
                    exampleCount: patternData.examples.length,
                    avgAmount: patternData.averageAmount
                };
            }
        } else {
            // Old format: single description
            const score = calculateSimilarity(description, patternData.description || key);
            if (score > bestScore && score >= threshold) {
                bestScore = score;
                bestMatch = {
                    category: patternData.category,
                    confidence: score,
                    learnedFrom: patternData.description || key,
                    isLearned: true,
                    exampleCount: 1
                };
            }
        }
    }
    
    return bestMatch;
}

// Main categorization function with enhanced learning support
async function categorizeTransaction(description, amount = 0) {
    // First, check if we have a learned categorization from the database
    let learned = null;
    try {
        learned = await dbFindLearnedCategory(description);
    } catch (error) {
        console.error('Error querying learned categories:', error);
    }
    
    // If not found in database, check in-memory cache (legacy fallback)
    if (!learned) {
        learned = findLearnedCategoryFromMemory(description);
    }
    
    // Auto-apply high-confidence learned patterns (85%+)
    if (learned && learned.confidence >= 0.85) {
        console.log(`✓ Auto-applying learned category for "${description}": ${learned.category} (${(learned.confidence * 100).toFixed(0)}% confidence)`);
        return {
            category: learned.category,
            isLearned: true,
            confidence: learned.confidence,
            source: 'database',
            exampleCount: learned.exampleCount,
            autoApplied: true
        };
    }
    
    // Use medium-confidence learned patterns (70-85%)
    if (learned && learned.confidence >= 0.70) {
        console.log(`✓ Suggesting learned category for "${description}": ${learned.category} (${(learned.confidence * 100).toFixed(0)}% confidence)`);
        return {
            category: learned.category,
            isLearned: true,
            confidence: learned.confidence,
            source: 'database',
            exampleCount: learned.exampleCount,
            autoApplied: false
        };
    }
    
    // Fall back to keyword-based categorization
    const desc = String(description).toLowerCase();
    
    // Check if it's income based on amount and keywords
    if (amount > 0) {
        const incomeKeywords = ['salary', 'payroll', 'wage', 'payment received', 'deposit', 'transfer from', 'refund'];
        if (incomeKeywords.some(keyword => desc.includes(keyword))) {
            return {
                category: 'Income',
                isLearned: false,
                confidence: 0.7,
                source: 'keyword'
            };
        }
    }
    
    const categories = {
        'Groceries': ['grocery', 'supermarket', 'walmart', 'target', 'costco', 'whole foods', 'trader joe', 'safeway', 'kroger', 'food mart', 'market'],
        'Dining & Restaurants': ['restaurant', 'cafe', 'coffee', 'starbucks', 'mcdonald', 'burger', 'pizza', 'chipotle', 'subway', 'taco bell', 'kfc', 'wendy', 'domino', 'uber eats', 'doordash', 'grubhub', 'dining'],
        'Transportation': ['uber', 'lyft', 'taxi', 'gas', 'fuel', 'shell', 'chevron', 'exxon', 'bp', 'parking', 'transit', 'metro', 'bus', 'train', 'airline'],
        'Shopping': ['amazon', 'ebay', 'store', 'shop', 'retail', 'purchase', 'mall', 'clothing', 'fashion', 'best buy', 'apple store'],
        'Utilities': ['electric', 'water', 'gas bill', 'utility', 'pge', 'power', 'energy'],
        'Internet & Phone': ['internet', 'phone', 'mobile', 'verizon', 'att', 'tmobile', 'comcast', 'xfinity', 'spectrum', 'cable'],
        'Rent & Mortgage': ['rent', 'mortgage', 'property', 'landlord', 'housing'],
        'Insurance': ['insurance', 'geico', 'state farm', 'progressive', 'allstate'],
        'Entertainment': ['netflix', 'hulu', 'spotify', 'apple music', 'disney', 'hbo', 'youtube', 'movie', 'theater', 'gaming', 'playstation', 'xbox', 'steam', 'subscription'],
        'Health & Medical': ['medical', 'pharmacy', 'cvs', 'walgreens', 'doctor', 'hospital', 'health', 'clinic', 'dental', 'vision'],
        'Education': ['school', 'university', 'tuition', 'course', 'education', 'learning', 'books', 'college'],
        'Travel': ['hotel', 'airbnb', 'flight', 'booking', 'travel', 'vacation', 'trip'],
        'Fees & Charges': ['fee', 'charge', 'penalty', 'late fee', 'overdraft', 'service charge', 'atm fee'],
        'Transfers & Payments': ['transfer', 'payment', 'zelle', 'venmo', 'paypal', 'cash app', 'withdrawal'],
        'Personal Care': ['salon', 'spa', 'beauty', 'haircut', 'gym', 'fitness'],
        'Pet Care': ['pet', 'vet', 'veterinary', 'dog', 'cat', 'animal'],
        'Donations': ['donation', 'charity', 'nonprofit', 'church', 'giving'],
    };
    
    for (let [category, keywords] of Object.entries(categories)) {
        if (keywords.some(keyword => desc.includes(keyword))) {
            const confidence = learned && learned.confidence >= 0.6 ? learned.confidence : 0.7;
            return {
                category: learned && learned.confidence >= 0.6 ? learned.category : category,
                isLearned: learned && learned.confidence >= 0.6 ? true : false,
                confidence: confidence,
                source: learned && learned.confidence >= 0.6 ? 'learned' : 'keyword'
            };
        }
    }
    
    // If we have a lower confidence learned match, use it
    if (learned) {
        return learned;
    }
    
    return {
        category: 'Other',
        isLearned: false,
        confidence: 0.5,
        source: 'default'
    };
}

// ========================================
// CATEGORIZATION REVIEW UI
// ========================================

// Find similar transactions in pending review
function findSimilarTransactions(transaction, allTransactions) {
    const similar = [];
    const merchantName = extractMerchantName(transaction.description);
    let skippedReviewed = 0;
    let skippedDissimilar = 0;
    
    for (let i = 0; i < allTransactions.length; i++) {
        const other = allTransactions[i];
        if (other.reviewIndex === transaction.reviewIndex) continue;
        
        // IMPORTANT: Skip transactions that have already been reviewed (approved or modified)
        // This prevents showing the same transaction in multiple similar lists
        if (other.reviewStatus === 'approved' || other.reviewStatus === 'modified') {
            skippedReviewed++;
            continue;
        }
        
        // Check if user previously marked these as NOT similar
        if (areDissimilar(transaction.description, other.description)) {
            skippedDissimilar++;
            continue; // Skip this pair
        }
        
        const similarity = calculateSimilarity(transaction.description, other.description);
        const otherMerchant = extractMerchantName(other.description);
        
        // Consider similar if high similarity score OR same merchant name
        if (similarity >= 0.75 || (merchantName && otherMerchant && merchantName === otherMerchant)) {
            similar.push({
                transaction: other,
                similarity: similarity,
                index: i
            });
        }
    }
    
    if (skippedReviewed > 0 || skippedDissimilar > 0) {
        console.log(`findSimilarTransactions for "${transaction.description}": Found ${similar.length}, Skipped ${skippedReviewed} reviewed, ${skippedDissimilar} dissimilar`);
    }
    
    return similar.sort((a, b) => b.similarity - a.similarity);
}

// Show categorization review modal
function showCategorizationReview(transactions) {
    const modal = document.getElementById('categorizationReviewModal');
    const reviewList = document.getElementById('reviewTransactionsList');
    
    if (!modal || !reviewList) {
        console.error('Review modal elements not found');
        // Fall back to showing dashboard directly
        finalizeDashboardDisplay();
        return;
    }
    
    // Prepare transactions for review
    pendingReview = transactions.map((t, index) => ({
        ...t,
        originalCategory: t.category,
        reviewStatus: 'pending', // pending, approved, modified
        reviewIndex: index
    }));
    
    // Render review items
    renderReviewTransactions();
    
    // Setup event listeners
    setupReviewModalListeners();
    
    // Show modal
    modal.style.display = 'flex';
    isReviewMode = true;
    
    // Update progress
    updateReviewProgress();
}

// Render review transaction items
function renderReviewTransactions() {
    const reviewList = document.getElementById('reviewTransactionsList');
    if (!reviewList) return;
    
    reviewList.innerHTML = '';
    
    // Only show pending transactions (hide approved and modified)
    const pendingTransactions = pendingReview.filter(t => t.reviewStatus === 'pending');
    
    console.log(`Rendering review: ${pendingTransactions.length} pending, ${pendingReview.filter(t => t.reviewStatus === 'approved').length} approved, ${pendingReview.filter(t => t.reviewStatus === 'modified').length} modified`);
    
    if (pendingTransactions.length === 0) {
        // All transactions reviewed - show completion message
        reviewList.innerHTML = `
            <div class="no-patterns-message" style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border: 2px solid #22c55e;">
                <div class="no-patterns-message-icon" style="font-size: 72px;">🎉</div>
                <div class="no-patterns-message-title" style="color: #065f46;">All Transactions Reviewed!</div>
                <div class="no-patterns-message-text" style="color: #064e3b;">
                    You've reviewed all ${pendingReview.length} transaction(s). 
                    Click "Finish & Apply" to see your final approval summary.
                </div>
            </div>
        `;
        return;
    }
    
    pendingTransactions.forEach((transaction) => {
        const item = createReviewTransactionItem(transaction, transaction.reviewIndex);
        reviewList.appendChild(item);
    });
}

// Create a single review transaction item
function createReviewTransactionItem(transaction, index) {
    const item = document.createElement('div');
    item.className = `review-transaction-item ${transaction.reviewStatus}`;
    item.dataset.index = index;
    
    const typeClass = transaction.type === 'income' ? 'income' : 'expense';
    const amountDisplay = transaction.type === 'income' 
        ? `+${formatCurrency(transaction.amount)}` 
        : `-${formatCurrency(Math.abs(transaction.amount))}`;
    
    // Status badge
    let statusBadge = '';
    if (transaction.reviewStatus === 'approved') {
        const bulkIndicator = transaction.bulkApplied ? ' <span style="font-size: 10px;">🔄</span>' : '';
        statusBadge = `<span class="review-item-status-badge approved">✓ Approved${bulkIndicator}</span>`;
    } else if (transaction.reviewStatus === 'modified') {
        statusBadge = '<span class="review-item-status-badge modified">✎ Modified (Bulk Applied)</span>';
    } else {
        statusBadge = '<span class="review-item-status-badge pending">Pending</span>';
    }
    
    // Source badge
    let sourceBadge = '';
    if (transaction.source === 'learned') {
        sourceBadge = '<span class="review-category-badge learned">🎓 Learned</span>';
    } else if (transaction.source === 'keyword') {
        sourceBadge = '<span class="review-category-badge keyword">🔍 Auto-detected</span>';
    } else {
        sourceBadge = '<span class="review-category-badge default">❓ Suggested</span>';
    }
    
    const confidencePercent = Math.round(transaction.confidence * 100);
    
    item.innerHTML = `
        ${statusBadge}
        <div class="review-transaction-header">
            <div class="review-transaction-info">
                <div class="review-transaction-description">${escapeHtml(transaction.description)}</div>
                <div class="review-transaction-meta">
                    <span>📅 ${formatDate(transaction.date)}</span>
                    <span>Type: ${transaction.type === 'income' ? '💰 Income' : '💸 Expense'}</span>
                </div>
            </div>
            <div class="review-transaction-amount ${typeClass}">${amountDisplay}</div>
        </div>
        
        <div class="review-category-section">
            <div class="review-category-label">
                ${transaction.reviewStatus === 'modified' ? 'Updated Category' : transaction.reviewStatus === 'approved' ? 'Approved Category' : 'Suggested Category'}
            </div>
            <div class="review-current-category">
                <span style="font-weight: ${transaction.reviewStatus === 'modified' || transaction.reviewStatus === 'approved' ? '700' : '600'}; 
                      color: ${transaction.reviewStatus === 'modified' ? '#f59e0b' : transaction.reviewStatus === 'approved' ? '#22c55e' : '#1a1a1a'};">
                    ${escapeHtml(transaction.category)}
                </span>
                ${sourceBadge}
            </div>
            <div class="review-confidence">
                Confidence: ${confidencePercent}%
                <div class="confidence-bar">
                    <div class="confidence-bar-fill" style="width: ${confidencePercent}%"></div>
                </div>
            </div>
        </div>
        
        <div class="review-actions">
            <select class="review-category-select" data-index="${index}">
                <option value="Income" ${transaction.category === 'Income' ? 'selected' : ''}>Income</option>
                <option value="Groceries" ${transaction.category === 'Groceries' ? 'selected' : ''}>Groceries</option>
                <option value="Dining & Restaurants" ${transaction.category === 'Dining & Restaurants' ? 'selected' : ''}>Dining & Restaurants</option>
                <option value="Transportation" ${transaction.category === 'Transportation' ? 'selected' : ''}>Transportation</option>
                <option value="Shopping" ${transaction.category === 'Shopping' ? 'selected' : ''}>Shopping</option>
                <option value="Utilities" ${transaction.category === 'Utilities' ? 'selected' : ''}>Utilities</option>
                <option value="Internet & Phone" ${transaction.category === 'Internet & Phone' ? 'selected' : ''}>Internet & Phone</option>
                <option value="Rent & Mortgage" ${transaction.category === 'Rent & Mortgage' ? 'selected' : ''}>Rent & Mortgage</option>
                <option value="Insurance" ${transaction.category === 'Insurance' ? 'selected' : ''}>Insurance</option>
                <option value="Entertainment" ${transaction.category === 'Entertainment' ? 'selected' : ''}>Entertainment</option>
                <option value="Health & Medical" ${transaction.category === 'Health & Medical' ? 'selected' : ''}>Health & Medical</option>
                <option value="Education" ${transaction.category === 'Education' ? 'selected' : ''}>Education</option>
                <option value="Travel" ${transaction.category === 'Travel' ? 'selected' : ''}>Travel</option>
                <option value="Fees & Charges" ${transaction.category === 'Fees & Charges' ? 'selected' : ''}>Fees & Charges</option>
                <option value="Transfers & Payments" ${transaction.category === 'Transfers & Payments' ? 'selected' : ''}>Transfers & Payments</option>
                <option value="Personal Care" ${transaction.category === 'Personal Care' ? 'selected' : ''}>Personal Care</option>
                <option value="Pet Care" ${transaction.category === 'Pet Care' ? 'selected' : ''}>Pet Care</option>
                <option value="Donations" ${transaction.category === 'Donations' ? 'selected' : ''}>Donations</option>
                <option value="Other" ${transaction.category === 'Other' ? 'selected' : ''}>Other</option>
            </select>
            <button class="btn-approve" data-index="${index}">
                ${transaction.reviewStatus === 'pending' ? '✓ Approve' : transaction.reviewStatus === 'modified' ? '✓ Approve' : '✓ Approved'}
            </button>
        </div>
    `;
    
    // Find and display similar transactions
    const similarTransactions = findSimilarTransactions(transaction, pendingReview);
    if (similarTransactions.length > 0) {
        const similarSection = document.createElement('div');
        similarSection.className = 'similar-transactions-notice';
        similarSection.style.cssText = 'margin-top: 12px; padding: 12px; background: #FFF9E6; border-radius: 8px; border: 1px solid #FFE0B2;';
        
        // Function to create transaction item HTML
        const createSimilarItemHTML = (s) => {
            const simPercent = Math.round(s.similarity * 100);
            return `
                <div class="similar-transaction-item" style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #FFE0B2;">
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 600; color: #1a1a1a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${escapeHtml(s.transaction.description)}
                        </div>
                        <div style="font-size: 11px; color: #92400e;">
                            ${formatCurrency(Math.abs(s.transaction.amount))} • ${simPercent}% match
                        </div>
                    </div>
                    <button class="btn-not-similar" 
                            data-source-index="${index}"
                            data-target-index="${s.index}"
                            style="padding: 3px 8px; font-size: 11px; background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; border-radius: 4px; cursor: pointer; font-weight: 600; margin-left: 8px; white-space: nowrap;">
                        ✕ Not Similar
                    </button>
                </div>
            `;
        };
        
        // Show first 5 items
        const initialItems = similarTransactions.slice(0, 5).map(createSimilarItemHTML).join('');
        
        // Create hidden items for "Show All"
        const hiddenItems = similarTransactions.length > 5 
            ? similarTransactions.slice(5).map(createSimilarItemHTML).join('') 
            : '';
        
        const showMoreButton = similarTransactions.length > 5 
            ? `<button class="btn-show-more-similar" data-source-index="${index}" 
                       style="width: 100%; padding: 8px; margin-top: 8px; background: #FFF5E6; color: #f59e0b; border: 2px dashed #FFE0B2; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 12px; transition: all 0.2s;">
                    ▼ Show All ${similarTransactions.length} Transactions
                </button>` 
            : '';
        
        similarSection.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <span style="font-size: 13px; color: #f59e0b; font-weight: 600;">
                    🔄 ${similarTransactions.length} similar transaction(s) found
                </span>
                <button class="btn-apply-similar" data-index="${index}" 
                        style="padding: 4px 12px; font-size: 12px; background: #f59e0b; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
                    Apply to All Similar
                </button>
            </div>
            <div class="similar-items-container" style="font-size: 12px; color: #92400e; max-height: 400px; overflow-y: auto;">
                <div class="similar-items-visible">
                    ${initialItems}
                </div>
                <div class="similar-items-hidden" style="display: none;">
                    ${hiddenItems}
                </div>
                ${showMoreButton}
            </div>
        `;
        item.appendChild(similarSection);
    }
    
    return item;
}

// Setup event listeners for review modal
function setupReviewModalListeners() {
    // Category change listeners
    document.querySelectorAll('.review-category-select').forEach(select => {
        select.addEventListener('change', handleCategoryChange);
    });
    
    // Approve button listeners
    document.querySelectorAll('.btn-approve').forEach(btn => {
        btn.addEventListener('click', handleApproveTransaction);
    });
    
    // Apply to similar button listeners
    document.querySelectorAll('.btn-apply-similar').forEach(btn => {
        btn.addEventListener('click', handleApplyToSimilar);
    });
    
    // Not similar button listeners
    document.querySelectorAll('.btn-not-similar').forEach(btn => {
        btn.addEventListener('click', handleMarkNotSimilar);
    });
    
    // Show more similar button listeners
    document.querySelectorAll('.btn-show-more-similar').forEach(btn => {
        btn.addEventListener('click', handleShowMoreSimilar);
    });
    
    // Close button
    const closeReviewBtn = document.getElementById('closeCategorizationReviewModal');
    if (closeReviewBtn) {
        closeReviewBtn.onclick = handleCancelReview;
    }
    
    // Approve All button
    const approveAllBtn = document.getElementById('approveAllBtn');
    if (approveAllBtn) {
        approveAllBtn.onclick = handleApproveAll;
    }
    
    // Skip button
    const skipBtn = document.getElementById('skipBtn');
    if (skipBtn) {
        skipBtn.onclick = handleSkipReview;
    }
    
    // Finish button
    const finishBtn = document.getElementById('finishReviewBtn');
    if (finishBtn) {
        finishBtn.onclick = handleFinishReview;
    }
}

// Handle category change
function handleCategoryChange(e) {
    const index = parseInt(e.target.dataset.index);
    const newCategory = e.target.value;
    
    if (!newCategory || isNaN(index) || index < 0 || index >= pendingReview.length) return;
    
    const transaction = pendingReview[index];
    
    if (newCategory !== transaction.originalCategory) {
        transaction.category = newCategory;
        transaction.reviewStatus = 'modified';
    } else {
        transaction.category = newCategory;
        if (transaction.reviewStatus === 'modified') {
            transaction.reviewStatus = 'approved';
        }
    }
    
    console.log(`Transaction ${index} category changed to:`, newCategory, 'Status:', transaction.reviewStatus);
    
    // Re-render this item
    const item = document.querySelector(`.review-transaction-item[data-index="${index}"]`);
    if (item) {
        const newItem = createReviewTransactionItem(transaction, index);
        item.replaceWith(newItem);
        
        // Re-attach ALL listeners for this item
        const select = newItem.querySelector('.review-category-select');
        const approveBtn = newItem.querySelector('.btn-approve');
        const applyBtn = newItem.querySelector('.btn-apply-similar');
        const notSimilarBtns = newItem.querySelectorAll('.btn-not-similar');
        
        console.log('Re-attaching listeners after category change. Found:', {
            select: !!select,
            approveBtn: !!approveBtn,
            applyBtn: !!applyBtn,
            notSimilarBtns: notSimilarBtns.length
        });
        
        if (select) {
            select.addEventListener('change', handleCategoryChange);
            console.log('✓ Category select listener attached');
        }
        if (approveBtn) {
            approveBtn.addEventListener('click', handleApproveTransaction);
            console.log('✓ Approve button listener attached for index:', index);
        }
        if (applyBtn) {
            applyBtn.addEventListener('click', handleApplyToSimilar);
            console.log('✓ Apply to similar listener attached for index:', index);
        }
        if (notSimilarBtns.length > 0) {
            notSimilarBtns.forEach(btn => btn.addEventListener('click', handleMarkNotSimilar));
            console.log('✓ Not similar listeners attached:', notSimilarBtns.length);
        }
        
        // Show more button listener
        const showMoreBtn = newItem.querySelector('.btn-show-more-similar');
        if (showMoreBtn) {
            showMoreBtn.addEventListener('click', handleShowMoreSimilar);
            console.log('✓ Show more listener attached');
        }
    } else {
        console.error('Could not find item to re-render for index:', index);
    }
    
    updateReviewProgress();
}

// Handle show more similar transactions
function handleShowMoreSimilar(e) {
    const button = e.target;
    const sourceIndex = parseInt(button.dataset.sourceIndex);
    
    // Find the container
    const container = button.closest('.similar-transactions-notice');
    if (!container) return;
    
    const hiddenSection = container.querySelector('.similar-items-hidden');
    
    if (hiddenSection) {
        const isHidden = hiddenSection.style.display === 'none';
        
        if (isHidden) {
            // Show all items
            hiddenSection.style.display = 'block';
            button.innerHTML = '▲ Show Less';
            button.style.background = '#FFE0B2';
            console.log('Expanded similar transactions list');
        } else {
            // Hide extra items
            hiddenSection.style.display = 'none';
            const sourceTransaction = pendingReview[sourceIndex];
            const similarTransactions = findSimilarTransactions(sourceTransaction, pendingReview);
            button.innerHTML = `▼ Show All ${similarTransactions.length} Transactions`;
            button.style.background = '#FFF5E6';
            console.log('Collapsed similar transactions list');
        }
    }
}

// Handle marking transactions as NOT similar
async function handleMarkNotSimilar(e) {
    const sourceIndex = parseInt(e.target.dataset.sourceIndex);
    const targetIndex = parseInt(e.target.dataset.targetIndex);
    
    if (isNaN(sourceIndex) || isNaN(targetIndex)) {
        console.error('Invalid indices for marking dissimilar');
        return;
    }
    
    const sourceTransaction = pendingReview[sourceIndex];
    const targetTransaction = pendingReview[targetIndex];
    
    if (!sourceTransaction || !targetTransaction) {
        console.error('Transactions not found');
        return;
    }
    
    // Mark as dissimilar using the actual descriptions (now async)
    await markAsDissimilar(sourceTransaction.description, targetTransaction.description);
    
    console.log(`Marked as dissimilar: "${sourceTransaction.description}" and "${targetTransaction.description}"`);
    
    // Re-render this transaction item to update the similar list
    const itemElement = document.querySelector(`.review-transaction-item[data-index="${sourceIndex}"]`);
    if (itemElement) {
        const newItem = createReviewTransactionItem(sourceTransaction, sourceIndex);
        itemElement.replaceWith(newItem);
        
        // Re-attach listeners for the new item
        const select = newItem.querySelector('.review-category-select');
        const approveBtn = newItem.querySelector('.btn-approve');
        const applyBtn = newItem.querySelector('.btn-apply-similar');
        const notSimilarBtns = newItem.querySelectorAll('.btn-not-similar');
        
        console.log('Re-attaching listeners after marking not similar. Found:', {
            select: !!select,
            approveBtn: !!approveBtn,
            applyBtn: !!applyBtn,
            notSimilarBtns: notSimilarBtns.length
        });
        
        if (select) select.addEventListener('change', handleCategoryChange);
        if (approveBtn) approveBtn.addEventListener('click', handleApproveTransaction);
        if (applyBtn) {
            applyBtn.addEventListener('click', handleApplyToSimilar);
            console.log('✓ Apply to similar listener re-attached after marking not similar');
        }
        notSimilarBtns.forEach(btn => btn.addEventListener('click', handleMarkNotSimilar));
        
        // Show more button listener
        const showMoreBtn = newItem.querySelector('.btn-show-more-similar');
        if (showMoreBtn) {
            showMoreBtn.addEventListener('click', handleShowMoreSimilar);
        }
    }
    
    showNotification('✓ Marked as not similar. Won\'t suggest this pairing again.', 'success');
}

// Handle apply to similar transactions
function handleApplyToSimilar(e) {
    console.log('Apply to Similar button clicked!', e.target);
    
    const index = parseInt(e.target.dataset.index);
    console.log('Parsed index:', index);
    
    if (isNaN(index) || index < 0 || index >= pendingReview.length) {
        console.error('Invalid index for apply to similar:', index);
        return;
    }
    
    const sourceTransaction = pendingReview[index];
    console.log('Source transaction:', sourceTransaction.description, 'Category:', sourceTransaction.category);
    
    const similarTransactions = findSimilarTransactions(sourceTransaction, pendingReview);
    console.log('Found similar transactions:', similarTransactions.length);
    
    if (similarTransactions.length === 0) {
        showNotification('No similar transactions found', 'warning');
        return;
    }
    
    const count = similarTransactions.length;
    const confirmMsg = `Apply category "${sourceTransaction.category}" to ${count} similar transaction(s)?`;
    
    if (confirm(confirmMsg)) {
        let appliedCount = 0;
        
        console.log('=== APPLYING TO SIMILAR TRANSACTIONS ===');
        console.log('Source category:', sourceTransaction.category);
        console.log('Similar transactions to update:', similarTransactions.length);
        
        // Apply category to all similar transactions
        similarTransactions.forEach(similar => {
            const targetIndex = similar.index;
            const targetTx = pendingReview[targetIndex];
            
            console.log(`\nBefore - Index ${targetIndex}:`, {
                description: targetTx.description,
                category: targetTx.category,
                status: targetTx.reviewStatus
            });
            
            if (targetIndex >= 0 && targetIndex < pendingReview.length) {
                // Update category and status
                pendingReview[targetIndex].category = sourceTransaction.category;
                pendingReview[targetIndex].reviewStatus = 'modified';
                pendingReview[targetIndex].bulkApplied = true; // Mark as bulk applied
                appliedCount++;
                
                console.log(`After - Index ${targetIndex}:`, {
                    description: pendingReview[targetIndex].description,
                    category: pendingReview[targetIndex].category,
                    status: pendingReview[targetIndex].reviewStatus,
                    bulkApplied: pendingReview[targetIndex].bulkApplied
                });
            }
        });
        
        console.log('=== FINISHED APPLYING ===');
        console.log('Total applied:', appliedCount);
        
        console.log('Applied category to', appliedCount, 'transaction(s)');
        
        // Also mark source as approved - ensure we update the actual array item
        console.log('Source transaction status before:', sourceTransaction.reviewStatus);
        sourceTransaction.reviewStatus = 'approved';
        sourceTransaction.bulkApplied = true;
        pendingReview[index].reviewStatus = 'approved'; // Ensure array is updated
        pendingReview[index].bulkApplied = true; // Mark source as bulk operation initiator
        console.log('Source transaction status after:', sourceTransaction.reviewStatus);
        console.log('Source transaction in array:', pendingReview[index].reviewStatus);
        
        // Re-render all transactions
        console.log('Re-rendering all transactions...');
        renderReviewTransactions();
        setupReviewModalListeners();
        updateReviewProgress();
        
        console.log('Source transaction after re-render:', pendingReview[index].reviewStatus);
        
        // Verify all modified transactions
        console.log('=== VERIFICATION ===');
        similarTransactions.forEach(similar => {
            const tx = pendingReview[similar.index];
            console.log(`Index ${similar.index}: ${tx.description.substring(0, 30)}... | Category: ${tx.category} | Status: ${tx.reviewStatus}`);
        });
        console.log('===================');
        
        // Highlight the source transaction AND all modified transactions
        setTimeout(() => {
            // Highlight source transaction in green
            const sourceItem = document.querySelector(`.review-transaction-item[data-index="${index}"]`);
            if (sourceItem) {
                sourceItem.style.transition = 'all 0.3s ease';
                sourceItem.style.backgroundColor = '#d1fae5';
                sourceItem.style.transform = 'scale(1.02)';
                sourceItem.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.3)';
                console.log('Highlighted source transaction');
                
                // Scroll to source transaction
                sourceItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Reset after animation
                setTimeout(() => {
                    sourceItem.style.backgroundColor = '';
                    sourceItem.style.transform = '';
                    sourceItem.style.boxShadow = '';
                }, 1500);
            }
            
            // Highlight all modified transactions briefly
            similarTransactions.forEach((similar, idx) => {
                setTimeout(() => {
                    const targetItem = document.querySelector(`.review-transaction-item[data-index="${similar.index}"]`);
                    if (targetItem) {
                        targetItem.style.transition = 'all 0.3s ease';
                        targetItem.style.backgroundColor = '#fffbeb';
                        targetItem.style.transform = 'scale(1.01)';
                        
                        setTimeout(() => {
                            targetItem.style.backgroundColor = '';
                            targetItem.style.transform = '';
                        }, 1500);
                    }
                }, idx * 50); // Stagger the animations slightly
            });
            
        }, 100);
        
        showNotification(`✓ Applied "${sourceTransaction.category}" to ${appliedCount} transaction(s)! All updated.`, 'success');
    } else {
        console.log('User cancelled bulk apply');
    }
}

// Handle approve transaction
function handleApproveTransaction(e) {
    console.log('Approve button clicked!', e.target);
    
    const index = parseInt(e.target.dataset.index);
    console.log('Parsed index:', index);
    
    if (isNaN(index) || index < 0 || index >= pendingReview.length) {
        console.error('Invalid index for approve transaction:', index);
        return;
    }
    
    const transaction = pendingReview[index];
    console.log('Current transaction status:', transaction.reviewStatus);
    
    if (transaction.reviewStatus === 'pending') {
        transaction.reviewStatus = 'approved';
    } else if (transaction.reviewStatus === 'modified') {
        transaction.reviewStatus = 'approved'; // Changed: modified should become approved when clicked
    } else {
        // Toggle off if already approved
        transaction.reviewStatus = 'pending';
    }
    
    console.log(`Transaction ${index} status changed to:`, transaction.reviewStatus);
    
    // Re-render this item
    const item = document.querySelector(`.review-transaction-item[data-index="${index}"]`);
    if (item) {
        const newItem = createReviewTransactionItem(transaction, index);
        item.replaceWith(newItem);
        
        // Re-attach ALL listeners for this item
        const select = newItem.querySelector('.review-category-select');
        const approveBtn = newItem.querySelector('.btn-approve');
        const applyBtn = newItem.querySelector('.btn-apply-similar');
        const notSimilarBtns = newItem.querySelectorAll('.btn-not-similar');
        
        console.log('Re-attaching listeners after approve. Found:', {
            select: !!select,
            approveBtn: !!approveBtn,
            applyBtn: !!applyBtn,
            notSimilarBtns: notSimilarBtns.length
        });
        
        if (select) select.addEventListener('change', handleCategoryChange);
        if (approveBtn) approveBtn.addEventListener('click', handleApproveTransaction);
        if (applyBtn) {
            applyBtn.addEventListener('click', handleApplyToSimilar);
            console.log('✓ Apply to similar listener re-attached after approve');
        }
        notSimilarBtns.forEach(btn => btn.addEventListener('click', handleMarkNotSimilar));
        
        // Show more button listener
        const showMoreBtn = newItem.querySelector('.btn-show-more-similar');
        if (showMoreBtn) {
            showMoreBtn.addEventListener('click', handleShowMoreSimilar);
        }
    }
    
    updateReviewProgress();
}

// Handle approve all
function handleApproveAll() {
    pendingReview.forEach(transaction => {
        if (transaction.reviewStatus === 'pending') {
            transaction.reviewStatus = 'approved';
        }
    });
    
    renderReviewTransactions();
    setupReviewModalListeners();
    updateReviewProgress();
    
    showNotification('All transactions approved!', 'success');
}

// Handle cancel review (go back to upload)
function handleCancelReview() {
    if (confirm('Are you sure you want to cancel? You will need to upload your file again.')) {
        // Close modal
        closeReviewModal();
        
        // Clear all data
        allTransactions = [];
        transactions = [];
        selectedFiles = [];
        
        // Show upload section again
        if (dom.uploadSection) dom.uploadSection.style.display = 'block';
        if (dom.dashboardContent) dom.dashboardContent.style.display = 'none';
        if (dom.fileList) dom.fileList.style.display = 'none';
        if (dom.fileListItems) dom.fileListItems.innerHTML = '';
        if (dom.fileInput) dom.fileInput.value = '';
        
        showNotification('Upload cancelled. You can now upload the correct file.', 'info');
    }
}

// Handle skip review
function handleSkipReview() {
    // Mark all as approved without learning
    pendingReview.forEach(transaction => {
        transaction.reviewStatus = 'approved';
    });
    
    // Close modal and show dashboard
    closeReviewModal();
    finalizeDashboardDisplay();
}

// Handle finish review
function handleFinishReview() {
    // Count reviewed transactions
    const reviewed = pendingReview.filter(t => t.reviewStatus !== 'pending').length;
    const pending = pendingReview.filter(t => t.reviewStatus === 'pending').length;
    
    if (reviewed === 0) {
        if (confirm('No transactions have been reviewed. Do you want to skip review and use auto-categorization?')) {
            handleSkipReview();
        }
        return;
    }
    
    // Check if there are still pending transactions
    if (pending > 0) {
        const continueMsg = `You have ${pending} unreviewed transaction(s). Do you want to:\n\n• Click OK to continue to final approval (unreviewed will use suggested categories)\n• Click Cancel to go back and review them`;
        if (!confirm(continueMsg)) {
            return;
        }
        
        // Auto-approve pending transactions with their suggested categories
        pendingReview.forEach(transaction => {
            if (transaction.reviewStatus === 'pending') {
                transaction.reviewStatus = 'approved';
            }
        });
    }
    
    // Show final approval summary
    showFinalApprovalSummary();
}

// Update review progress
function updateReviewProgress() {
    const progressSpan = document.getElementById('reviewProgress');
    if (!progressSpan) return;
    
    const pending = pendingReview.filter(t => t.reviewStatus === 'pending').length;
    const reviewed = pendingReview.filter(t => t.reviewStatus !== 'pending').length;
    const total = pendingReview.length;
    
    if (pending === 0) {
        progressSpan.innerHTML = `<span style="color: #22c55e;">✓ All Done: <strong>${reviewed} / ${total}</strong></span>`;
    } else {
        progressSpan.innerHTML = `Remaining: <strong>${pending}</strong> | Reviewed: <strong>${reviewed} / ${total}</strong>`;
    }
}

// ========================================
// FINAL APPROVAL SUMMARY
// ========================================

// Show final approval summary before applying
async function showFinalApprovalSummary() {
    const modal = document.getElementById('finalApprovalModal');
    const summaryBody = document.getElementById('finalApprovalBody');
    const reviewModal = document.getElementById('categorizationReviewModal');
    
    if (!modal || !summaryBody) {
        console.error('Final approval modal not found, proceeding directly');
        await processFinalApproval();
        return;
    }
    
    // Hide review modal, show final approval modal
    if (reviewModal) reviewModal.style.display = 'none';
    
    // Calculate statistics
    const approved = pendingReview.filter(t => t.reviewStatus === 'approved');
    const modified = pendingReview.filter(t => t.reviewStatus === 'modified');
    const bulkApplied = pendingReview.filter(t => t.bulkApplied);
    const totalReviewed = approved.length + modified.length;
    
    // Group by category
    const categoryBreakdown = {};
    pendingReview.forEach(transaction => {
        const cat = transaction.category;
        if (!categoryBreakdown[cat]) {
            categoryBreakdown[cat] = {
                count: 0,
                total: 0,
                transactions: []
            };
        }
        categoryBreakdown[cat].count++;
        categoryBreakdown[cat].total += Math.abs(transaction.amount);
        categoryBreakdown[cat].transactions.push(transaction);
    });
    
    // Sort categories by transaction count
    const sortedCategories = Object.entries(categoryBreakdown)
        .sort((a, b) => b[1].count - a[1].count);
    
    // Calculate learning statistics
    const willLearn = pendingReview.filter(t => t.reviewStatus === 'approved' || t.reviewStatus === 'modified').length;
    const newMerchants = new Set();
    pendingReview.forEach(t => {
        if (t.reviewStatus === 'approved' || t.reviewStatus === 'modified') {
            const merchant = extractMerchantName(t.description);
            if (merchant) newMerchants.add(merchant);
        }
    });
    
    // Create summary HTML
    summaryBody.innerHTML = `
        <div style="background: white; border-radius: 12px; padding: 24px; margin-bottom: 20px; border: 2px solid #22c55e;">
            <h3 style="margin: 0 0 20px 0; font-size: 22px; font-weight: 800; color: #1a1a1a;">
                📊 Categorization Summary
            </h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px;">
                <div style="background: #f0fdf4; padding: 20px; border-radius: 10px; border: 2px solid #22c55e; text-align: center;">
                    <div style="font-size: 12px; color: #166534; font-weight: 700; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Total Reviewed</div>
                    <div style="font-size: 40px; font-weight: 900; color: #22c55e; line-height: 1;">${totalReviewed}</div>
                </div>
                <div style="background: #f0fdf4; padding: 20px; border-radius: 10px; border: 2px solid #22c55e; text-align: center;">
                    <div style="font-size: 12px; color: #166534; font-weight: 700; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Approved</div>
                    <div style="font-size: 40px; font-weight: 900; color: #22c55e; line-height: 1;">${approved.length}</div>
                </div>
                <div style="background: #fffbeb; padding: 20px; border-radius: 10px; border: 2px solid #f59e0b; text-align: center;">
                    <div style="font-size: 12px; color: #92400e; font-weight: 700; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Modified</div>
                    <div style="font-size: 40px; font-weight: 900; color: #f59e0b; line-height: 1;">${modified.length}</div>
                </div>
                <div style="background: #eff6ff; padding: 20px; border-radius: 10px; border: 2px solid #3b82f6; text-align: center;">
                    <div style="font-size: 12px; color: #1e40af; font-weight: 700; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Bulk Applied</div>
                    <div style="font-size: 40px; font-weight: 900; color: #3b82f6; line-height: 1;">${bulkApplied.length}</div>
                </div>
            </div>
        </div>
        
        <div style="background: white; border-radius: 12px; padding: 24px; margin-bottom: 20px; border: 2px solid #e5e5e5;">
            <h3 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 700; color: #1a1a1a;">
                📁 Category Breakdown (${sortedCategories.length} categories)
            </h3>
            <div style="display: flex; flex-direction: column; gap: 10px; max-height: 300px; overflow-y: auto;">
                ${sortedCategories.map(([category, data]) => {
                    const barWidth = (data.count / totalReviewed) * 100;
                    return `
                        <div style="background: #fafafa; padding: 14px; border-radius: 8px; border: 1px solid #e5e5e5; transition: all 0.2s;"
                             onmouseover="this.style.background='#f0f8f5'; this.style.borderColor='#22c55e';"
                             onmouseout="this.style.background='#fafafa'; this.style.borderColor='#e5e5e5';">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <div style="font-weight: 700; font-size: 15px; color: #1a1a1a;">${escapeHtml(category)}</div>
                                <div style="font-weight: 700; font-size: 16px; color: #ef4444;">${formatCurrency(data.total)}</div>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 13px; color: #6a6a6a;">
                                <span><strong>${data.count}</strong> transaction(s) • Avg: ${formatCurrency(data.total / data.count)}</span>
                                <span style="font-weight: 600; color: #3b82f6;">${Math.round(barWidth)}%</span>
                            </div>
                            <div style="background: #e5e5e5; height: 6px; border-radius: 3px; overflow: hidden;">
                                <div style="background: linear-gradient(90deg, #22c55e 0%, #16a34a 100%); height: 100%; width: ${barWidth}%; transition: width 0.5s ease;"></div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 24px; margin-bottom: 20px; border: 2px solid #667eea;">
            <div style="display: flex; align-items: center; gap: 16px;">
                <div style="font-size: 48px;">🎓</div>
                <div style="flex: 1; color: white;">
                    <div style="font-weight: 700; font-size: 18px; margin-bottom: 8px;">Learning Summary</div>
                    <div style="font-size: 14px; opacity: 0.95; line-height: 1.6;">
                        The system will learn from <strong>${willLearn} transaction(s)</strong> across <strong>${newMerchants.size} merchant(s)</strong>.
                        Future uploads will auto-categorize these patterns with high confidence.
                    </div>
                </div>
            </div>
        </div>
        
        <div style="background: linear-gradient(135deg, #FFF9E6 0%, #FFF5E6 100%); border-radius: 12px; padding: 20px; border: 2px solid #FFE0B2;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="font-size: 32px;">✓</div>
                <div style="flex: 1;">
                    <div style="font-weight: 700; color: #92400e; margin-bottom: 4px; font-size: 16px;">Ready to Proceed</div>
                    <div style="font-size: 14px; color: #78350f; line-height: 1.6;">
                        Click "Confirm & Show Dashboard" to apply these categorizations and view your financial analysis.
                        You can always go back to review if you need to make changes.
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Show modal
    modal.style.display = 'flex';
    
    // Setup listeners
    setupFinalApprovalListeners();
}

// Setup final approval listeners
function setupFinalApprovalListeners() {
    const backBtn = document.getElementById('backToReviewBtn');
    const confirmBtn = document.getElementById('confirmFinalApprovalBtn');
    
    if (backBtn) {
        backBtn.onclick = () => {
            // Go back to review modal
            const finalModal = document.getElementById('finalApprovalModal');
            const reviewModal = document.getElementById('categorizationReviewModal');
            
            if (finalModal) finalModal.style.display = 'none';
            if (reviewModal) reviewModal.style.display = 'flex';
            
            // Re-render to show all transactions again
            renderReviewTransactions();
            setupReviewModalListeners();
            updateReviewProgress();
        };
    }
    
    if (confirmBtn) {
        confirmBtn.onclick = async () => {
            await processFinalApproval();
        };
    }
}

// Process final approval and apply learning
async function processFinalApproval() {
    // Hide final approval modal
    const finalModal = document.getElementById('finalApprovalModal');
    if (finalModal) finalModal.style.display = 'none';
    
    // Learn from approved and modified transactions with multi-example support
    let learnedCount = 0;
    let newPatterns = 0;
    let updatedPatterns = 0;
    let dbSaveCount = 0;
    
    // Save to database first (persistent storage)
    const transactionsToSave = pendingReview.filter(t => 
        t.reviewStatus === 'approved' || t.reviewStatus === 'modified'
    );
    
    for (const transaction of transactionsToSave) {
        try {
            // Save categorization pattern to database
            await saveCategorization(
                transaction.description,
                transaction.category,
                transaction.amount
            );
            dbSaveCount++;
            
            // Also save transaction to history
            // await saveTransaction(transaction); // Uncomment if you want full transaction history
            
        } catch (error) {
            console.error('Failed to save categorization to database:', error);
        }
    }
    
    // Also update in-memory cache (for backward compatibility)
    pendingReview.forEach(transaction => {
        if (transaction.reviewStatus === 'approved' || transaction.reviewStatus === 'modified') {
            // Extract merchant name for better grouping
            const merchantName = extractMerchantName(transaction.description);
            const key = merchantName ? merchantName.toLowerCase() : transaction.description.toLowerCase().trim();
            
            const newExample = {
                description: transaction.description,
                amount: transaction.amount,
                date: transaction.date.toISOString(),
                confidence: transaction.reviewStatus === 'modified' ? 1.0 : transaction.confidence || 1.0,
                learnedAt: new Date().toISOString()
            };
            
            // Check if we already have a pattern for this merchant
            if (learnedCategorizations.has(key)) {
                const existing = learnedCategorizations.get(key);
                
                // Update to new format if it's in old format
                if (!existing.examples) {
                    existing.examples = [{
                        description: existing.description,
                        amount: existing.amount,
                        date: existing.learnedAt,
                        confidence: existing.confidence || 1.0,
                        learnedAt: existing.learnedAt
                    }];
                }
                
                // Add new example (limit to 10 most recent examples)
                existing.examples.push(newExample);
                if (existing.examples.length > 10) {
                    existing.examples = existing.examples.slice(-10); // Keep last 10
                }
                
                // Update aggregate data
                existing.category = transaction.category; // Use latest category
                existing.totalApprovals = (existing.totalApprovals || 1) + 1;
                existing.lastUpdated = new Date().toISOString();
                existing.averageAmount = existing.examples.reduce((sum, ex) => sum + Math.abs(ex.amount), 0) / existing.examples.length;
                
                learnedCategorizations.set(key, existing);
                updatedPatterns++;
            } else {
                // Create new pattern with examples array
                learnedCategorizations.set(key, {
                    category: transaction.category,
                    merchantName: merchantName || transaction.description,
                    examples: [newExample],
                    totalApprovals: 1,
                    lastUpdated: new Date().toISOString(),
                    averageAmount: Math.abs(transaction.amount),
                    type: transaction.type
                });
                newPatterns++;
            }
            
            learnedCount++;
            
            // Update the transaction in allTransactions
            const originalTx = allTransactions.find(t => 
                t.description === transaction.description && 
                t.amount === transaction.amount && 
                t.date.getTime() === transaction.date.getTime()
            );
            if (originalTx) {
                originalTx.category = transaction.category;
                originalTx.isLearned = true;
                originalTx.confidence = transaction.reviewStatus === 'modified' ? 1.0 : transaction.confidence;
                originalTx.source = 'database';
            }
        }
    });
    
    // Save to localStorage (legacy fallback)
    saveLearnedCategorizations();
    
    // Save file history if file data is available
    if (currentFileData && allTransactions.length > 0) {
        try {
            const income = allTransactions
                .filter(t => t.type === 'income')
                .reduce((sum, t) => sum + t.amount, 0);
            
            const expenses = Math.abs(allTransactions
                .filter(t => t.type === 'expense')
                .reduce((sum, t) => sum + t.amount, 0));
            
            const incomeCount = allTransactions.filter(t => t.type === 'income').length;
            const expenseCount = allTransactions.filter(t => t.type === 'expense').length;
            
            // Get file name from display or use default
            const fileName = dom.fileName ? dom.fileName.textContent : 'uploaded-file.xlsx';
            
            // Estimate file size from base64 data
            const fileSize = Math.round((currentFileData.length * 3) / 4);
            
            await saveFileHistory(
                fileName,
                currentFileData,
                fileSize,
                allTransactions.length,
                currentFileYear,
                {
                    totalIncome: income,
                    totalExpenses: expenses,
                    netBalance: income - expenses,
                    incomeCount: incomeCount,
                    expenseCount: expenseCount
                }
            );
            
            console.log('✓ Saved file to history:', fileName);
        } catch (error) {
            console.error('Failed to save file history:', error);
        }
    }
    
    // Update transactions reference
    transactions = allTransactions;
    
    // Close modal and show dashboard
    closeReviewModal();
    finalizeDashboardDisplay();
    
    // Show detailed learning summary with database status
    let message = `✓ Learned from ${learnedCount} transaction(s)!`;
    if (dbSaveCount > 0) {
        message += ` (${dbSaveCount} saved to database)`;
    }
    if (newPatterns > 0 && updatedPatterns > 0) {
        message += ` ${newPatterns} new, ${updatedPatterns} updated`;
    } else if (newPatterns > 0) {
        message += ` ${newPatterns} new patterns`;
    } else if (updatedPatterns > 0) {
        message += ` (${updatedPatterns} patterns updated)`;
    }
    
    showNotification(message, 'success');
    console.log(`Learning Summary: ${newPatterns} new patterns, ${updatedPatterns} updated patterns, ${learnedCategorizations.size} total patterns stored`);
}

// Close review modal
function closeReviewModal() {
    const modal = document.getElementById('categorizationReviewModal');
    if (modal) {
        modal.style.display = 'none';
    }
    isReviewMode = false;
    pendingReview = [];
}

// Finalize dashboard display after review
function finalizeDashboardDisplay() {
    // Update dashboard with reviewed data
    updateDashboard();
    
    // Show dashboard
    if (dom.uploadSection) dom.uploadSection.style.display = 'none';
    if (dom.dashboardContent) dom.dashboardContent.style.display = 'block';
}

// ========================================
// LEARNED PATTERNS MANAGEMENT
// ========================================

// Show learned patterns management modal
function showLearnedPatternsModal() {
    const modal = document.getElementById('learnedPatternsModal');
    if (!modal) return;
    
    // Update stats
    updateLearnedPatternsStats();
    
    // Render patterns list
    renderLearnedPatternsList();
    
    // Setup listeners
    setupLearnedPatternsListeners();
    
    // Show modal
    modal.style.display = 'flex';
}

// Update learned patterns stats
function updateLearnedPatternsStats() {
    const totalCount = document.getElementById('totalPatternsCount');
    const lastUpdated = document.getElementById('lastUpdatedDate');
    const excludedCount = document.getElementById('excludedPairsCount');
    
    if (totalCount) {
        // Count total examples across all patterns
        let totalExamples = 0;
        for (const [key, value] of learnedCategorizations.entries()) {
            if (value.examples && Array.isArray(value.examples)) {
                totalExamples += value.examples.length;
            } else {
                totalExamples += 1;
            }
        }
        
        totalCount.textContent = `${learnedCategorizations.size} (${totalExamples} examples)`;
    }
    
    if (excludedCount) {
        excludedCount.textContent = dissimilarPairs.size;
    }
    
    if (lastUpdated && learnedCategorizations.size > 0) {
        let mostRecent = null;
        for (const [key, value] of learnedCategorizations.entries()) {
            // Check lastUpdated first (new format), then learnedAt (old format)
            const dateStr = value.lastUpdated || value.learnedAt;
            if (dateStr) {
                const date = new Date(dateStr);
                if (!mostRecent || date > mostRecent) {
                    mostRecent = date;
                }
            }
        }
        
        if (mostRecent) {
            lastUpdated.textContent = formatDate(mostRecent);
        } else {
            lastUpdated.textContent = 'Today';
        }
    } else if (lastUpdated) {
        lastUpdated.textContent = '-';
    }
}

// Render learned patterns list
function renderLearnedPatternsList(filter = '') {
    const list = document.getElementById('learnedPatternsList');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (learnedCategorizations.size === 0) {
        list.innerHTML = `
            <div class="no-patterns-message">
                <div class="no-patterns-message-icon">🎓</div>
                <div class="no-patterns-message-title">No Learned Patterns Yet</div>
                <div class="no-patterns-message-text">
                    Upload and review transactions to start building your categorization library.
                    The system will learn from your approvals and corrections.
                </div>
            </div>
        `;
        return;
    }
    
    const filterLower = filter.toLowerCase();
    let visibleCount = 0;
    
    for (const [description, info] of learnedCategorizations.entries()) {
        // Apply filter
        if (filter && !description.includes(filterLower) && !info.category.toLowerCase().includes(filterLower)) {
            continue;
        }
        
        visibleCount++;
        
        const item = document.createElement('div');
        item.className = 'learned-pattern-item';
        item.dataset.description = description;
        
        // Handle both old and new format
        const isMultiExample = info.examples && Array.isArray(info.examples);
        const exampleCount = isMultiExample ? info.examples.length : 1;
        const displayName = isMultiExample ? (info.merchantName || description) : (info.description || description);
        const learnedDate = isMultiExample 
            ? (info.lastUpdated ? formatDate(new Date(info.lastUpdated)) : 'Unknown')
            : (info.learnedAt ? formatDate(new Date(info.learnedAt)) : 'Unknown');
        const typeIcon = info.type === 'income' ? '💰' : '💸';
        const amountDisplay = isMultiExample 
            ? formatCurrency(info.averageAmount || 0) 
            : (info.amount ? formatCurrency(Math.abs(info.amount)) : 'N/A');
        const totalApprovals = isMultiExample ? (info.totalApprovals || exampleCount) : 1;
        
        item.innerHTML = `
            <div class="learned-pattern-header">
                <div class="learned-pattern-description">
                    ${escapeHtml(displayName)}
                    ${exampleCount > 1 ? `<span style="color: #22c55e; font-size: 13px; margin-left: 8px;">✓ ${exampleCount} examples</span>` : ''}
                </div>
                <div class="learned-pattern-category">
                    <span>${escapeHtml(info.category)}</span>
                </div>
            </div>
            <div class="learned-pattern-meta">
                <span>${typeIcon} ${info.type || 'expense'}</span>
                <span>💵 Avg: ${amountDisplay}</span>
                <span>📅 Updated: ${learnedDate}</span>
                <span>🎓 Learned ${totalApprovals}× </span>
            </div>
            <div class="learned-pattern-actions">
                <button class="btn-delete-pattern" data-description="${escapeHtml(description)}">
                    🗑️ Delete Pattern
                </button>
            </div>
        `;
        
        list.appendChild(item);
    }
    
    if (visibleCount === 0 && filter) {
        list.innerHTML = `
            <div class="no-patterns-message">
                <div class="no-patterns-message-icon">🔍</div>
                <div class="no-patterns-message-title">No Matches Found</div>
                <div class="no-patterns-message-text">
                    No patterns match your search term "${escapeHtml(filter)}".
                    Try a different search or clear the filter.
                </div>
            </div>
        `;
    }
}

// Setup learned patterns listeners
function setupLearnedPatternsListeners() {
    // Close button
    const closeBtn = document.getElementById('closeLearnedPatternsModal');
    if (closeBtn) {
        closeBtn.onclick = closeLearnedPatternsModal;
    }
    
    // Search input
    const searchInput = document.getElementById('learnedPatternsSearch');
    if (searchInput) {
        searchInput.oninput = (e) => {
            renderLearnedPatternsList(e.target.value);
            setupDeleteListeners();
        };
    }
    
    // View exclusions button
    const viewExclusionsBtn = document.getElementById('viewExclusionsBtn');
    if (viewExclusionsBtn) {
        viewExclusionsBtn.onclick = showExclusionsView;
    }
    
    // Clear all button
    const clearAllBtn = document.getElementById('clearAllPatternsBtn');
    if (clearAllBtn) {
        clearAllBtn.onclick = handleClearAllPatterns;
    }
    
    // Delete pattern buttons
    setupDeleteListeners();
}

// Show exclusions view
function showExclusionsView() {
    const list = document.getElementById('learnedPatternsList');
    if (!list) return;
    
    if (dissimilarPairs.size === 0) {
        list.innerHTML = `
            <div class="no-patterns-message">
                <div class="no-patterns-message-icon">✓</div>
                <div class="no-patterns-message-title">No Excluded Pairs</div>
                <div class="no-patterns-message-text">
                    You haven't marked any transaction pairs as "not similar" yet.
                    When you do, they'll appear here and you can manage them.
                </div>
            </div>
        `;
        return;
    }
    
    list.innerHTML = '<div style="margin-bottom: 16px;"><button class="btn-outline" id="backToPatternsBtn">← Back to Patterns</button></div>';
    
    for (const pairKey of dissimilarPairs) {
        const [desc1, desc2] = pairKey.split('|||');
        
        const item = document.createElement('div');
        item.className = 'learned-pattern-item';
        item.style.background = '#FFF5F5';
        item.style.borderColor = '#fecaca';
        
        item.innerHTML = `
            <div class="learned-pattern-header">
                <div class="learned-pattern-description">
                    <div style="margin-bottom: 8px;">
                        <span style="color: #dc2626; font-weight: 700;">1.</span> ${escapeHtml(desc1)}
                    </div>
                    <div>
                        <span style="color: #dc2626; font-weight: 700;">2.</span> ${escapeHtml(desc2)}
                    </div>
                </div>
            </div>
            <div class="learned-pattern-meta">
                <span>🚫 These transactions won't be suggested as similar</span>
            </div>
            <div class="learned-pattern-actions">
                <button class="btn-delete-exclusion" data-pair-key="${escapeHtml(pairKey)}" 
                        style="background: #fee2e2; color: #dc2626; border: 1px solid #fecaca;">
                    ✓ Allow as Similar Again
                </button>
            </div>
        `;
        
        list.appendChild(item);
    }
    
    // Setup listeners for exclusion items
    setupExclusionListeners();
}

// Setup exclusion delete listeners
function setupExclusionListeners() {
    // Back button
    const backBtn = document.getElementById('backToPatternsBtn');
    if (backBtn) {
        backBtn.onclick = () => {
            renderLearnedPatternsList();
            setupDeleteListeners();
        };
    }
    
    // Delete exclusion buttons
    document.querySelectorAll('.btn-delete-exclusion').forEach(btn => {
        btn.onclick = (e) => {
            const pairKey = e.target.dataset.pairKey;
            if (pairKey && dissimilarPairs.has(pairKey)) {
                dissimilarPairs.delete(pairKey);
                saveDissimilarPairs();
                updateLearnedPatternsStats();
                showExclusionsView();
                showNotification('✓ Pair can now be suggested as similar again', 'success');
            }
        };
    });
}

// Setup delete listeners for pattern items
function setupDeleteListeners() {
    document.querySelectorAll('.btn-delete-pattern').forEach(btn => {
        btn.onclick = (e) => {
            const description = e.target.dataset.description;
            handleDeletePattern(description);
        };
    });
}

// Handle delete pattern
function handleDeletePattern(description) {
    if (!confirm(`Delete this learned pattern?\n\n"${description}"\n\nThis action cannot be undone.`)) {
        return;
    }
    
    // Remove from learned categorizations
    learnedCategorizations.delete(description.toLowerCase());
    
    // Save to localStorage
    saveLearnedCategorizations();
    
    // Re-render
    updateLearnedPatternsStats();
    const searchInput = document.getElementById('learnedPatternsSearch');
    const filter = searchInput ? searchInput.value : '';
    renderLearnedPatternsList(filter);
    setupDeleteListeners();
    
    showNotification('Pattern deleted successfully', 'success');
}

// Handle clear all patterns
function handleClearAllPatterns() {
    if (!confirm(`Clear ALL ${learnedCategorizations.size} learned patterns?\n\nThis will permanently delete all your categorization training data.\n\nThis action cannot be undone!`)) {
        return;
    }
    
    // Clear all patterns
    learnedCategorizations.clear();
    
    // Save to localStorage
    saveLearnedCategorizations();
    
    // Re-render
    updateLearnedPatternsStats();
    renderLearnedPatternsList();
    
    showNotification('All patterns cleared', 'info');
}

// Close learned patterns modal
function closeLearnedPatternsModal() {
    const modal = document.getElementById('learnedPatternsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Add event listeners for buttons (consolidated into main DOMContentLoaded)
// This is handled in the main initialization at line 474

function updateDashboard() {
    // Calculate metrics
    const income = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
    
    const expenses = Math.abs(transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0));
    
    const netBalance = income - expenses;
    const savingsRate = income > 0 ? ((netBalance / income) * 100) : 0;
    
    const incomeCount = transactions.filter(t => t.type === 'income').length;
    const expenseCount = transactions.filter(t => t.type === 'expense').length;
    
    // Update summary cards
    if (dom.totalIncome) dom.totalIncome.textContent = formatCurrency(income);
    if (dom.totalExpenses) dom.totalExpenses.textContent = formatCurrency(expenses);
    if (dom.netBalance) dom.netBalance.textContent = formatCurrency(netBalance);
    if (dom.savingsRate) dom.savingsRate.textContent = savingsRate.toFixed(1) + '%';
    
    if (dom.incomeCount) dom.incomeCount.textContent = `${incomeCount} transaction${incomeCount !== 1 ? 's' : ''}`;
    if (dom.expenseCount) dom.expenseCount.textContent = `${expenseCount} transaction${expenseCount !== 1 ? 's' : ''}`;
    
    const balanceStatus = netBalance >= 0 ? '↑ Positive' : '↓ Negative';
    if (dom.balanceChange) dom.balanceChange.textContent = balanceStatus;
    
    // Update charts
    updateCharts(income, expenses);
    
    // Detect and display recurring payments
    updateRecurringPayments();
    
    // Update savings optimizer
    updateSavingsOptimizer(income, expenses);
    
    // Update transactions table
    const sortValue = dom.sortFilter ? dom.sortFilter.value : 'date-desc';
    updateTransactionsTable('all', sortValue);
    
    // Setup filter buttons
    setupFilters();
}

function updateCharts(income, expenses) {
    
    if (!dom.incomeExpenseChart || !dom.categoryChart) return;
    
    // Income vs Expenses Chart - Update existing or create
    if (charts.incomeExpense) {
        try {
            // Update data only (faster than destroying)
            charts.incomeExpense.data.datasets[0].data = [income, expenses, income - expenses];
            charts.incomeExpense.update('none');
        } catch (error) {
            console.error('Error updating income chart, will recreate:', error);
            charts.incomeExpense.destroy();
            charts.incomeExpense = null;
        }
    }
    
    if (!charts.incomeExpense) {
        const incomeExpenseCtx = dom.incomeExpenseChart.getContext('2d');
    charts.incomeExpense = new Chart(incomeExpenseCtx, {
        type: 'bar',
        data: {
            labels: ['Income', 'Expenses', 'Net Balance'],
            datasets: [{
                data: [income, expenses, income - expenses],
                backgroundColor: ['#22c55e', '#ef4444', '#3b82f6'],
                borderRadius: 8,
                barThickness: 60
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => formatCurrency(context.parsed.y)
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => formatCurrency(value, false)
                    }
                }
            }
        }
    });
    }
    
    // Category Breakdown Chart
    const categoryData = {};
    transactions
        .filter(t => t.type === 'expense')
        .forEach(t => {
            const cat = t.category;
            categoryData[cat] = (categoryData[cat] || 0) + Math.abs(t.amount);
        });
    
    const categoryLabels = Object.keys(categoryData);
    const categoryValues = Object.values(categoryData);
    
    // Update category chart or create
    if (charts.category) {
        try {
            charts.category.data.labels = categoryLabels;
            charts.category.data.datasets[0].data = categoryValues;
            charts.category.update('none');
        } catch (error) {
            console.error('Error updating category chart, will recreate:', error);
            charts.category.destroy();
            charts.category = null;
        }
    }
    
    if (!charts.category) {
        const categoryCtx = dom.categoryChart.getContext('2d');
    charts.category = new Chart(categoryCtx, {
        type: 'doughnut',
        data: {
            labels: categoryLabels,
            datasets: [{
                data: categoryValues,
                backgroundColor: [
                    '#ef4444', '#f97316', '#f59e0b', '#eab308',
                    '#84cc16', '#22c55e', '#10b981', '#14b8a6',
                    '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const label = context.label || '';
                            const value = formatCurrency(context.parsed);
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
    }
}

function updateTransactionsTable(filter = 'all', sort = 'date-desc') {
    const transactionsBody = document.getElementById('transactionsBody');
    const transactionCount = document.getElementById('transactionCount');
    
    if (!transactionsBody) return;
    
    let filteredTransactions = transactions;
    if (filter === 'income') {
        filteredTransactions = transactions.filter(t => t.type === 'income');
    } else if (filter === 'expense') {
        filteredTransactions = transactions.filter(t => t.type === 'expense');
    }
    
    // Apply sorting
    filteredTransactions = [...filteredTransactions]; // Create a copy to avoid mutating original
    switch (sort) {
        case 'date-desc':
            filteredTransactions.sort((a, b) => b.date - a.date);
            break;
        case 'date-asc':
            filteredTransactions.sort((a, b) => a.date - b.date);
            break;
        case 'amount-high':
            filteredTransactions.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
            break;
        case 'amount-low':
            filteredTransactions.sort((a, b) => Math.abs(a.amount) - Math.abs(b.amount));
            break;
        default:
            filteredTransactions.sort((a, b) => b.date - a.date);
    }
    
    // Calculate total income for percentage calculation
    const totalIncome = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
    
    // Update transaction count
    if (transactionCount) {
        transactionCount.textContent = filteredTransactions.length;
    }
    
    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();
    const INITIAL_ROWS_TO_SHOW = 15;
    
    filteredTransactions.forEach((transaction, index) => {
        const row = document.createElement('tr');
        
        // Hide rows after the 15th one initially
        if (index >= INITIAL_ROWS_TO_SHOW) {
            row.classList.add('transaction-row-hidden');
        }
        
        const dateCell = document.createElement('td');
        dateCell.className = 'transaction-date';
        dateCell.textContent = formatDate(transaction.date);
        
        const descCell = document.createElement('td');
        descCell.className = 'transaction-description';
        descCell.textContent = transaction.description;
        
        const categoryCell = document.createElement('td');
        const categorySpan = document.createElement('span');
        categorySpan.className = 'transaction-category';
        categorySpan.textContent = transaction.category;
        
        // Add visual indicator for learned categories
        if (transaction.isLearned) {
            const learnedBadge = document.createElement('span');
            learnedBadge.className = 'learned-badge';
            learnedBadge.textContent = '🎓';
            learnedBadge.title = 'Category learned from your previous approvals';
            learnedBadge.style.cssText = 'margin-left: 6px; font-size: 12px;';
            categorySpan.appendChild(learnedBadge);
        }
        
        categoryCell.appendChild(categorySpan);
        
        const amountCell = document.createElement('td');
        amountCell.className = `transaction-amount ${transaction.type}`;
        amountCell.textContent = transaction.type === 'income' 
            ? '+' + formatCurrency(transaction.amount)
            : formatCurrency(transaction.amount);
        
        // Calculate percentage of total income
        const percentageCell = document.createElement('td');
        percentageCell.className = 'transaction-percentage';
        
        if (totalIncome > 0) {
            const percentage = (Math.abs(transaction.amount) / totalIncome) * 100;
            const percentageSpan = document.createElement('span');
            percentageSpan.className = `percentage-badge ${transaction.type}`;
            percentageSpan.textContent = transaction.type === 'income' 
                ? '+' + percentage.toFixed(1) + '%'
                : '-' + percentage.toFixed(1) + '%';
            percentageCell.appendChild(percentageSpan);
        } else {
            percentageCell.textContent = 'N/A';
        }
        
        const balanceCell = document.createElement('td');
        balanceCell.className = 'transaction-balance';
        balanceCell.textContent = formatCurrency(transaction.balance);
        
        row.appendChild(dateCell);
        row.appendChild(descCell);
        row.appendChild(categoryCell);
        row.appendChild(amountCell);
        row.appendChild(percentageCell);
        row.appendChild(balanceCell);
        
        fragment.appendChild(row);
    });
    
    transactionsBody.innerHTML = '';
    transactionsBody.appendChild(fragment);
    
    // Add or update "Show More" button if there are more than INITIAL_ROWS_TO_SHOW transactions
    const transactionsSection = document.querySelector('.transactions-section');
    let showMoreContainer = document.getElementById('transactionsShowMoreContainer');
    
    // Remove existing container if present
    if (showMoreContainer) {
        showMoreContainer.remove();
    }
    
    if (filteredTransactions.length > INITIAL_ROWS_TO_SHOW && transactionsSection) {
        showMoreContainer = document.createElement('div');
        showMoreContainer.id = 'transactionsShowMoreContainer';
        showMoreContainer.style.cssText = 'margin: 24px 0 0 0; text-align: center; padding: 0 32px 32px;';
        showMoreContainer.innerHTML = `
            <button class="btn-primary" id="transactionsShowMoreBtn" style="padding: 12px 32px; font-size: 15px;">
                📖 Show More (${filteredTransactions.length - INITIAL_ROWS_TO_SHOW} more)
            </button>
        `;
        
        transactionsSection.appendChild(showMoreContainer);
        
        // Add event listener to Show More button
        const showMoreBtn = document.getElementById('transactionsShowMoreBtn');
        if (showMoreBtn) {
            let isExpanded = false;
            showMoreBtn.addEventListener('click', () => {
                const hiddenRows = transactionsBody.querySelectorAll('.transaction-row-hidden');
                
                if (!isExpanded) {
                    // Expand - show all rows
                    hiddenRows.forEach(row => {
                        row.classList.remove('transaction-row-hidden');
                        row.classList.add('transaction-row-visible');
                    });
                    showMoreBtn.innerHTML = '📕 Show Less';
                    isExpanded = true;
                } else {
                    // Collapse - hide rows after 15th
                    const allRows = transactionsBody.querySelectorAll('tr');
                    allRows.forEach((row, index) => {
                        if (index >= INITIAL_ROWS_TO_SHOW) {
                            row.classList.remove('transaction-row-visible');
                            row.classList.add('transaction-row-hidden');
                        }
                    });
                    showMoreBtn.innerHTML = `📖 Show More (${filteredTransactions.length - INITIAL_ROWS_TO_SHOW} more)`;
                    isExpanded = false;
                    
                    // Scroll to the transactions section for better UX
                    transactionsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        }
    }
}

function setupFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const filter = btn.getAttribute('data-filter');
            const sortValue = dom.sortFilter ? dom.sortFilter.value : 'date-desc';
            updateTransactionsTable(filter, sortValue);
        });
    });
    
    // Add sort filter listener
    if (dom.sortFilter) {
        dom.sortFilter.addEventListener('change', () => {
            const activeFilter = document.querySelector('.filter-btn.active');
            const filter = activeFilter ? activeFilter.getAttribute('data-filter') : 'all';
            const sortValue = dom.sortFilter.value;
            updateTransactionsTable(filter, sortValue);
        });
    }
}

function showLoading() {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.id = 'loadingOverlay';
    overlay.innerHTML = `
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <p class="loading-text">Processing your file...</p>
            <p class="loading-subtext">This may take a few seconds</p>
        </div>
    `;
    document.body.appendChild(overlay);
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.remove();
    }
}

// Export to Excel with Charts
function exportToExcel() {
    if (!transactions || transactions.length === 0) {
        showNotification('No data to export', 'warning');
        return;
    }
    
    try {
        showLoading();
        
        // Calculate summary metrics
        const income = transactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);
        
        const expenses = Math.abs(transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0));
        
        const netBalance = income - expenses;
        const savingsRate = income > 0 ? ((netBalance / income) * 100) : 0;
        
        const incomeCount = transactions.filter(t => t.type === 'income').length;
        const expenseCount = transactions.filter(t => t.type === 'expense').length;
        
        // Calculate category breakdown
        const categoryData = {};
        transactions
            .filter(t => t.type === 'expense')
            .forEach(t => {
                const cat = t.category;
                categoryData[cat] = (categoryData[cat] || 0) + Math.abs(t.amount);
            });
        
        // Create workbook
        const wb = XLSX.utils.book_new();
        
        // === SHEET 1: SUMMARY WITH KEY METRICS ===
        const summaryData = [
            ['FINANCIAL SUMMARY REPORT'],
            [''],
            ['Generated:', new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })],
            ['File:', dom.fileName ? dom.fileName.textContent : 'Financial Data'],
            ['Period:', getDateRange()],
            [''],
            ['KEY METRICS', ''],
            ['Metric', 'Value'],
            ['Total Income', income],
            ['Total Expenses', expenses],
            ['Net Balance', netBalance],
            ['Savings Rate', savingsRate / 100],
            ['Income Transactions', incomeCount],
            ['Expense Transactions', expenseCount],
            ['Total Transactions', transactions.length],
            [''],
            ['CATEGORY BREAKDOWN (Expenses)', ''],
            ['Category', 'Amount']
        ];
        
        // Add category data
        Object.entries(categoryData)
            .sort((a, b) => b[1] - a[1])
            .forEach(([category, amount]) => {
                summaryData.push([category, amount]);
            });
        
        const ws_summary = XLSX.utils.aoa_to_sheet(summaryData);
        
        // Set column widths
        ws_summary['!cols'] = [
            { wch: 30 },
            { wch: 20 }
        ];
        
        // Format currency cells
        const currencyFormat = '$#,##0.00';
        const percentFormat = '0.00%';
        
        // Apply formats to summary sheet
        if (ws_summary['B9']) ws_summary['B9'].z = currencyFormat;  // Total Income
        if (ws_summary['B10']) ws_summary['B10'].z = currencyFormat; // Total Expenses
        if (ws_summary['B11']) ws_summary['B11'].z = currencyFormat; // Net Balance
        if (ws_summary['B12']) ws_summary['B12'].z = percentFormat;  // Savings Rate
        
        // Format category amounts
        for (let i = 20; i < summaryData.length; i++) {
            const cellRef = `B${i}`;
            if (ws_summary[cellRef]) {
                ws_summary[cellRef].z = currencyFormat;
            }
        }
        
        XLSX.utils.book_append_sheet(wb, ws_summary, 'Summary');
        
        // === SHEET 2: ALL TRANSACTIONS ===
        const transactionsData = [
            ['ALL TRANSACTIONS'],
            [''],
            ['Date', 'Description', 'Category', 'Type', 'Amount', '% of Income', 'Balance']
        ];
        
        transactions
            .sort((a, b) => b.date - a.date)
            .forEach(t => {
                const percentage = income > 0 ? (Math.abs(t.amount) / income) : 0;
                transactionsData.push([
                    t.date,
                    t.description,
                    t.category,
                    t.type === 'income' ? 'Income' : 'Expense',
                    t.amount,
                    percentage,
                    t.balance
                ]);
            });
        
        const ws_transactions = XLSX.utils.aoa_to_sheet(transactionsData);
        
        // Set column widths for transactions
        ws_transactions['!cols'] = [
            { wch: 12 },  // Date
            { wch: 40 },  // Description
            { wch: 20 },  // Category
            { wch: 10 },  // Type
            { wch: 15 },  // Amount
            { wch: 12 },  // % of Income
            { wch: 15 }   // Balance
        ];
        
        // Format transactions data
        for (let i = 4; i <= transactionsData.length; i++) {
            // Amount column (E)
            const amountCell = `E${i}`;
            if (ws_transactions[amountCell]) {
                ws_transactions[amountCell].z = currencyFormat;
            }
            
            // Percentage column (F)
            const pctCell = `F${i}`;
            if (ws_transactions[pctCell]) {
                ws_transactions[pctCell].z = percentFormat;
            }
            
            // Balance column (G)
            const balanceCell = `G${i}`;
            if (ws_transactions[balanceCell]) {
                ws_transactions[balanceCell].z = currencyFormat;
            }
        }
        
        XLSX.utils.book_append_sheet(wb, ws_transactions, 'Transactions');
        
        // === SHEET 3: CHART DATA (Structured for Easy Visualization) ===
        const chartData = [
            ['CHART DATA - Ready for Visualization'],
            [''],
            ['Income vs Expenses vs Net Balance'],
            ['Metric', 'Value'],
            ['Income', income],
            ['Expenses', expenses],
            ['Net Balance', netBalance],
            [''],
            ['Monthly Breakdown (if available)'],
            ['Month', 'Income', 'Expenses', 'Net Balance', 'Savings Rate']
        ];
        
        // Get monthly data
        const monthlyData = getMonthlyBreakdown();
        monthlyData.forEach(month => {
            chartData.push([
                month.month,
                month.income,
                month.expenses,
                month.netBalance,
                month.savingsRate / 100
            ]);
        });
        
        chartData.push(['']);
        chartData.push(['Category Breakdown (Top Expenses)']);
        chartData.push(['Category', 'Amount', 'Percentage of Total Expenses']);
        
        const totalExpenses = Object.values(categoryData).reduce((sum, val) => sum + val, 0);
        Object.entries(categoryData)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)  // Top 10 categories
            .forEach(([category, amount]) => {
                const percentage = totalExpenses > 0 ? amount / totalExpenses : 0;
                chartData.push([category, amount, percentage]);
            });
        
        chartData.push(['']);
        chartData.push(['Key Performance Indicators']);
        chartData.push(['KPI', 'Value', 'Target', 'Status']);
        chartData.push(['Savings Rate', savingsRate / 100, 0.50, savingsRate >= 50 ? 'On Target' : 'Below Target']);
        chartData.push(['Expense Ratio', expenses / income, 0.50, (expenses / income) <= 0.50 ? 'Good' : 'High']);
        
        const ws_charts = XLSX.utils.aoa_to_sheet(chartData);
        
        // Set column widths for chart data
        ws_charts['!cols'] = [
            { wch: 25 },
            { wch: 18 },
            { wch: 18 },
            { wch: 18 },
            { wch: 15 }
        ];
        
        // Format chart data sheet
        // Income vs Expenses section
        if (ws_charts['B5']) ws_charts['B5'].z = currencyFormat;
        if (ws_charts['B6']) ws_charts['B6'].z = currencyFormat;
        if (ws_charts['B7']) ws_charts['B7'].z = currencyFormat;
        
        // Monthly breakdown
        const monthlyStartRow = 11;
        for (let i = 0; i < monthlyData.length; i++) {
            const row = monthlyStartRow + i;
            if (ws_charts[`B${row}`]) ws_charts[`B${row}`].z = currencyFormat;
            if (ws_charts[`C${row}`]) ws_charts[`C${row}`].z = currencyFormat;
            if (ws_charts[`D${row}`]) ws_charts[`D${row}`].z = currencyFormat;
            if (ws_charts[`E${row}`]) ws_charts[`E${row}`].z = percentFormat;
        }
        
        // Category breakdown
        const categoryStartRow = monthlyStartRow + monthlyData.length + 4;
        for (let i = 0; i < Math.min(10, Object.keys(categoryData).length); i++) {
            const row = categoryStartRow + i;
            if (ws_charts[`B${row}`]) ws_charts[`B${row}`].z = currencyFormat;
            if (ws_charts[`C${row}`]) ws_charts[`C${row}`].z = percentFormat;
        }
        
        // KPI section
        const kpiStartRow = categoryStartRow + Math.min(10, Object.keys(categoryData).length) + 4;
        if (ws_charts[`B${kpiStartRow}`]) ws_charts[`B${kpiStartRow}`].z = percentFormat;
        if (ws_charts[`C${kpiStartRow}`]) ws_charts[`C${kpiStartRow}`].z = percentFormat;
        if (ws_charts[`B${kpiStartRow + 1}`]) ws_charts[`B${kpiStartRow + 1}`].z = percentFormat;
        if (ws_charts[`C${kpiStartRow + 1}`]) ws_charts[`C${kpiStartRow + 1}`].z = percentFormat;
        
        XLSX.utils.book_append_sheet(wb, ws_charts, 'Chart Data');
        
        // === SHEET 4: INSTRUCTIONS ===
        const instructionsData = [
            ['HOW TO CREATE CHARTS IN EXCEL'],
            [''],
            ['This Excel file contains your financial data organized into multiple sheets:'],
            [''],
            ['1. Summary - Overview of your financial metrics and category breakdown'],
            ['2. Transactions - Detailed list of all transactions'],
            ['3. Chart Data - Pre-formatted data ready for visualization'],
            ['4. Instructions - This sheet'],
            [''],
            ['TO CREATE CHARTS:'],
            [''],
            ['Option 1: Quick Charts (Excel 2016+)'],
            ['  1. Go to the "Chart Data" sheet'],
            ['  2. Select the data range you want to visualize'],
            ['  3. Click Insert > Recommended Charts'],
            ['  4. Choose your preferred chart style'],
            [''],
            ['Option 2: Manual Chart Creation'],
            ['  1. Go to the "Chart Data" sheet'],
            ['  2. For Income vs Expenses chart:'],
            ['     - Select cells A4:B7'],
            ['     - Click Insert > Column Chart or Bar Chart'],
            ['  3. For Monthly Trend:'],
            ['     - Select the monthly data (including headers)'],
            ['     - Click Insert > Line Chart'],
            ['  4. For Category Breakdown:'],
            ['     - Select category data with amounts'],
            ['     - Click Insert > Pie Chart or Doughnut Chart'],
            [''],
            ['RECOMMENDED VISUALIZATIONS:'],
            [''],
            ['• Income vs Expenses vs Net Balance → Column Chart'],
            ['• Monthly Breakdown → Line Chart or Combo Chart'],
            ['• Category Breakdown → Pie Chart or Doughnut Chart'],
            ['• Savings Rate Over Time → Line Chart with markers'],
            [''],
            ['TIP: Use conditional formatting on the Summary sheet to highlight'],
            ['      important metrics and trends.'],
            [''],
            ['Questions? Visit: https://support.microsoft.com/en-us/office/create-a-chart']
        ];
        
        const ws_instructions = XLSX.utils.aoa_to_sheet(instructionsData);
        ws_instructions['!cols'] = [{ wch: 80 }];
        
        XLSX.utils.book_append_sheet(wb, ws_instructions, 'Instructions');
        
        // Generate filename
        const fileName = dom.fileName ? dom.fileName.textContent : 'Financial_Report';
        const date = new Date().toISOString().split('T')[0];
        const filename = `${fileName.replace(/[^a-zA-Z0-9]/g, '_')}_${date}.xlsx`;
        
        // Write file
        XLSX.writeFile(wb, filename);
        
        hideLoading();
        showNotification('Excel file exported successfully! Open it to create charts.', 'success');
        
    } catch (error) {
        console.error('Export error:', error);
        hideLoading();
        showNotification('Failed to export Excel file. Please try again.', 'error');
    }
}

// Helper function to get date range
function getDateRange() {
    if (!transactions || transactions.length === 0) return 'N/A';
    
    const dates = transactions.map(t => t.date).sort((a, b) => a - b);
    const firstDate = formatDate(dates[0]);
    const lastDate = formatDate(dates[dates.length - 1]);
    
    return `${firstDate} - ${lastDate}`;
}

// ========================================
// FILE HISTORY MANAGEMENT
// ========================================

// Import shared history functions
import { showFileHistoryModal as showFileHistoryModalShared } from './file-history.js';

// Show file history modal (uses shared implementation)
const showFileHistoryModal = showFileHistoryModalShared;

// Reload file from history (dashboard-specific override)
window.reloadFileFromHistory = async function(fileId) {
    try {
        const fileData = await getFileHistoryById(fileId);
        if (!fileData) {
            showNotification('File not found in history', 'error');
            return;
        }
        
        // Close history modal
        const modal = document.getElementById('fileHistoryModal');
        if (modal) modal.style.display = 'none';
        
        // Show loading
        showLoading();
        
        // Reload the file using dashboard's loadConvertedFile function
        await loadConvertedFile(fileData.fileName, fileData.fileData, fileData.year);
        
        showNotification(`Reloaded: ${fileData.fileName}`, 'success');
    } catch (error) {
        console.error('Failed to reload file from history:', error);
        showNotification('Failed to reload file', 'error');
    }
};

// Helper function to get monthly breakdown
function getMonthlyBreakdown() {
    const monthlyData = {};
    
    transactions.forEach(t => {
        const monthKey = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = t.date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        
        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
                month: monthName,
                income: 0,
                expenses: 0,
                netBalance: 0,
                savingsRate: 0
            };
        }
        
        if (t.type === 'income') {
            monthlyData[monthKey].income += t.amount;
        } else {
            monthlyData[monthKey].expenses += Math.abs(t.amount);
        }
    });
    
    // Calculate net balance and savings rate for each month
    Object.values(monthlyData).forEach(month => {
        month.netBalance = month.income - month.expenses;
        month.savingsRate = month.income > 0 ? ((month.netBalance / month.income) * 100) : 0;
    });
    
    // Sort by month (chronologically)
    return Object.entries(monthlyData)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(entry => entry[1]);
}


