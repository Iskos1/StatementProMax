// Shared File History Module - Works from both homepage and dashboard
import {
    getFileHistory,
    getFileHistoryById,
    deleteFileHistory,
    clearFileHistory,
    getFileHistoryStats,
    initializeDB
} from './transaction-db.js';

import {
    formatFileSize,
    formatCurrency,
    escapeHtml,
    showNotification,
    handleError
} from './utils.js';

// Update file history statistics
export async function updateFileHistoryStats() {
    try {
        const stats = await getFileHistoryStats();
        
        const totalFiles = document.getElementById('totalFilesCount');
        const totalTransactions = document.getElementById('totalTransactionsCount');
        const storageUsed = document.getElementById('storageUsed');
        
        if (totalFiles) totalFiles.textContent = stats.totalFiles || 0;
        if (totalTransactions) totalTransactions.textContent = stats.totalTransactions || 0;
        if (storageUsed) {
            const sizeMB = (stats.totalSize / 1024 / 1024).toFixed(2);
            storageUsed.textContent = `${sizeMB} MB`;
        }
    } catch (error) {
        console.error('Failed to update file history stats:', error);
    }
}

// Render file history list
export async function renderFileHistoryList(searchFilter = '') {
    const listContainer = document.getElementById('fileHistoryList');
    if (!listContainer) return;
    
    try {
        const files = await getFileHistory(100);
        
        if (files.length === 0) {
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #6a6a6a;">
                    <div style="font-size: 48px; margin-bottom: 16px;">📁</div>
                    <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">No files uploaded yet</div>
                    <div style="font-size: 14px;">Upload your first Excel file to see it here</div>
                </div>
            `;
            return;
        }
        
        // Filter files if search term provided
        const filteredFiles = searchFilter 
            ? files.filter(f => f.fileName.toLowerCase().includes(searchFilter.toLowerCase()))
            : files;
        
        if (filteredFiles.length === 0) {
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #6a6a6a;">
                    <div style="font-size: 32px; margin-bottom: 12px;">🔍</div>
                    <div style="font-size: 16px; font-weight: 600;">No files match your search</div>
                </div>
            `;
            return;
        }
        
        listContainer.innerHTML = filteredFiles.map(file => {
            const uploadDate = new Date(file.uploadDate);
            const dateStr = uploadDate.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            const fileSizeStr = formatFileSize(file.fileSize);
            const income = file.summary?.totalIncome || 0;
            const expenses = file.summary?.totalExpenses || 0;
            const netBalance = file.summary?.netBalance || (income - expenses);
            
            return `
                <div class="learned-pattern-item" data-file-id="${file.id}">
                    <div class="learned-pattern-main">
                        <div class="learned-pattern-icon">📄</div>
                        <div class="learned-pattern-info">
                            <div class="learned-pattern-name">${escapeHtml(file.fileName)}</div>
                            <div class="learned-pattern-details">
                                <span>📅 ${dateStr}</span>
                                <span>•</span>
                                <span>📊 ${file.transactionCount} transactions</span>
                                <span>•</span>
                                <span>💾 ${fileSizeStr}</span>
                                ${file.year ? `<span>•</span><span>📆 Year: ${file.year}</span>` : ''}
                            </div>
                            ${file.summary ? `
                                <div class="learned-pattern-meta" style="margin-top: 8px; font-size: 13px; color: #6a6a6a;">
                                    <span style="color: #22c55e;">💰 Income: ${formatCurrency(income)}</span>
                                    <span style="margin: 0 8px;">•</span>
                                    <span style="color: #ef4444;">💸 Expenses: ${formatCurrency(expenses)}</span>
                                    <span style="margin: 0 8px;">•</span>
                                    <span style="color: ${netBalance >= 0 ? '#22c55e' : '#ef4444'}; font-weight: 600;">
                                        Balance: ${formatCurrency(netBalance)}
                                    </span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="learned-pattern-actions">
                        <button class="btn-outline btn-small" onclick="reloadFileFromHistory(${file.id})" title="Reload this file">
                            🔄 Reload
                        </button>
                        <button class="btn-outline btn-small btn-danger" onclick="deleteFileFromHistory(${file.id})" title="Delete from history">
                            🗑️ Delete
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Failed to render file history:', error);
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ef4444;">
                <div style="font-size: 32px; margin-bottom: 12px;">❌</div>
                <div style="font-size: 16px; font-weight: 600;">Error loading file history</div>
                <div style="font-size: 14px; margin-top: 8px;">${error.message}</div>
            </div>
        `;
    }
}

// Setup file history listeners
export function setupFileHistoryListeners() {
    // Close button
    const closeBtn = document.getElementById('closeFileHistoryModal');
    if (closeBtn) {
        closeBtn.onclick = () => {
            const modal = document.getElementById('fileHistoryModal');
            if (modal) modal.style.display = 'none';
        };
    }
    
    // Search input
    const searchInput = document.getElementById('fileHistorySearch');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                renderFileHistoryList(e.target.value);
            }, 300);
        });
    }
    
    // Clear all button
    const clearAllBtn = document.getElementById('clearAllHistoryBtn');
    if (clearAllBtn) {
        clearAllBtn.onclick = handleClearAllFileHistory;
    }
}

// Reload file from history (works from both pages)
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
        
        // Check if we're on dashboard or homepage
        const isDashboard = window.location.pathname.includes('dashboard.html');
        
        if (isDashboard) {
            // On dashboard - check if dashboard's reload function exists (it should override this)
            // If not, navigate to dashboard with file data
            if (typeof window.loadConvertedFile === 'function') {
                // Try to call showLoading if it exists (dashboard has it)
                if (typeof showLoading === 'function') {
                    showLoading();
                }
                await window.loadConvertedFile(fileData.fileName, fileData.fileData, fileData.year);
                showNotification(`Reloaded: ${fileData.fileName}`, 'success');
                return;
            }
        }
        
        // On homepage or fallback - navigate to dashboard with file data
        sessionStorage.setItem('pendingAnalysisFile', JSON.stringify({
            name: fileData.fileName,
            data: fileData.fileData,
            year: fileData.year,
            timestamp: Date.now()
        }));
        window.location.href = 'dashboard.html';
    } catch (error) {
        console.error('Failed to reload file from history:', error);
        showNotification('Failed to reload file', 'error');
    }
};

// Delete file from history
window.deleteFileFromHistory = async function(fileId) {
    if (!confirm('Delete this file from history?\n\nThis will remove it from your history but won\'t affect your current dashboard.')) {
        return;
    }
    
    try {
        await deleteFileHistory(fileId);
        await updateFileHistoryStats();
        await renderFileHistoryList();
        showNotification('File deleted from history', 'success');
    } catch (error) {
        console.error('Failed to delete file from history:', error);
        showNotification('Failed to delete file', 'error');
    }
};

// Handle clear all file history
async function handleClearAllFileHistory() {
    try {
        const stats = await getFileHistoryStats();
        if (stats.totalFiles === 0) {
            showNotification('No files to clear', 'info');
            return;
        }
        
        if (!confirm(`Clear ALL ${stats.totalFiles} file(s) from history?\n\nThis will permanently delete all uploaded file records.\n\nThis action cannot be undone!`)) {
            return;
        }
        
        await clearFileHistory();
        await updateFileHistoryStats();
        await renderFileHistoryList();
        showNotification('All file history cleared', 'success');
    } catch (error) {
        console.error('Failed to clear file history:', error);
        showNotification('Failed to clear history', 'error');
    }
}

// Show file history modal
export async function showFileHistoryModal() {
    const modal = document.getElementById('fileHistoryModal');
    if (!modal) {
        handleError(new Error('File history modal not found'), 'showFileHistoryModal', false);
        return;
    }
    
    try {
        // Initialize database if needed (uses static import from top of file)
        await initializeDB();
        
        // Update stats
        await updateFileHistoryStats();
        
        // Render file list
        await renderFileHistoryList();
        
        // Setup listeners
        setupFileHistoryListeners();
        
        // Show modal
        modal.style.display = 'flex';
    } catch (error) {
        handleError(error, 'showFileHistoryModal', true);
    }
}

