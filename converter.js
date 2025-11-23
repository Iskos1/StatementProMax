// Bank Statement Converter using ConvertAPI
import { 
    formatFileSize, 
    escapeHtml, 
    showNotification,
    generateId,
    safeSessionStorageSet
} from './utils.js';

import { initializeYearModal, showYearModal } from './year-modal.js';

// Configuration
const CONFIG = {
    // Switch between sandbox and production tokens
    apiToken: 'ELgjnLbeO8Q8XQjcC6cT8zA4lJEoqRDI', // Sandbox Token
    // apiToken: 'yGOcVvne4JAfBzzLxd45iUzrCCr25kBB', // Production Token (uncomment when ready)
    environment: 'sandbox', // 'sandbox' or 'production'
    apiEndpoint: 'https://v2.convertapi.com/convert/pdf/to/xlsx',
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedFileTypes: ['application/pdf', 'pdf']
};

// State management
const state = {
    files: []  // Removed redundant conversions Map and unused currentlyConverting
};

// Initialize the converter when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeConverter();
    initializeYearModal(); // From imported module
});

function initializeConverter() {
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');
    const convertAllBtn = document.getElementById('convertAllBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');

    // File input change handler
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
    }

    // Drag and drop handlers
    if (uploadArea) {
        uploadArea.addEventListener('dragover', handleDragOver);
        uploadArea.addEventListener('dragleave', handleDragLeave);
        uploadArea.addEventListener('drop', handleFileDrop);
        uploadArea.addEventListener('click', (e) => {
            if (e.target.closest('.btn-primary')) {
                fileInput.click();
            }
        });
    }

    // Convert all button
    if (convertAllBtn) {
        convertAllBtn.addEventListener('click', convertAllFiles);
    }

    // Clear all button
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', clearAllFiles);
    }
}

// Year modal handled by imported module

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
    const validFiles = files.filter(file => validateFile(file));
    
    if (validFiles.length === 0) {
        showNotification('No valid PDF files selected', 'error');
        return;
    }

    validFiles.forEach(file => {
        const fileId = generateId('file');
        const fileData = {
            id: fileId,
            file: file,
            name: file.name,
            size: file.size,
            status: 'pending', // pending, converting, completed, error
            progress: 0,
            downloadUrl: null,
            excelFile: null,
            error: null
        };
        
        state.files.push(fileData);
        // Removed redundant Map storage
    });

    updateFileList();
    showConversionControls();
}

// Validate file
function validateFile(file) {
    // Check file type
    const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPDF) {
        showNotification(`${file.name} is not a PDF file`, 'error');
        return false;
    }

    // Check file size
    if (file.size > CONFIG.maxFileSize) {
        showNotification(`${file.name} exceeds maximum file size of ${formatFileSize(CONFIG.maxFileSize)}`, 'error');
        return false;
    }

    // Check for duplicates
    const isDuplicate = state.files.some(f => f.name === file.name && f.size === file.size);
    if (isDuplicate) {
        showNotification(`${file.name} is already in the queue`, 'warning');
        return false;
    }

    return true;
}

// Update the file list UI
function updateFileList() {
    const fileListContainer = document.getElementById('fileListContainer');
    const fileCount = document.getElementById('fileCount');
    const uploadSection = document.getElementById('uploadSection');

    if (!fileListContainer) return;

    if (state.files.length === 0) {
        fileListContainer.style.display = 'none';
        if (uploadSection) {
            uploadSection.style.display = 'block';
        }
        return;
    }

    fileListContainer.style.display = 'block';
    if (uploadSection) {
        uploadSection.style.display = 'block';
    }

    if (fileCount) {
        fileCount.textContent = state.files.length;
    }

    const fileItemsContainer = document.getElementById('fileItems');
    if (!fileItemsContainer) return;

    fileItemsContainer.innerHTML = state.files.map(fileData => createFileItemHTML(fileData)).join('');

    // Use onclick instead of addEventListener to prevent memory leaks
    // When innerHTML replaces DOM, onclick handlers are automatically garbage collected
    state.files.forEach(fileData => {
        const removeBtn = document.getElementById(`remove-${fileData.id}`);
        if (removeBtn) {
            removeBtn.onclick = () => removeFile(fileData.id);
        }

        const downloadBtn = document.getElementById(`download-${fileData.id}`);
        if (downloadBtn && fileData.downloadUrl) {
            downloadBtn.onclick = () => downloadFile(fileData);
        }

        const analyzeBtn = document.getElementById(`analyze-${fileData.id}`);
        if (analyzeBtn && fileData.excelFile) {
            analyzeBtn.onclick = () => analyzeInDashboard(fileData);
        }
    });
}

