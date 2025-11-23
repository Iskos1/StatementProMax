// Dashboard App
let transactions = [];
let allTransactions = []; // Store all transactions from all files
let selectedFiles = [];
let currentMonthFilter = 'all';
let charts = {
    incomeExpense: null,
    category: null
};

// DOM Elements
const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const uploadSection = document.getElementById('uploadSection');
const dashboardContent = document.getElementById('dashboardContent');
const uploadNewBtn = document.getElementById('uploadNewBtn');
const fileList = document.getElementById('fileList');
const fileListItems = document.getElementById('fileListItems');

// File Upload Handlers
fileInput.addEventListener('change', handleFileSelect);

uploadArea.addEventListener('click', () => {
    fileInput.click();
});

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
        // Add to existing files instead of replacing
        selectedFiles = [...selectedFiles, ...files];
        displayFileList();
    }
});

function displayFileList() {
    if (selectedFiles.length === 0) {
        fileList.style.display = 'none';
        return;
    }
    
    fileList.style.display = 'block';
    fileListItems.innerHTML = '';
    
    // Update file count
    document.getElementById('fileCount').textContent = selectedFiles.length;
    
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
        fileListItems.appendChild(fileItem);
    });
}

// Process Files Button Handler
document.getElementById('processFilesBtn').addEventListener('click', () => {
    if (selectedFiles.length > 0) {
        processAllFiles();
    }
});

function removeFile(index) {
    selectedFiles.splice(index, 1);
    displayFileList();
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function processAllFiles() {
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
            const fileTransactions = await processFile(file);
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
    document.getElementById('fileName').textContent = fileNameDisplay;
    
    // Setup month filter
    setupMonthFilter();
    
    // Update dashboard with all data
    updateDashboard();
    
    // Show dashboard
    uploadSection.style.display = 'none';
    dashboardContent.style.display = 'block';
    
    hideLoading();
}

function processFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // Get first sheet
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
                
                // Process transactions
                const fileTransactions = parseTransactions(jsonData);
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
    const monthFilterButtons = document.getElementById('monthFilterButtons');
    monthFilterButtons.innerHTML = '';
    
    // Get unique months from transactions
    const monthsSet = new Set();
    allTransactions.forEach(t => {
        const monthKey = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
        monthsSet.add(monthKey);
    });
    
    const months = Array.from(monthsSet).sort().reverse();
    
    // Add "All Months" button
    const allBtn = document.createElement('button');
    allBtn.className = 'month-btn active';
    allBtn.textContent = 'All Months';
    allBtn.dataset.month = 'all';
    allBtn.onclick = () => filterByMonth('all');
    monthFilterButtons.appendChild(allBtn);
    
    // Add month buttons
    months.forEach(monthKey => {
        const [year, month] = monthKey.split('-');
        const date = new Date(year, parseInt(month) - 1);
        const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        
        const btn = document.createElement('button');
        btn.className = 'month-btn';
        btn.textContent = monthName;
        btn.dataset.month = monthKey;
        btn.onclick = () => filterByMonth(monthKey);
        monthFilterButtons.appendChild(btn);
    });
}

function filterByMonth(monthKey) {
    currentMonthFilter = monthKey;
    
    // Update button states
    document.querySelectorAll('.month-btn').forEach(btn => {
        if (btn.dataset.month === monthKey) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Filter transactions
    if (monthKey === 'all') {
        transactions = allTransactions;
    } else {
        const [year, month] = monthKey.split('-');
        transactions = allTransactions.filter(t => {
            const tYear = t.date.getFullYear();
            const tMonth = t.date.getMonth() + 1;
            return tYear === parseInt(year) && tMonth === parseInt(month);
        });
    }
    
    // Update dashboard with filtered data
    updateDashboard();
}

uploadNewBtn.addEventListener('click', () => {
    uploadSection.style.display = 'block';
    dashboardContent.style.display = 'none';
    fileInput.value = '';
    selectedFiles = [];
    fileList.style.display = 'none';
    fileListItems.innerHTML = '';
});

function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        // Add to existing files instead of replacing
        selectedFiles = [...selectedFiles, ...files];
        displayFileList();
        // Reset file input so same file can be added again if needed
        fileInput.value = '';
    }
}


function parseTransactions(data) {
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
    document.getElementById('totalIncome').textContent = formatCurrency(income);
    document.getElementById('totalExpenses').textContent = formatCurrency(expenses);
    document.getElementById('netBalance').textContent = formatCurrency(netBalance);
    document.getElementById('savingsRate').textContent = savingsRate.toFixed(1) + '%';
    
    document.getElementById('incomeCount').textContent = `${incomeCount} transaction${incomeCount !== 1 ? 's' : ''}`;
    document.getElementById('expenseCount').textContent = `${expenseCount} transaction${expenseCount !== 1 ? 's' : ''}`;
    
    const balanceStatus = netBalance >= 0 ? '↑ Positive' : '↓ Negative';
    document.getElementById('balanceChange').textContent = balanceStatus;
    
    // Update charts
    updateCharts(income, expenses);
    
    // Update transactions table
    updateTransactionsTable('all');
    
    // Setup filter buttons
    setupFilters();
}

function updateCharts(income, expenses) {
    // Destroy existing charts
    if (charts.incomeExpense) charts.incomeExpense.destroy();
    if (charts.category) charts.category.destroy();
    
    // Income vs Expenses Chart
    const incomeExpenseCtx = document.getElementById('incomeExpenseChart').getContext('2d');
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
    
    const categoryCtx = document.getElementById('categoryChart').getContext('2d');
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

function updateTransactionsTable(filter = 'all') {
    const tbody = document.getElementById('transactionsBody');
    tbody.innerHTML = '';
    
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
        
        tbody.appendChild(row);
    });
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

function formatCurrency(amount, showDecimals = true) {
    const abs = Math.abs(amount);
    return showDecimals 
        ? `$${abs.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`
        : `$${Math.round(abs).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function formatDate(date) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
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

// Auth integration (if user is signed in via InstantDB)
try {
    import('https://cdn.jsdelivr.net/npm/@instantdb/core@0.14.30/+esm')
        .then(({ init }) => {
            const APP_ID = '76a8365b-a4b6-48b0-a63b-d7a14d3587ec';
            const db = init({ appId: APP_ID });
            
            db.subscribeAuth((auth) => {
                const dashAuthButtonText = document.getElementById('dashAuthButtonText');
                if (auth.user) {
                    dashAuthButtonText.textContent = auth.user.email.split('@')[0];
                } else {
                    dashAuthButtonText.textContent = 'Sign In';
                }
            });
            
            document.getElementById('dashSignInBtn').addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        })
        .catch(err => {
            console.log('Auth integration not available');
        });
} catch (e) {
    console.log('Auth integration not available');
}


