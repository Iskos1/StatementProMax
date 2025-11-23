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

let transactions = [];
let allTransactions = [];
let selectedFiles = [];
let currentMonthFilter = 'all';
let selectedMonths = new Set();
let savedSelections = {};
let charts = {
    incomeExpense: null,
    category: null
};

// Cache for performance
let cachedRecurringPayments = null;
let lastTransactionsHash = null;

// DOM Elements - cached for performance
let dom = {};

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
                // User is NOT authenticated - show login modal (required)
                if (signInBtn) signInBtn.style.display = 'block';
                if (userMenu) userMenu.style.display = 'none';
                
                // Store current page for redirect after login
                if (!sessionStorage.getItem('returnUrl')) {
                    sessionStorage.setItem('returnUrl', window.location.pathname);
                }
                
                // Show required sign-in modal
                if (typeof window.showSignInModal === 'function') {
                    window.showSignInModal(true); // true = required (can't close without auth)
                }
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
        categoryChart: safeGetElement('categoryChart')
    };
}

// Initialize dashboard features (after authentication)
function initializeDashboardFeatures() {
    cacheDOMElements();
    initializeYearModal();
    attachEventListeners();
    
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

// Attach all event listeners
function attachEventListeners() {
    if (dom.fileInput) {
        dom.fileInput.addEventListener('change', handleFileSelect);
    }
    
    if (dom.uploadArea) {
        dom.uploadArea.addEventListener('click', () => {
            if (dom.fileInput) dom.fileInput.click();
        });
        
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
}

// Start authentication check on page load
window.addEventListener('DOMContentLoaded', () => {
    initializeDashboard();
    });

// Year modal handled by imported module

// Load converted file from converter page
async function loadConvertedFile(fileName, base64Data, providedYear = null) {
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
        
        // Update dashboard
        updateDashboard();
        
        // Show dashboard
        if (dom.uploadSection) dom.uploadSection.style.display = 'none';
        if (dom.dashboardContent) dom.dashboardContent.style.display = 'block';
        
        hideLoading();
    } catch (error) {
        hideLoading();
        console.error('Error loading converted file:', error);
        alert('Error loading the converted file. Please try uploading it manually.');
    }
}

// Event listeners attached in attachEventListeners()

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

// Removed - moved to attachEventListeners()

function removeFile(index) {
    selectedFiles.splice(index, 1);
    displayFileList();
}

// Removed - now imported from utils.js

async function processAllFiles() {
    // Show year selection modal
    let year;
    try {
        year = await showYearModal();
    } catch (error) {
        // User cancelled
        return;
    }

    // Validate year input (should always be valid from dropdown, but check anyway)
    if (isNaN(year) || year < 1900 || year > 2100) {
        alert('Invalid year. Please try again.');
        return;
    }

    showLoading();
    
    allTransactions = [];
    let fileNames = [];
    
    for (const file of selectedFiles) {
        // Validate file
        const validExtensions = ['.xlsx', '.xls', '.csv'];
        const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        
        if (!validExtensions.includes(fileExtension)) {
            alert(`Invalid file: ${file.name}. Please upload Excel or CSV files only.`);
            continue;
        }
        
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            alert(`File ${file.name} exceeds 10MB limit.`);
            continue;
        }
        
        try {
            const fileTransactions = await processFile(file, year);
            allTransactions = allTransactions.concat(fileTransactions);
            fileNames.push(file.name);
        } catch (error) {
            console.error(`Error processing ${file.name}:`, error);
            alert(`Error processing ${file.name}. Please check the file format.`);
        }
    }
    
    if (allTransactions.length === 0) {
        hideLoading();
        alert('No transactions found in the uploaded files.');
        return;
    }
    
    // Sort all transactions by date
    allTransactions.sort((a, b) => b.date - a.date);
    transactions = allTransactions;
    
    // Update file name display
    const fileNameDisplay = fileNames.length === 1 
        ? fileNames[0] 
        : `${fileNames.length} files (${fileNames.join(', ')})`;
    if (dom.fileName) dom.fileName.textContent = fileNameDisplay;
    
    // Setup month filter
    setupMonthFilter();
    
    // Update dashboard with all data
    updateDashboard();
    
    // Show dashboard
    if (dom.uploadSection) dom.uploadSection.style.display = 'none';
    if (dom.dashboardContent) dom.dashboardContent.style.display = 'block';
    
    hideLoading();
}

function processFile(file, providedYear = null) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // Get first sheet
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
                
                // Process transactions with optional year correction
                const fileTransactions = parseTransactions(jsonData, providedYear);
                resolve(fileTransactions);
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
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
    
    currentMonthFilter = 'custom';
    updateMonthFilterUI();
    applyMonthFilter();
    
    showNotification(`Applied preset: ${presetMonths.length} months selected`, 'success');
}

function selectAllMonths() {
    selectedMonths.clear();
    currentMonthFilter = 'all';
    
    // Update button states
    const allBtn = document.querySelector('.month-btn-all');
    const clearBtn = document.querySelector('.month-btn-clear');
    const selectionInfo = document.getElementById('monthSelectionInfo');
    
    if (allBtn) allBtn.classList.add('active');
    if (clearBtn) clearBtn.style.display = 'none';
    if (selectionInfo) selectionInfo.style.display = 'none';
    
    document.querySelectorAll('.month-btn-selectable').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show all transactions
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
    
    currentMonthFilter = 'custom';
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

// Legacy function for backward compatibility
function filterByMonth(monthKey) {
    if (monthKey === 'all') {
        selectAllMonths();
    } else {
        selectedMonths.clear();
        selectedMonths.add(monthKey);
        currentMonthFilter = 'custom';
        updateMonthFilterUI();
        applyMonthFilter();
    }
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
    
    currentMonthFilter = 'custom';
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

// Removed - now imported from utils.js

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

// Removed - moved to attachEventListeners()

function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        selectedFiles = [...selectedFiles, ...files];
        displayFileList();
        if (dom.fileInput) dom.fileInput.value = '';
    }
}


