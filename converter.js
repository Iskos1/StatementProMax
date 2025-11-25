import { 
    formatFileSize, 
    escapeHtml, 
    showNotification,
    generateId,
    safeSessionStorageSet
} from './utils.js';

import { initializeYearModal, showYearModal } from './year-modal.js';

const CONFIG = {
    apiToken: 'ELgjnLbeO8Q8XQjcC6cT8zA4lJEoqRDI',
    apiEndpoint: 'https://v2.convertapi.com/convert/pdf/to/xlsx',
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
        if (downloadBtn && fileData.downloadUrl) downloadBtn.onclick = () => downloadFile(fileData);

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

    let progressInterval = null;

    try {
        const formData = new FormData();
        formData.append('File', fileData.file);
        formData.append('StoreFile', 'true');

        progressInterval = setInterval(() => {
            if (fileData.progress < 90) {
                fileData.progress += 10;
                updateFileItemProgress(fileId, fileData.progress);
            }
        }, 300);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);
        
        const response = await fetch(`${CONFIG.apiEndpoint}?Secret=${CONFIG.apiToken}`, {
            method: 'POST',
            body: formData,
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        clearInterval(progressInterval);
        progressInterval = null;

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.Message || `API Error: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        if (!result.Files || result.Files.length === 0) throw new Error('No converted file returned from API');

        const excelBlob = await fetch(result.Files[0].Url).then(r => {
            if (!r.ok) throw new Error('Failed to download converted file');
            return r.blob();
        });
        
        fileData.status = 'completed';
        fileData.progress = 100;
        fileData.downloadUrl = result.Files[0].Url;
        fileData.excelFile = excelBlob;
        fileData.excelFileName = fileData.name.replace(/\.pdf$/i, '.xlsx');

        showNotification(`${fileData.name} converted successfully!`, 'success');
    } catch (error) {
        if (progressInterval) clearInterval(progressInterval);
        fileData.status = 'error';
        fileData.error = error.name === 'AbortError' ? 'Conversion timed out. File may be too large or complex.' : error.message || 'Conversion failed. Please try again.';
        showNotification(`Failed to convert ${fileData.name}`, 'error');
    } finally {
        if (progressInterval) clearInterval(progressInterval);
    }

    updateFileList();
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

