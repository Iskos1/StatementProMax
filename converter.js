// Simplified PDF to Excel Converter - Uses ConvertAPI directly
import { 
    formatFileSize, 
    escapeHtml, 
    showNotification,
    generateId,
    safeSessionStorageSet,
    handleError
} from './utils.js';

import { initializeYearModal, showYearModal } from './year-modal.js';

// API Configuration
const CONFIG = {
    apiToken: 'yGOcVvne4JAfBzzLxd45iUzrCCr25kBB',
    convertEndpoint: 'https://v2.convertapi.com/convert/pdf/to/xlsx',
    maxFileSize: 50 * 1024 * 1024  // 50MB
};

// State
const state = { files: [] };

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    try {
        initializeConverter();
        initializeYearModal();
    } catch (error) {
        handleError(error, 'Converter initialization', true);
    }
});

// Set up event listeners
function initializeConverter() {
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');
    const convertAllBtn = document.getElementById('convertAllBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');

    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
    }

    if (uploadArea) {
        uploadArea.addEventListener('dragover', handleDragOver);
        uploadArea.addEventListener('dragleave', handleDragLeave);
        uploadArea.addEventListener('drop', handleFileDrop);
        uploadArea.addEventListener('click', function(e) {
            if (e.target.closest('.btn-primary')) {
                fileInput.click();
            }
        });
    }

    if (convertAllBtn) {
        convertAllBtn.addEventListener('click', convertAllFiles);
    }
    
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', clearAllFiles);
    }
}

// Drag and drop handlers
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
    
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
}

function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    addFiles(files);
}

// Add files to the queue
function addFiles(files) {
    const validFiles = [];
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Check if PDF
        const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        if (!isPDF) {
            showNotification(file.name + ' is not a PDF file', 'error');
            continue;
        }
        
        // Check file size
        if (file.size > CONFIG.maxFileSize) {
            showNotification(file.name + ' exceeds maximum file size of ' + formatFileSize(CONFIG.maxFileSize), 'error');
            continue;
        }
        
        // Check for duplicates
        let isDuplicate = false;
        for (let j = 0; j < state.files.length; j++) {
            if (state.files[j].name === file.name && state.files[j].size === file.size) {
                isDuplicate = true;
                break;
            }
        }
        
        if (isDuplicate) {
            showNotification(file.name + ' is already in the queue', 'warning');
            continue;
        }
        
        validFiles.push(file);
    }
    
    if (validFiles.length === 0) {
        showNotification('No valid PDF files selected', 'error');
        return;
    }
    
    // Add valid files to state
    for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        state.files.push({
            id: generateId('file'),
            file: file,
            name: file.name,
            size: file.size,
            status: 'pending',
            progress: 0,
            excelFile: null,
            excelFileName: null,
            error: null
        });
    }
    
    updateFileList();
    showConversionControls();
}

// Update the file list display
function updateFileList() {
    const fileListContainer = document.getElementById('fileListContainer');
    const fileCount = document.getElementById('fileCount');
    const uploadSection = document.getElementById('uploadSection');
    const fileItemsContainer = document.getElementById('fileItems');

    if (!fileListContainer) return;

    // Hide if no files
    if (state.files.length === 0) {
        fileListContainer.style.display = 'none';
        if (uploadSection) uploadSection.style.display = 'block';
        return;
    }

    // Show file list
    const wasHidden = fileListContainer.style.display === 'none';
    fileListContainer.style.display = 'block';
    if (uploadSection) uploadSection.style.display = 'block';
    if (fileCount) fileCount.textContent = state.files.length;

    // Scroll to file list if just appeared
    if (wasHidden && state.files.length > 0) {
        setTimeout(function() {
            fileListContainer.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start'
            });
        }, 100);
    }

    if (!fileItemsContainer) return;

    // Build HTML for all files
    let html = '';
    for (let i = 0; i < state.files.length; i++) {
        html = html + createFileItemHTML(state.files[i]);
    }
    fileItemsContainer.innerHTML = html;

    // Attach event handlers
    for (let i = 0; i < state.files.length; i++) {
        const fileData = state.files[i];
        
        const removeBtn = document.getElementById('remove-' + fileData.id);
        if (removeBtn) {
            removeBtn.onclick = function() {
                removeFile(fileData.id);
            };
        }

        const downloadBtn = document.getElementById('download-' + fileData.id);
        if (downloadBtn && fileData.excelFile) {
            downloadBtn.onclick = function() {
                downloadFile(fileData);
            };
        }

        const analyzeBtn = document.getElementById('analyze-' + fileData.id);
        if (analyzeBtn && fileData.excelFile) {
            analyzeBtn.onclick = function() {
                analyzeInDashboard(fileData);
            };
        }
    }
}

