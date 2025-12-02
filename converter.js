import { 
    formatFileSize, 
    escapeHtml, 
    showNotification,
    generateId,
    safeSessionStorageSet
} from './utils.js';

import { initializeYearModal, showYearModal } from './year-modal.js';

const CONFIG = {
    // ConvertAPI.com credentials
    sandboxToken: 'ELgjnLbeO8Q8XQjcC6cT8zA4lJEoqRDI',
    productionToken: 'yGOcVvne4JAfBzzLxd45iUzrCCr25kBB',
    apiToken: 'ELgjnLbeO8Q8XQjcC6cT8zA4lJEoqRDI', // Using sandbox for testing
    convertEndpoint: 'https://v2.convertapi.com/convert/pdf/to/xlsx',
    maxFileSize: 50 * 1024 * 1024,
    allowedFileTypes: ['application/pdf', 'pdf']
};

const state = { files: [] };

document.addEventListener('DOMContentLoaded', () => {
    initializeConverter();
    initializeYearModal();
});

function initializeConverter() {
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');
    const convertAllBtn = document.getElementById('convertAllBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');

    if (fileInput) fileInput.addEventListener('change', handleFileSelect);

    if (uploadArea) {
        uploadArea.addEventListener('dragover', handleDragOver);
        uploadArea.addEventListener('dragleave', handleDragLeave);
        uploadArea.addEventListener('drop', handleFileDrop);
        uploadArea.addEventListener('click', (e) => {
            if (e.target.closest('.btn-primary')) fileInput.click();
        });
    }

    if (convertAllBtn) convertAllBtn.addEventListener('click', convertAllFiles);
    if (clearAllBtn) clearAllBtn.addEventListener('click', clearAllFiles);
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
}

function handleFileDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('drag-over');
    addFiles(Array.from(e.dataTransfer.files));
}

function handleFileSelect(e) {
    addFiles(Array.from(e.target.files));
}

function addFiles(files) {
    const validFiles = files.filter(validateFile);
    
    if (validFiles.length === 0) {
        showNotification('No valid PDF files selected', 'error');
        return;
    }

    validFiles.forEach(file => {
        state.files.push({
            id: generateId('file'),
            file,
            name: file.name,
            size: file.size,
            status: 'pending',
            progress: 0,
            downloadUrl: null,
            excelFile: null,
            error: null
        });
    });

    updateFileList();
    showConversionControls();
}

function validateFile(file) {
    const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPDF) {
        showNotification(`${file.name} is not a PDF file`, 'error');
        return false;
    }

    if (file.size > CONFIG.maxFileSize) {
        showNotification(`${file.name} exceeds maximum file size of ${formatFileSize(CONFIG.maxFileSize)}`, 'error');
        return false;
    }

    if (state.files.some(f => f.name === file.name && f.size === file.size)) {
        showNotification(`${file.name} is already in the queue`, 'warning');
        return false;
    }

    return true;
}

function updateFileList() {
    const fileListContainer = document.getElementById('fileListContainer');
    const fileCount = document.getElementById('fileCount');
    const uploadSection = document.getElementById('uploadSection');

    if (!fileListContainer) return;

    if (state.files.length === 0) {
        fileListContainer.style.display = 'none';
        if (uploadSection) uploadSection.style.display = 'block';
        return;
    }

    const wasHidden = fileListContainer.style.display === 'none';
    fileListContainer.style.display = 'block';
    if (uploadSection) uploadSection.style.display = 'block';
    if (fileCount) fileCount.textContent = state.files.length;
    
    // Add pulse effect for first-time visibility
    if (wasHidden && state.files.length > 0) {
        fileListContainer.setAttribute('data-new', 'true');
        setTimeout(() => {
            fileListContainer.removeAttribute('data-new');
        }, 6000);
    }
    
    // Smooth scroll to file list to make it obvious
    if (wasHidden && state.files.length > 0) {
        setTimeout(() => {
            fileListContainer.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start',
                inline: 'nearest'
            });
        }, 100);
    }

    const fileItemsContainer = document.getElementById('fileItems');
    if (!fileItemsContainer) return;

    fileItemsContainer.innerHTML = state.files.map(createFileItemHTML).join('');

    state.files.forEach(fileData => {
        const removeBtn = document.getElementById(`remove-${fileData.id}`);
        if (removeBtn) removeBtn.onclick = () => removeFile(fileData.id);

        const downloadBtn = document.getElementById(`download-${fileData.id}`);
        if (downloadBtn && fileData.excelFile) downloadBtn.onclick = () => downloadFile(fileData);

        const analyzeBtn = document.getElementById(`analyze-${fileData.id}`);
        if (analyzeBtn && fileData.excelFile) analyzeBtn.onclick = () => analyzeInDashboard(fileData);
    });
}