function parseTransactions(data, providedYear = null) {
    if (!data || data.length < 2) return [];
    
    const transactions = [];
    const headers = data[0].map(h => String(h).toLowerCase());
    
    // Find column indices
    const dateCol = findColumnIndex(headers, ['date', 'transaction date', 'posting date']);
    const descCol = findColumnIndex(headers, ['description', 'memo', 'details', 'transaction', 'narration']);
    const amountCol = findColumnIndex(headers, ['amount', 'debit', 'credit', 'value']);
    const balanceCol = findColumnIndex(headers, ['balance', 'running balance', 'available balance']);
    
    // Alternative: look for credit/debit columns separately
    const creditCol = findColumnIndex(headers, ['credit', 'deposit', 'cr']);
    const debitCol = findColumnIndex(headers, ['debit', 'withdrawal', 'dr']);
    
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
        if (amount === 0) continue;
        
        // Parse date
        if (typeof date === 'number') {
            // Excel date number
            date = excelDateToJSDate(date);
        } else {
            date = new Date(date);
        }
        
        // Skip invalid dates
        if (isNaN(date.getTime())) continue;
        
        // Apply year correction if provided
        if (providedYear !== null) {
            // Keep the original month and day, but replace the year
            const month = date.getMonth();
            const day = date.getDate();
            date = new Date(providedYear, month, day);
        }
        
        // Categorize transaction
        const category = categorizeTransaction(description);
        
        transactions.push({
            date: date,
            description: String(description).trim(),
            amount: amount,
            balance: parseAmount(balance),
            category: category,
            type: amount > 0 ? 'income' : 'expense'
        });
    }
    
    // Sort by date (newest first)
    transactions.sort((a, b) => b.date - a.date);
    
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

function categorizeTransaction(description) {
    const desc = String(description).toLowerCase();
    
    const categories = {
        'Salary': ['salary', 'payroll', 'wage', 'income'],
        'Food': ['restaurant', 'cafe', 'food', 'grocery', 'supermarket', 'uber eats', 'doordash'],
        'Transport': ['uber', 'lyft', 'taxi', 'gas', 'fuel', 'parking', 'transit'],
        'Shopping': ['amazon', 'store', 'shop', 'retail', 'purchase'],
        'Bills': ['electric', 'water', 'internet', 'phone', 'utility', 'insurance'],
        'Entertainment': ['netflix', 'spotify', 'movie', 'gaming', 'subscription'],
        'Healthcare': ['medical', 'pharmacy', 'doctor', 'hospital', 'health'],
        'Transfer': ['transfer', 'atm', 'withdrawal', 'deposit'],
    };
    
    for (let [category, keywords] of Object.entries(categories)) {
        if (keywords.some(keyword => desc.includes(keyword))) {
            return category;
        }
    }
    
    return 'Other';
}

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
    
    // Update transactions table
    updateTransactionsTable('all');
    
    // Setup filter buttons
    setupFilters();
}

function updateCharts(income, expenses) {
    if (!dom.incomeExpenseChart || !dom.categoryChart) return;
    
    // Income vs Expenses Chart - Update existing or create
    if (charts.incomeExpense) {
        // Update data only (faster than destroying)
        charts.incomeExpense.data.datasets[0].data = [income, expenses, income - expenses];
        charts.incomeExpense.update('none');
    } else {
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
        charts.category.data.labels = categoryLabels;
        charts.category.data.datasets[0].data = categoryValues;
        charts.category.update('none');
    } else {
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

function updateTransactionsTable(filter = 'all') {
    if (!dom.transactionsBody) return;
    
    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();
    
    let filteredTransactions = transactions;
    if (filter === 'income') {
        filteredTransactions = transactions.filter(t => t.type === 'income');
    } else if (filter === 'expense') {
        filteredTransactions = transactions.filter(t => t.type === 'expense');
    }
    
    // Show up to 50 transactions
    const displayTransactions = filteredTransactions.slice(0, 50);
    
    displayTransactions.forEach(transaction => {
        const row = document.createElement('tr');
        
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
        categoryCell.appendChild(categorySpan);
        
        const amountCell = document.createElement('td');
        amountCell.className = `transaction-amount ${transaction.type}`;
        amountCell.textContent = transaction.type === 'income' 
            ? '+' + formatCurrency(transaction.amount)
            : formatCurrency(transaction.amount);
        
        const balanceCell = document.createElement('td');
        balanceCell.className = 'transaction-balance';
        balanceCell.textContent = formatCurrency(transaction.balance);
        
        row.appendChild(dateCell);
        row.appendChild(descCell);
        row.appendChild(categoryCell);
        row.appendChild(amountCell);
        row.appendChild(balanceCell);
        
        fragment.appendChild(row);
    });
    
    // Batch update - single reflow
    dom.transactionsBody.innerHTML = '';
    dom.transactionsBody.appendChild(fragment);
}

function setupFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const filter = btn.getAttribute('data-filter');
            updateTransactionsTable(filter);
        });
    });
}

// Removed - now imported from utils.js

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

// Auth handled by initializeDashboard() at top of file