// Create HTML for a single file item
function createFileItemHTML(fileData) {
    const statusIcons = {
        pending: '⏳',
        converting: '🔄',
        completed: '✅',
        error: '❌'
    };
    
    const statusTexts = {
        pending: 'Ready to convert',
        converting: 'Converting...',
        completed: 'Completed',
        error: 'Conversion failed'
    };

    let actionButtons = '';
    
    if (fileData.status === 'pending') {
        actionButtons = '<button class="btn-convert" onclick="convertSingleFile(\'' + fileData.id + '\')">Convert</button>' +
                       '<button class="btn-remove" id="remove-' + fileData.id + '">Remove</button>';
    } else if (fileData.status === 'converting') {
        actionButtons = '<div class="progress-bar"><div class="progress-fill" style="width: ' + fileData.progress + '%"></div></div>';
    } else if (fileData.status === 'completed') {
        actionButtons = '<button class="btn-download" id="download-' + fileData.id + '">Download</button>' +
                       '<button class="btn-analyze" id="analyze-' + fileData.id + '">Analyze</button>' +
                       '<button class="btn-remove" id="remove-' + fileData.id + '">Remove</button>';
    } else if (fileData.status === 'error') {
        actionButtons = '<button class="btn-retry" onclick="convertSingleFile(\'' + fileData.id + '\')">Retry</button>' +
                       '<button class="btn-remove" id="remove-' + fileData.id + '">Remove</button>';
    }

    let errorHtml = '';
    if (fileData.error) {
        errorHtml = '<div class="file-error">' + escapeHtml(fileData.error) + '</div>';
    }

    const icon = statusIcons[fileData.status] || '📄';
    const statusText = statusTexts[fileData.status] || fileData.status;

    return '<div class="file-item status-' + fileData.status + '" data-file-id="' + fileData.id + '">' +
           '<div class="file-info">' +
           '<div class="file-icon">' + icon + '</div>' +
           '<div class="file-details">' +
           '<div class="file-name">' + escapeHtml(fileData.name) + '</div>' +
           '<div class="file-meta">' +
           '<span class="file-size">' + formatFileSize(fileData.size) + '</span>' +
           '<span class="file-status">' + statusText + '</span>' +
           '</div>' +
           errorHtml +
           '</div>' +
           '</div>' +
           '<div class="file-actions">' + actionButtons + '</div>' +
           '</div>';
}

// Show/hide conversion controls
function showConversionControls() {
    const controls = document.getElementById('conversionControls');
    if (controls) {
        if (state.files.length > 0) {
            controls.style.display = 'flex';
        } else {
            controls.style.display = 'none';
        }
    }
}

// Convert all pending files
async function convertAllFiles() {
    const pendingFiles = [];
    for (let i = 0; i < state.files.length; i++) {
        if (state.files[i].status === 'pending' || state.files[i].status === 'error') {
            pendingFiles.push(state.files[i]);
        }
    }
    
    if (pendingFiles.length === 0) {
        showNotification('No files to convert', 'warning');
        return;
    }
    
    for (let i = 0; i < pendingFiles.length; i++) {
        await convertFile(pendingFiles[i].id);
    }
}

// Convert a single file (exposed globally for onclick)
window.convertSingleFile = async function(fileId) {
    await convertFile(fileId);
};