function createFileItemHTML(fileData) {
    const statusIcons = { pending: '⏳', converting: '🔄', completed: '✅', error: '❌' };
    const statusTexts = { pending: 'Ready to convert', converting: 'Converting...', completed: 'Completed', error: 'Conversion failed' };

    let actionButtons = '';
    if (fileData.status === 'pending') {
        actionButtons = `
            <button class="btn-convert" onclick="convertSingleFile('${fileData.id}')">Convert</button>
            <button class="btn-remove" id="remove-${fileData.id}">Remove</button>
        `;
    } else if (fileData.status === 'converting') {
        actionButtons = `<div class="progress-bar"><div class="progress-fill" style="width: ${fileData.progress}%"></div></div>`;
    } else if (fileData.status === 'completed') {
        actionButtons = `
            <button class="btn-download" id="download-${fileData.id}">Download</button>
            <button class="btn-analyze" id="analyze-${fileData.id}">Analyze</button>
            <button class="btn-remove" id="remove-${fileData.id}">Remove</button>
        `;
    } else if (fileData.status === 'error') {
        actionButtons = `
            <button class="btn-retry" onclick="convertSingleFile('${fileData.id}')">Retry</button>
            <button class="btn-remove" id="remove-${fileData.id}">Remove</button>
        `;
    }

    return `
        <div class="file-item status-${fileData.status}" data-file-id="${fileData.id}">
            <div class="file-info">
                <div class="file-icon">${statusIcons[fileData.status] || '📄'}</div>
                <div class="file-details">
                    <div class="file-name">${escapeHtml(fileData.name)}</div>
                    <div class="file-meta">
                        <span class="file-size">${formatFileSize(fileData.size)}</span>
                        <span class="file-status">${statusTexts[fileData.status] || fileData.status}</span>
                    </div>
                    ${fileData.error ? `<div class="file-error">${fileData.error}</div>` : ''}
                </div>
            </div>
            <div class="file-actions">${actionButtons}</div>
        </div>
    `;
}

function showConversionControls() {
    const controls = document.getElementById('conversionControls');
    if (controls) controls.style.display = state.files.length > 0 ? 'flex' : 'none';
}

async function convertAllFiles() {
    const pendingFiles = state.files.filter(f => f.status === 'pending' || f.status === 'error');
    if (pendingFiles.length === 0) {
        showNotification('No files to convert', 'warning');
        return;
    }
    for (const fileData of pendingFiles) await convertFile(fileData.id);
}

window.convertSingleFile = async function(fileId) {
    await convertFile(fileId);
};