// Create HTML for a file item
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

    const icon = statusIcons[fileData.status] || '📄';
    const statusText = statusTexts[fileData.status] || fileData.status;

    let actionButtons = '';
    
    if (fileData.status === 'pending') {
        actionButtons = `
            <button class="btn-convert" onclick="convertSingleFile('${fileData.id}')" title="Convert this file">
                Convert
            </button>
            <button class="btn-remove" id="remove-${fileData.id}" title="Remove from list">
                Remove
            </button>
        `;
    } else if (fileData.status === 'converting') {
        actionButtons = `
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${fileData.progress}%"></div>
            </div>
        `;
    } else if (fileData.status === 'completed') {
        actionButtons = `
            <button class="btn-download" id="download-${fileData.id}" title="Download Excel file">
                Download
            </button>
            <button class="btn-analyze" id="analyze-${fileData.id}" title="Analyze in Dashboard">
                Analyze
            </button>
            <button class="btn-remove" id="remove-${fileData.id}" title="Remove from list">
                Remove
            </button>
        `;
    } else if (fileData.status === 'error') {
        actionButtons = `
            <button class="btn-retry" onclick="convertSingleFile('${fileData.id}')" title="Retry conversion">
                Retry
            </button>
            <button class="btn-remove" id="remove-${fileData.id}" title="Remove from list">
                Remove
            </button>
        `;
    }

    const errorMessage = fileData.error ? `<div class="file-error">${fileData.error}</div>` : '';

    return `
        <div class="file-item status-${fileData.status}" data-file-id="${fileData.id}">
            <div class="file-info">
                <div class="file-icon">${icon}</div>
                <div class="file-details">
                    <div class="file-name">${escapeHtml(fileData.name)}</div>
                    <div class="file-meta">
                        <span class="file-size">${formatFileSize(fileData.size)}</span>
                        <span class="file-status">${statusText}</span>
                    </div>
                    ${errorMessage}
                </div>
            </div>
            <div class="file-actions">
                ${actionButtons}
            </div>
        </div>
    `;
}

// Show conversion controls
function showConversionControls() {
    const controls = document.getElementById('conversionControls');
    if (controls) {
        controls.style.display = state.files.length > 0 ? 'flex' : 'none';
    }
}

// Convert all files
async function convertAllFiles() {
    const pendingFiles = state.files.filter(f => f.status === 'pending' || f.status === 'error');
    
    if (pendingFiles.length === 0) {
        showNotification('No files to convert', 'warning');
        return;
    }

    for (const fileData of pendingFiles) {
        await convertFile(fileData.id);
    }
}

// Convert a single file (exposed globally)
window.convertSingleFile = async function(fileId) {
    await convertFile(fileId);
};

// Convert a file
async function convertFile(fileId) {
    const fileData = state.files.find(f => f.id === fileId);
    if (!fileData) return;

    // Update status
    fileData.status = 'converting';
    fileData.progress = 0;
    fileData.error = null;
    updateFileList();

    let progressInterval;

    try {
        // Prepare form data
        const formData = new FormData();
        formData.append('File', fileData.file);
        formData.append('StoreFile', 'true');

        // Simulate progress
        progressInterval = setInterval(() => {
            if (fileData.progress < 90) {
                fileData.progress += 10;
                updateFileItemProgress(fileId, fileData.progress);
            }
        }, 300);

        // Make API request
        const response = await fetch(`${CONFIG.apiEndpoint}?Secret=${CONFIG.apiToken}`, {
            method: 'POST',
            body: formData
        });

        clearInterval(progressInterval);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.Message || `API Error: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();

        // Check if conversion was successful
        if (!result.Files || result.Files.length === 0) {
            throw new Error('No converted file returned from API');
        }

        const convertedFile = result.Files[0];
        
        // Download the converted file
        const excelBlob = await downloadConvertedFile(convertedFile.Url);
        
        // Update file data
        fileData.status = 'completed';
        fileData.progress = 100;
        fileData.downloadUrl = convertedFile.Url;
        fileData.excelFile = excelBlob;
        fileData.excelFileName = fileData.name.replace(/\.pdf$/i, '.xlsx');

        showNotification(`${fileData.name} converted successfully!`, 'success');

    } catch (error) {
        console.error('Conversion error:', error);
        // Clear interval in catch block to prevent leak
        if (progressInterval) {
            clearInterval(progressInterval);
        }
        fileData.status = 'error';
        fileData.error = error.message || 'Conversion failed. Please try again.';
        showNotification(`Failed to convert ${fileData.name}`, 'error');
    }

    updateFileList();
}

// Download converted file from URL
async function downloadConvertedFile(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error('Failed to download converted file');
    }
    return await response.blob();
}

// Update progress for a specific file item
function updateFileItemProgress(fileId, progress) {
    const fileItem = document.querySelector(`[data-file-id="${fileId}"]`);
    if (!fileItem) return;

    const progressFill = fileItem.querySelector('.progress-fill');
    if (progressFill) {
        progressFill.style.width = `${progress}%`;
    }
}

// Download file
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

// Analyze in dashboard
async function analyzeInDashboard(fileData) {
    if (!fileData.excelFile) return;

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
        showNotification('Invalid year. Please try again.', 'error');
        return;
    }

    // Store the file in sessionStorage for the dashboard to pick up
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

// Remove file from list
function removeFile(fileId) {
    const index = state.files.findIndex(f => f.id === fileId);
    if (index !== -1) {
        const fileName = state.files[index].name;
        state.files.splice(index, 1);
        // Removed redundant Map delete
        updateFileList();
        showConversionControls();
        showNotification(`${fileName} removed`, 'info');
    }
}

// Clear all files
function clearAllFiles() {
    if (state.files.length === 0) return;

    if (confirm('Are you sure you want to clear all files?')) {
        state.files = [];
        // Removed redundant Map clear
        updateFileList();
        showConversionControls();
        showNotification('All files cleared', 'info');
    }
}

// Removed - now imported from utils.js