// Main conversion function - Uses API directly
async function convertFile(fileId) {
    // Find the file
    let fileData = null;
    for (let i = 0; i < state.files.length; i++) {
        if (state.files[i].id === fileId) {
            fileData = state.files[i];
            break;
        }
    }
    
    if (!fileData) return;

    // Update status
    fileData.status = 'converting';
    fileData.progress = 0;
    fileData.error = null;
    updateFileList();

    try {
        // Step 1: Read file as base64
        showNotification('🔄 Reading file: ' + fileData.name, 'info');
        fileData.progress = 10;
        updateProgress(fileId, 10);
        
        const base64Data = await readFileAsBase64(fileData.file);
        
        fileData.progress = 20;
        updateProgress(fileId, 20);

        // Step 2: Send to ConvertAPI
        showNotification('🔄 Converting to Excel...', 'info');
        
        const apiUrl = CONFIG.convertEndpoint + '?Secret=' + CONFIG.apiToken;
        
        const response = await fetch(apiUrl, {
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
                            Data: base64Data
                        }
                    }
                ]
            })
        });

        fileData.progress = 50;
        updateProgress(fileId, 50);

        if (!response.ok) {
            let errorMessage = 'Conversion failed: ' + response.status;
            try {
                const errorData = await response.json();
                if (errorData.Message) {
                    errorMessage = errorData.Message;
                }
            } catch (e) {
                // Ignore JSON parse error
            }
            throw new Error(errorMessage);
        }

        const result = await response.json();
        console.log('API Response:', result);
        
        fileData.progress = 70;
        updateProgress(fileId, 70);

        // Step 3: Get the Excel file
        if (!result.Files || result.Files.length === 0) {
            throw new Error('No Excel file returned from API');
        }

        const excelFileInfo = result.Files[0];
        console.log('Excel file info:', excelFileInfo);
        
        showNotification('📥 Downloading converted file...', 'info');
        
        let excelBlob;
        
        // Check if file data is in response
        if (excelFileInfo.FileData) {
            // Convert base64 to blob
            const binaryString = atob(excelFileInfo.FileData);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            excelBlob = new Blob([bytes], { 
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
            });
        } else if (excelFileInfo.Url) {
            // Download from URL
            const downloadResponse = await fetch(excelFileInfo.Url);
            if (!downloadResponse.ok) {
                throw new Error('Failed to download converted file');
            }
            excelBlob = await downloadResponse.blob();
        } else {
            throw new Error('No file data or URL in API response');
        }

        fileData.progress = 100;
        updateProgress(fileId, 100);

        // Success!
        fileData.status = 'completed';
        fileData.excelFile = excelBlob;
        fileData.excelFileName = fileData.name.replace(/\.pdf$/i, '.xlsx');
        
        showNotification('✅ ' + fileData.name + ' converted successfully!', 'success');

    } catch (error) {
        console.error('Conversion error:', error);
        fileData.status = 'error';
        fileData.error = error.message || 'Conversion failed. Please try again.';
        showNotification('❌ Failed to convert ' + fileData.name + ': ' + error.message, 'error');
    }

    updateFileList();
}

// Read file as base64
function readFileAsBase64(file) {
    return new Promise(function(resolve, reject) {
        const reader = new FileReader();
        
        reader.onload = function() {
            // Remove the data URL prefix
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        
        reader.onerror = function() {
            reject(new Error('Failed to read file'));
        };
        
        reader.readAsDataURL(file);
    });
}

// Update progress bar
function updateProgress(fileId, progress) {
    const progressFill = document.querySelector('[data-file-id="' + fileId + '"] .progress-fill');
    if (progressFill) {
        progressFill.style.width = progress + '%';
    }
}

// Download converted file
function downloadFile(fileData) {
    if (!fileData.excelFile) return;

    const url = URL.createObjectURL(fileData.excelFile);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileData.excelFileName || 'converted.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showNotification('📥 Downloading ' + fileData.excelFileName, 'success');
}

// Analyze file in dashboard
async function analyzeInDashboard(fileData) {
    if (!fileData.excelFile) return;

    // Ask for year
    let year;
    try {
        year = await showYearModal();
    } catch (e) {
        return; // User cancelled
    }

    if (isNaN(year) || year < 1900 || year > 2100) {
        showNotification('Invalid year. Please try again.', 'error');
        return;
    }

    // Read file and store in session
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const success = safeSessionStorageSet('pendingAnalysisFile', {
            name: fileData.excelFileName,
            data: e.target.result,
            year: year,
            timestamp: Date.now()
        });
        
        if (success) {
            window.location.href = 'dashboard.html';
        } else {
            showNotification('Unable to transfer file to dashboard. File may be too large.', 'error');
        }
    };
    
    reader.readAsDataURL(fileData.excelFile);
}

// Remove file from queue
function removeFile(fileId) {
    let index = -1;
    let fileName = '';
    
    for (let i = 0; i < state.files.length; i++) {
        if (state.files[i].id === fileId) {
            index = i;
            fileName = state.files[i].name;
            break;
        }
    }
    
    if (index !== -1) {
        state.files.splice(index, 1);
        updateFileList();
        showConversionControls();
        showNotification(fileName + ' removed', 'info');
    }
}

// Clear all files
function clearAllFiles() {
    if (state.files.length === 0) return;
    
    if (confirm('Are you sure you want to clear all files?')) {
        state.files = [];
        updateFileList();
        showConversionControls();
        showNotification('All files cleared', 'info');
    }
}