async function convertFile(fileId) {
    const fileData = state.files.find(f => f.id === fileId);
    if (!fileData) return;

    fileData.status = 'converting';
    fileData.progress = 0;
    fileData.error = null;
    updateFileList();

    try {
        // Step 1: Convert PDF to XLSX using ConvertAPI (0-80%)
        fileData.progress = 10;
        updateFileItemProgress(fileId, fileData.progress);

        showNotification(`🔄 Converting ${fileData.name} to Excel...`, 'info');

        // Read file as base64
        const base64File = await fileToBase64(fileData.file);
        
        fileData.progress = 30;
        updateFileItemProgress(fileId, fileData.progress);

        // Call ConvertAPI
        const convertResponse = await fetch(`${CONFIG.convertEndpoint}?Secret=${CONFIG.apiToken}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                Parameters: [
                    {
                        Name: 'File',
                        FileValue: {
                            Name: fileData.name,
                            Data: base64File
                        }
                    }
                ]
            })
        });

        if (!convertResponse.ok) {
            const errorData = await convertResponse.json().catch(() => ({}));
            throw new Error(errorData.Message || `Conversion failed: ${convertResponse.status}`);
        }

        const convertResult = await convertResponse.json();
        console.log('ConvertAPI result:', convertResult);
        
        fileData.progress = 60;
        updateFileItemProgress(fileId, fileData.progress);

        if (!convertResult.Files || convertResult.Files.length === 0) {
            console.error('Full API response:', convertResult);
            throw new Error('No Excel file returned from API');
        }

        // Step 2: Download the converted XLSX file (60-80%)
        const xlsxFile = convertResult.Files[0];
        console.log('Excel file info:', {
            FileName: xlsxFile.FileName,
            FileSize: xlsxFile.FileSize,
            Url: xlsxFile.Url
        });
        
        showNotification(`📥 Downloading converted file...`, 'info');
        
        let xlsxBlob;
        
        // Try to get the file - ConvertAPI might return base64 data or URL
        if (xlsxFile.FileData) {
            // File data is included in response (base64)
            console.log('Using FileData from response');
            const binaryString = atob(xlsxFile.FileData);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            xlsxBlob = new Blob([bytes], { 
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
            });
        } else if (xlsxFile.Url) {
            // Need to fetch from URL
            console.log('Fetching from URL:', xlsxFile.Url);
            try {
                const xlsxResponse = await fetch(xlsxFile.Url, {
                    mode: 'cors',
                    credentials: 'omit'
                });
                
                if (!xlsxResponse.ok) {
                    console.error('Fetch failed:', xlsxResponse.status, xlsxResponse.statusText);
                    throw new Error(`Failed to download: ${xlsxResponse.status} ${xlsxResponse.statusText}`);
                }
                
                xlsxBlob = await xlsxResponse.blob();
                console.log('Downloaded blob size:', xlsxBlob.size);
            } catch (fetchError) {
                console.error('Fetch error:', fetchError);
                throw new Error(`Download failed: ${fetchError.message}. Try using a different PDF or contact support.`);
            }
        } else {
            throw new Error('No file data or URL in API response');
        }
        
        fileData.progress = 80;
        updateFileItemProgress(fileId, fileData.progress);

        // Step 3: Parse Excel and reformat to 6-column format (80-100%)
        showNotification(`📊 Reformatting to bank statement format...`, 'info');
        
        let finalBlob;
        try {
            finalBlob = await reformatExcelToBankStatement(xlsxBlob, fileData.name);
            console.log('Reformatting successful');
        } catch (reformatError) {
            console.warn('Reformatting failed, using original Excel:', reformatError);
            showNotification(`⚠️ Using original Excel format (reformatting failed)`, 'warning');
            finalBlob = xlsxBlob; // Use original if reformatting fails
        }
        
        fileData.status = 'completed';
        fileData.progress = 100;
        fileData.excelFile = finalBlob;
        fileData.excelFileName = fileData.name.replace(/\.pdf$/i, '.xlsx');

        showNotification(
            `✅ ${fileData.name} converted successfully!`, 
            'success'
        );
        
    } catch (error) {
        fileData.status = 'error';
        fileData.error = error.message || 'Conversion failed. Please try again.';
        showNotification(`❌ Failed to convert ${fileData.name}: ${error.message}`, 'error');
        console.error('Conversion error:', error);
    }

    updateFileList();
}

// Helper function to convert file to base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            // Remove the data:application/pdf;base64, prefix
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Reformat the Excel file from ConvertAPI to our 6-column bank statement format
async function reformatExcelToBankStatement(xlsxBlob, originalFileName) {
    if (typeof XLSX === 'undefined') {
        throw new Error('XLSX library not loaded. Please refresh the page.');
    }

    try {
        // Read the Excel file from ConvertAPI
        const arrayBuffer = await xlsxBlob.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        // Get the first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        console.log('Raw Excel data from ConvertAPI:');
        console.log('- Total rows:', rawData.length);
        console.log('- First 10 rows:', rawData.slice(0, 10));
        
        // Try to parse as transactions
        const transactions = parseExcelDataToTransactions(rawData);
        
        console.log('Parsed transactions:', transactions.length);
        
        if (transactions.length === 0) {
            console.warn('No transactions found in Excel data, returning original file');
            // If no transactions found, return the original file
            return xlsxBlob;
        }
        
        console.log('Sample transactions:', transactions.slice(0, 5));
        
        // Create new workbook with our format
        return await createSingleSheetExcel(transactions, originalFileName);
        
    } catch (error) {
        console.error('Error reformatting Excel:', error);
        // If reformatting fails, return original
        return xlsxBlob;
    }
}

// Parse Excel data to transaction format - ENHANCED for multiple categories
function parseExcelDataToTransactions(data) {
    const transactions = [];
    
    console.log('Parsing Excel data, total rows:', data.length);
    
    // Process ALL rows in the data - don't stop early
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        
        // Skip completely empty rows
        if (!row || row.length === 0) continue;
        
        // Skip rows that are clearly headers or labels
        const rowStr = row.join(' ').toLowerCase();
        if (rowStr.includes('date') && rowStr.includes('description') && rowStr.includes('amount')) {
            console.log('Skipping header row:', row);
            continue;
        }
        if (rowStr.includes('category:') || rowStr.includes('section:')) {
            console.log('Skipping category label row:', row);
            continue;
        }
        
        // Try to identify date, description, and amount
        let date = null;
        let description = '';
        let amount = null;
        let hasDateColumn = false;
        let hasAmountColumn = false;
        
        // First pass: identify what we have
        for (let j = 0; j < row.length; j++) {
            const cell = row[j];
            if (!cell) continue;
            
            const cellStr = String(cell).trim();
            if (!cellStr) continue;
            
            // Check if it's a date
            if (isDate(cell)) {
                if (!date) {
                    date = normalizeExcelDate(cell);
                    hasDateColumn = true;
                }
            }
            // Check if it's an amount (look for numbers with decimals or currency)
            else if (isAmount(cell)) {
                if (amount === null) {
                    const cleanAmount = String(cell).replace(/[$,\s]/g, '');
                    amount = parseFloat(cleanAmount);
                    hasAmountColumn = true;
                }
            }
        }
        
        // Second pass: build description from non-date, non-amount cells
        for (let j = 0; j < row.length; j++) {
            const cell = row[j];
            if (!cell) continue;
            
            const cellStr = String(cell).trim();
            if (!cellStr) continue;
            
            // Skip if it's the date or amount we already captured
            if (isDate(cell) || isAmount(cell)) continue;
            
            // Skip if it's just whitespace or punctuation
            if (/^[\s\-_,.;:]+$/.test(cellStr)) continue;
            
            // Add to description
            if (description) {
                description += ' ' + cellStr;
            } else {
                description = cellStr;
            }
        }
        
        // Clean up description
        description = description.trim();
        
        // Only add if we have ALL required fields
        if (date && hasDateColumn && amount !== null && hasAmountColumn && description) {
            // Skip if description is too short (likely noise)
            if (description.length < 2) continue;
            
            transactions.push({ 
                date, 
                description, 
                amount,
                sourceRow: i // For debugging
            });
            
            console.log(`Found transaction at row ${i}:`, { date, description, amount });
        }
    }
    
    console.log(`Successfully parsed ${transactions.length} transactions`);
    
    return transactions;
}

// Check if value looks like a date - ENHANCED
function isDate(value) {
    if (!value) return false;
    const str = String(value).trim();
    if (!str) return false;
    
    // Check for common date patterns
    const datePatterns = [
        /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/,     // MM/DD/YY or MM-DD-YYYY
        /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/,       // YYYY-MM-DD
        /^\d{1,2}\/\d{1,2}$/,                       // MM/DD
        /^[A-Za-z]{3}\s+\d{1,2},?\s+\d{4}$/,       // Jan 15, 2024
        /^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$/          // 15 Jan 2024
    ];
    
    for (const pattern of datePatterns) {
        if (pattern.test(str)) return true;
    }
    
    // Try parsing as date (be more strict)
    const parsed = Date.parse(str);
    if (!isNaN(parsed)) {
        const date = new Date(parsed);
        // Make sure it's a reasonable year (1900-2100)
        const year = date.getFullYear();
        return year >= 1900 && year <= 2100;
    }
    
    return false;
}

// Check if value looks like an amount - ENHANCED
function isAmount(value) {
    if (!value) return false;
    const str = String(value).trim();
    if (!str) return false;
    
    // Remove common currency symbols and whitespace
    const cleaned = str.replace(/[$£€¥\s]/g, '');
    
    // Check for amount patterns (including negative/positive, with/without commas)
    const amountPatterns = [
        /^-?\d{1,3}(,?\d{3})*(\.\d{1,2})?$/,  // 1,234.56 or -1234.56
        /^\(\d{1,3}(,?\d{3})*(\.\d{1,2})?\)$/, // (1,234.56) for negative
        /^-?\d+\.\d{2}$/,                       // 123.45
        /^-?\d+$/                               // 123 (whole numbers)
    ];
    
    for (const pattern of amountPatterns) {
        if (pattern.test(cleaned)) {
            // Make sure it's not just a year (4 digits)
            if (/^\d{4}$/.test(cleaned)) {
                return false; // This is likely a year, not an amount
            }
            return true;
        }
    }
    
    return false;
}

// Normalize Excel date to YYYY-MM-DD
function normalizeExcelDate(value) {
    try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
    } catch (e) {
        // Fallback to string parsing
        return normalizeDateFormat(String(value));
    }
    return String(value);
}

// ConvertAPI doesn't require polling - it's synchronous

// Create a SINGLE Excel sheet with ONLY transaction data
async function createSingleSheetExcel(transactions, originalFileName) {
    if (typeof XLSX === 'undefined') {
        throw new Error('XLSX library not loaded. Please refresh the page.');
    }

    // Filter and consolidate all transactions into one array
    const consolidatedTransactions = transactions.filter(t => 
        t.date && t.description && t.amount // Only include rows with all required fields
    );

    if (consolidatedTransactions.length === 0) {
        throw new Error('No valid transactions found in the statement');
    }

    // Create worksheet data with proper bank statement format
    const wsData = [
        ['Date', 'Check Number', 'Description', 'Deposits', 'Withdrawals', 'Balance']
    ];

    let runningBalance = 0;

    // Add all transactions with proper column mapping
    consolidatedTransactions.forEach(transaction => {
        const amount = parseFloat(transaction.amount) || 0;
        const isDeposit = amount > 0;
        
        // Update running balance
        runningBalance += amount;
        
        // Normalize date format (API returns MM/DD/YY, we want YYYY-MM-DD)
        const normalizedDate = normalizeDateFormat(transaction.date);
        
        wsData.push([
            normalizedDate,                                  // Date
            '',                                               // Check Number (leave empty for now)
            transaction.description || '',                    // Description
            isDeposit ? Math.abs(amount) : '',               // Deposits (positive amounts)
            !isDeposit ? Math.abs(amount) : '',              // Withdrawals (negative amounts)
            runningBalance.toFixed(2)                        // Balance
        ]);
    });

    // Create workbook with SINGLE sheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Format columns for better readability
    ws['!cols'] = [
        { wch: 12 },  // Date column width
        { wch: 12 },  // Check Number column width
        { wch: 40 },  // Description column width
        { wch: 15 },  // Deposits column width
        { wch: 15 },  // Withdrawals column width
        { wch: 15 }   // Balance column width
    ];

    // Format currency columns (Deposits, Withdrawals, Balance)
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let row = 1; row <= range.e.r; row++) {
        // Format Deposits (column D)
        const depositsCell = XLSX.utils.encode_cell({ r: row, c: 3 });
        if (ws[depositsCell] && ws[depositsCell].v !== '') {
            ws[depositsCell].z = '#,##0.00';
            ws[depositsCell].t = 'n';
        }
        
        // Format Withdrawals (column E)
        const withdrawalsCell = XLSX.utils.encode_cell({ r: row, c: 4 });
        if (ws[withdrawalsCell] && ws[withdrawalsCell].v !== '') {
            ws[withdrawalsCell].z = '#,##0.00';
            ws[withdrawalsCell].t = 'n';
        }
        
        // Format Balance (column F)
        const balanceCell = XLSX.utils.encode_cell({ r: row, c: 5 });
        if (ws[balanceCell] && ws[balanceCell].v !== '') {
            ws[balanceCell].z = '#,##0.00';
            ws[balanceCell].t = 'n';
        }
    }

    // Add only ONE sheet named "Transactions"
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

    // Generate Excel file
    const excelBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    return new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
}

// Normalize date format from API (MM/DD/YY) to Excel format (YYYY-MM-DD)
function normalizeDateFormat(dateStr) {
    if (!dateStr) return '';
    
    try {
        // Handle MM/DD/YY format from API
        const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
        if (match) {
            let [, month, day, year] = match;
            
            // Convert 2-digit year to 4-digit
            if (year.length === 2) {
                const currentYear = new Date().getFullYear();
                const currentCentury = Math.floor(currentYear / 100) * 100;
                const yearNum = parseInt(year);
                
                // If year is greater than current year's last 2 digits, assume previous century
                if (yearNum > (currentYear % 100)) {
                    year = String(currentCentury - 100 + yearNum);
                } else {
                    year = String(currentCentury + yearNum);
                }
            }
            
            // Pad month and day with leading zeros
            month = month.padStart(2, '0');
            day = day.padStart(2, '0');
            
            return `${year}-${month}-${day}`;
        }
        
        // If already in YYYY-MM-DD format, return as is
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return dateStr;
        }
        
        // Fallback: return original
        return dateStr;
        
    } catch (error) {
        console.error('Date normalization error:', error);
        return dateStr;
    }
}

function updateFileItemProgress(fileId, progress) {
    const progressFill = document.querySelector(`[data-file-id="${fileId}"] .progress-fill`);
    if (progressFill) progressFill.style.width = `${progress}%`;
}

function downloadFile(fileData) {
    if (!fileData.excelFile) return;

    const url = URL.createObjectURL(fileData.excelFile);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileData.excelFileName || 'converted.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNotification(`Downloading ${fileData.excelFileName}`, 'success');
}

async function analyzeInDashboard(fileData) {
    if (!fileData.excelFile) return;

    let year;
    try {
        year = await showYearModal();
    } catch {
        return;
    }

    if (isNaN(year) || year < 1900 || year > 2100) {
        showNotification('Invalid year. Please try again.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const success = safeSessionStorageSet('pendingAnalysisFile', {
            name: fileData.excelFileName,
            data: e.target.result,
            year,
            timestamp: Date.now(),
            transactionData: fileData.transactionData || null
        });
        
        if (success) {
            window.location.href = 'dashboard.html';
        } else {
            showNotification('Unable to transfer file to dashboard. File may be too large.', 'error');
        }
    };
    reader.readAsDataURL(fileData.excelFile);
}

function removeFile(fileId) {
    const index = state.files.findIndex(f => f.id === fileId);
    if (index !== -1) {
        const fileName = state.files[index].name;
        state.files.splice(index, 1);
        updateFileList();
        showConversionControls();
        showNotification(`${fileName} removed`, 'info');
    }
}

function clearAllFiles() {
    if (state.files.length === 0) return;
    if (confirm('Are you sure you want to clear all files?')) {
        state.files = [];
        updateFileList();
        showConversionControls();
        showNotification('All files cleared', 'info');
    }
}

