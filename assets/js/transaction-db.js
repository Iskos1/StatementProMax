// Transaction Database - IndexedDB for Persistent Categorization Learning
// This module provides persistent storage for transaction categorization patterns

const DB_NAME = 'TransactionCategorizationDB';
const DB_VERSION = 2; // Incremented to add FILE_HISTORY store
const STORES = {
    PATTERNS: 'categorization_patterns',    // Stores learned categorization patterns
    TRANSACTIONS: 'transaction_history',     // Stores historical transactions
    DISSIMILAR: 'dissimilar_pairs',          // Stores pairs marked as dissimilar
    FILE_HISTORY: 'file_history'             // Stores uploaded Excel file history
};

let dbInstance = null;

/**
 * Initialize the IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
export async function initializeDB() {
    if (dbInstance) return dbInstance;
    
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => {
            console.error('Failed to open database:', request.error);
            reject(request.error);
        };
        
        request.onsuccess = () => {
            dbInstance = request.result;
            resolve(dbInstance);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            const oldVersion = event.oldVersion;
            
            // Create categorization patterns store
            if (!db.objectStoreNames.contains(STORES.PATTERNS)) {
                const patternStore = db.createObjectStore(STORES.PATTERNS, { keyPath: 'id', autoIncrement: true });
                patternStore.createIndex('normalizedDescription', 'normalizedDescription', { unique: false });
                patternStore.createIndex('merchantName', 'merchantName', { unique: false });
                patternStore.createIndex('category', 'category', { unique: false });
                patternStore.createIndex('lastUsed', 'lastUsed', { unique: false });
            }
            
            // Create transaction history store
            if (!db.objectStoreNames.contains(STORES.TRANSACTIONS)) {
                const transactionStore = db.createObjectStore(STORES.TRANSACTIONS, { keyPath: 'id', autoIncrement: true });
                transactionStore.createIndex('description', 'description', { unique: false });
                transactionStore.createIndex('normalizedDescription', 'normalizedDescription', { unique: false });
                transactionStore.createIndex('category', 'category', { unique: false });
                transactionStore.createIndex('date', 'date', { unique: false });
                transactionStore.createIndex('merchantName', 'merchantName', { unique: false });
            }
            
            // Create dissimilar pairs store
            if (!db.objectStoreNames.contains(STORES.DISSIMILAR)) {
                const dissimilarStore = db.createObjectStore(STORES.DISSIMILAR, { keyPath: 'pairKey' });
                dissimilarStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
            
            // Create file history store
            if (!db.objectStoreNames.contains(STORES.FILE_HISTORY)) {
                const fileHistoryStore = db.createObjectStore(STORES.FILE_HISTORY, { keyPath: 'id', autoIncrement: true });
                fileHistoryStore.createIndex('fileName', 'fileName', { unique: false });
                fileHistoryStore.createIndex('uploadDate', 'uploadDate', { unique: false });
                fileHistoryStore.createIndex('fileSize', 'fileSize', { unique: false });
            }
        };
    });
}

/**
 * Normalize a transaction description for matching
 * @param {string} description 
 * @returns {string}
 */
function normalizeDescription(description) {
    return String(description || '')
        .toLowerCase()
        .replace(/\d+/g, '') // Remove numbers
        .replace(/[^\w\s]/g, ' ') // Remove special characters
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
}

/**
 * Extract merchant name from description
 * @param {string} description 
 * @returns {string}
 */
function extractMerchantName(description) {
    const desc = String(description || '').toLowerCase().trim();
    
    // Remove common prefixes/suffixes
    let merchant = desc
        .replace(/^(purchase|payment|debit|credit|pos|online|recurring)\s+/i, '')
        .replace(/\s+(payment|purchase|transaction)$/i, '')
        .replace(/\d{4,}.*$/, '') // Remove transaction IDs
        .replace(/\s+\d+\/\d+.*$/, '') // Remove dates
        .replace(/\s+#.*$/, '') // Remove reference numbers
        .trim();
    
    // Take first 3-5 significant words
    const words = merchant.split(/\s+/).filter(w => w.length > 2);
    merchant = words.slice(0, Math.min(5, words.length)).join(' ');
    
    return merchant || desc.slice(0, 30);
}

/**
 * Save a categorization pattern to the database
 * @param {string} description - Transaction description
 * @param {string} category - Category assigned by user
 * @param {number} amount - Transaction amount (optional)
 * @returns {Promise<number>} - Pattern ID
 */
export async function saveCategorization(description, category, amount = null) {
    const db = await initializeDB();
    
    const normalizedDesc = normalizeDescription(description);
    const merchantName = extractMerchantName(description);
    
    // Check if pattern already exists
    const existing = await findExistingPattern(normalizedDesc, merchantName, category);
    
    if (existing) {
        // Update existing pattern
        return await updatePattern(existing.id, {
            usageCount: existing.usageCount + 1,
            lastUsed: Date.now(),
            examples: [...(existing.examples || []), description].slice(-10) // Keep last 10 examples
        });
    }
    
    // Create new pattern
    const pattern = {
        description: description,
        normalizedDescription: normalizedDesc,
        merchantName: merchantName,
        category: category,
        amount: amount,
        usageCount: 1,
        confidence: 0.7, // Initial confidence
        createdAt: Date.now(),
        lastUsed: Date.now(),
        examples: [description]
    };
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.PATTERNS], 'readwrite');
        const store = transaction.objectStore(STORES.PATTERNS);
        const request = store.add(pattern);
        
        request.onsuccess = () => {
            resolve(request.result);
        };
        
        request.onerror = () => {
            console.error('Failed to save pattern:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Find existing pattern for a description
 * @param {string} normalizedDesc 
 * @param {string} merchantName 
 * @param {string} category 
 * @returns {Promise<Object|null>}
 */
async function findExistingPattern(normalizedDesc, merchantName, category) {
    const db = await initializeDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.PATTERNS], 'readonly');
        const store = transaction.objectStore(STORES.PATTERNS);
        const index = store.index('merchantName');
        const request = index.getAll(merchantName);
        
        request.onsuccess = () => {
            const patterns = request.result;
            // Find exact match with same category
            const match = patterns.find(p => 
                p.category === category && 
                p.normalizedDescription === normalizedDesc
            );
            resolve(match || null);
        };
        
        request.onerror = () => {
            reject(request.error);
        };
    });
}

/**
 * Update an existing pattern
 * @param {number} id 
 * @param {Object} updates 
 * @returns {Promise<number>}
 */
async function updatePattern(id, updates) {
    const db = await initializeDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.PATTERNS], 'readwrite');
        const store = transaction.objectStore(STORES.PATTERNS);
        const getRequest = store.get(id);
        
        getRequest.onsuccess = () => {
            const pattern = getRequest.result;
            if (!pattern) {
                reject(new Error('Pattern not found'));
                return;
            }
            
            // Update confidence based on usage count
            const newUsageCount = updates.usageCount || pattern.usageCount;
            let newConfidence = pattern.confidence;
            
            if (newUsageCount >= 10) newConfidence = 0.95;
            else if (newUsageCount >= 5) newConfidence = 0.90;
            else if (newUsageCount >= 3) newConfidence = 0.85;
            else if (newUsageCount >= 2) newConfidence = 0.80;
            
            const updatedPattern = {
                ...pattern,
                ...updates,
                confidence: newConfidence
            };
            
            const putRequest = store.put(updatedPattern);
            
            putRequest.onsuccess = () => {
                resolve(id);
            };
            
            putRequest.onerror = () => {
                reject(putRequest.error);
            };
        };
        
        getRequest.onerror = () => {
            reject(getRequest.error);
        };
    });
}

/**
 * Find learned category for a transaction description
 * @param {string} description 
 * @returns {Promise<Object|null>}
 */
export async function findLearnedCategory(description) {
    const db = await initializeDB();
    const normalizedDesc = normalizeDescription(description);
    const merchantName = extractMerchantName(description);
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.PATTERNS], 'readonly');
        const store = transaction.objectStore(STORES.PATTERNS);
        const request = store.getAll();
        
        request.onsuccess = () => {
            const patterns = request.result;
            
            if (!patterns || patterns.length === 0) {
                resolve(null);
                return;
            }
            
            // Find best matching pattern
            let bestMatch = null;
            let bestScore = 0;
            
            for (const pattern of patterns) {
                let score = 0;
                
                // Exact normalized match = high score
                if (pattern.normalizedDescription === normalizedDesc) {
                    score += 100;
                }
                
                // Merchant name match = high score
                if (pattern.merchantName === merchantName) {
                    score += 80;
                }
                
                // Partial merchant name match
                if (merchantName && pattern.merchantName && 
                    (merchantName.includes(pattern.merchantName) || pattern.merchantName.includes(merchantName))) {
                    score += 60;
                }
                
                // Description similarity (simple word overlap)
                const descWords = normalizedDesc.split(/\s+/).filter(w => w.length > 2);
                const patternWords = pattern.normalizedDescription.split(/\s+/).filter(w => w.length > 2);
                const commonWords = descWords.filter(w => patternWords.includes(w));
                const wordOverlap = commonWords.length / Math.max(descWords.length, patternWords.length);
                score += wordOverlap * 50;
                
                // Boost score by confidence and usage count
                score *= (pattern.confidence || 0.7);
                score *= Math.log10(pattern.usageCount + 1) + 1;
                
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = pattern;
                }
            }
            
            // Require minimum score for match
            if (bestMatch && bestScore >= 40) {
                resolve({
                    category: bestMatch.category,
                    confidence: bestMatch.confidence,
                    exampleCount: bestMatch.usageCount,
                    merchantName: bestMatch.merchantName,
                    source: 'database'
                });
            } else {
                resolve(null);
            }
        };
        
        request.onerror = () => {
            console.error('Error finding learned category:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Save transaction to history
 * @param {Object} transaction 
 * @returns {Promise<number>}
 */
export async function saveTransaction(transaction) {
    const db = await initializeDB();
    
    const record = {
        description: transaction.description,
        normalizedDescription: normalizeDescription(transaction.description),
        merchantName: extractMerchantName(transaction.description),
        category: transaction.category,
        amount: transaction.amount,
        date: transaction.date ? new Date(transaction.date).getTime() : Date.now(),
        type: transaction.type,
        savedAt: Date.now()
    };
    
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORES.TRANSACTIONS], 'readwrite');
        const store = tx.objectStore(STORES.TRANSACTIONS);
        const request = store.add(record);
        
        request.onsuccess = () => {
            resolve(request.result);
        };
        
        request.onerror = () => {
            console.error('Failed to save transaction:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Save multiple transactions at once
 * @param {Array} transactions 
 * @returns {Promise<number>} - Count of saved transactions
 */
export async function saveTransactionBatch(transactions) {
    const db = await initializeDB();
    
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORES.TRANSACTIONS], 'readwrite');
        const store = tx.objectStore(STORES.TRANSACTIONS);
        let count = 0;
        
        transactions.forEach(transaction => {
            const record = {
                description: transaction.description,
                normalizedDescription: normalizeDescription(transaction.description),
                merchantName: extractMerchantName(transaction.description),
                category: transaction.category,
                amount: transaction.amount,
                date: transaction.date ? new Date(transaction.date).getTime() : Date.now(),
                type: transaction.type,
                savedAt: Date.now()
            };
            
            store.add(record);
            count++;
        });
        
        tx.oncomplete = () => {
            resolve(count);
        };
        
        tx.onerror = () => {
            console.error('Failed to save transaction batch:', tx.error);
            reject(tx.error);
        };
    });
}

/**
 * Mark two descriptions as dissimilar
 * @param {string} description1 
 * @param {string} description2 
 * @returns {Promise<void>}
 */
export async function markDissimilar(description1, description2) {
    const db = await initializeDB();
    
    // Create a consistent key regardless of order
    const [desc1, desc2] = [description1, description2].sort();
    const pairKey = `${normalizeDescription(desc1)}__${normalizeDescription(desc2)}`;
    
    const record = {
        pairKey: pairKey,
        description1: desc1,
        description2: desc2,
        timestamp: Date.now()
    };
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.DISSIMILAR], 'readwrite');
        const store = transaction.objectStore(STORES.DISSIMILAR);
        const request = store.put(record);
        
        request.onsuccess = () => {
            resolve();
        };
        
        request.onerror = () => {
            console.error('Failed to save dissimilar pair:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Check if two descriptions are marked as dissimilar
 * @param {string} description1 
 * @param {string} description2 
 * @returns {Promise<boolean>}
 */
export async function areDissimilar(description1, description2) {
    const db = await initializeDB();
    
    const [desc1, desc2] = [description1, description2].sort();
    const pairKey = `${normalizeDescription(desc1)}__${normalizeDescription(desc2)}`;
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.DISSIMILAR], 'readonly');
        const store = transaction.objectStore(STORES.DISSIMILAR);
        const request = store.get(pairKey);
        
        request.onsuccess = () => {
            resolve(!!request.result);
        };
        
        request.onerror = () => {
            reject(request.error);
        };
    });
}

/**
 * Get database statistics
 * @returns {Promise<Object>}
 */
export async function getDBStats() {
    const db = await initializeDB();
    
    return new Promise((resolve, reject) => {
        const stats = {
            patterns: 0,
            transactions: 0,
            dissimilarPairs: 0,
            categoryBreakdown: {}
        };
        
        const transaction = db.transaction([STORES.PATTERNS, STORES.TRANSACTIONS, STORES.DISSIMILAR], 'readonly');
        
        // Count patterns
        const patternRequest = transaction.objectStore(STORES.PATTERNS).count();
        patternRequest.onsuccess = () => {
            stats.patterns = patternRequest.result;
        };
        
        // Count transactions
        const transactionRequest = transaction.objectStore(STORES.TRANSACTIONS).count();
        transactionRequest.onsuccess = () => {
            stats.transactions = transactionRequest.result;
        };
        
        // Count dissimilar pairs
        const dissimilarRequest = transaction.objectStore(STORES.DISSIMILAR).count();
        dissimilarRequest.onsuccess = () => {
            stats.dissimilarPairs = dissimilarRequest.result;
        };
        
        // Get category breakdown
        const categoryRequest = transaction.objectStore(STORES.PATTERNS).getAll();
        categoryRequest.onsuccess = () => {
            const patterns = categoryRequest.result;
            patterns.forEach(pattern => {
                stats.categoryBreakdown[pattern.category] = (stats.categoryBreakdown[pattern.category] || 0) + 1;
            });
        };
        
        transaction.oncomplete = () => {
            resolve(stats);
        };
        
        transaction.onerror = () => {
            reject(transaction.error);
        };
    });
}

/**
 * Clear all data from a specific store
 * @param {string} storeName 
 * @returns {Promise<void>}
 */
export async function clearStore(storeName) {
    const db = await initializeDB();
    
    if (!Object.values(STORES).includes(storeName)) {
        throw new Error(`Invalid store name: ${storeName}`);
    }
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        
        request.onsuccess = () => {
            resolve();
        };
        
        request.onerror = () => {
            console.error(`Failed to clear ${storeName}:`, request.error);
            reject(request.error);
        };
    });
}

/**
 * Export all data for backup
 * @returns {Promise<Object>}
 */
export async function exportData() {
    const db = await initializeDB();
    
    return new Promise((resolve, reject) => {
        const data = {
            exportDate: new Date().toISOString(),
            version: DB_VERSION,
            patterns: [],
            transactions: [],
            dissimilarPairs: []
        };
        
        const transaction = db.transaction([STORES.PATTERNS, STORES.TRANSACTIONS, STORES.DISSIMILAR], 'readonly');
        
        const patternRequest = transaction.objectStore(STORES.PATTERNS).getAll();
        patternRequest.onsuccess = () => {
            data.patterns = patternRequest.result;
        };
        
        const transactionRequest = transaction.objectStore(STORES.TRANSACTIONS).getAll();
        transactionRequest.onsuccess = () => {
            data.transactions = transactionRequest.result;
        };
        
        const dissimilarRequest = transaction.objectStore(STORES.DISSIMILAR).getAll();
        dissimilarRequest.onsuccess = () => {
            data.dissimilarPairs = dissimilarRequest.result;
        };
        
        transaction.oncomplete = () => {
                patterns: data.patterns.length,
                transactions: data.transactions.length,
                dissimilarPairs: data.dissimilarPairs.length
            });
            resolve(data);
        };
        
        transaction.onerror = () => {
            reject(transaction.error);
        };
    });
}

/**
 * Import data from backup
 * @param {Object} data 
 * @returns {Promise<void>}
 */
export async function importData(data) {
    const db = await initializeDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.PATTERNS, STORES.TRANSACTIONS, STORES.DISSIMILAR], 'readwrite');
        
        // Import patterns
        const patternStore = transaction.objectStore(STORES.PATTERNS);
        (data.patterns || []).forEach(pattern => {
            delete pattern.id; // Let DB assign new ID
            patternStore.add(pattern);
        });
        
        // Import transactions
        const transactionStore = transaction.objectStore(STORES.TRANSACTIONS);
        (data.transactions || []).forEach(tx => {
            delete tx.id; // Let DB assign new ID
            transactionStore.add(tx);
        });
        
        // Import dissimilar pairs
        const dissimilarStore = transaction.objectStore(STORES.DISSIMILAR);
        (data.dissimilarPairs || []).forEach(pair => {
            dissimilarStore.put(pair); // Use put to handle existing keys
        });
        
        transaction.oncomplete = () => {
            resolve();
        };
        
        transaction.onerror = () => {
            console.error('Failed to import data:', transaction.error);
            reject(transaction.error);
        };
    });
}

// Export store names for external use
export { STORES };

/**
 * Save file upload to history
 * @param {string} fileName - Name of the uploaded file
 * @param {string} fileData - Base64 encoded file data
 * @param {number} fileSize - File size in bytes
 * @param {number} transactionCount - Number of transactions in the file
 * @param {number} year - Year provided for the file
 * @param {Object} summary - Summary statistics (income, expenses, etc.)
 * @returns {Promise<number>} - File history ID
 */
export async function saveFileHistory(fileName, fileData, fileSize, transactionCount, year = null, summary = {}) {
    const db = await initializeDB();
    
    const record = {
        fileName: fileName,
        fileData: fileData, // Base64 encoded
        fileSize: fileSize,
        transactionCount: transactionCount,
        year: year,
        uploadDate: Date.now(),
        summary: {
            totalIncome: summary.totalIncome || 0,
            totalExpenses: summary.totalExpenses || 0,
            netBalance: summary.netBalance || 0,
            incomeCount: summary.incomeCount || 0,
            expenseCount: summary.expenseCount || 0
        }
    };
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.FILE_HISTORY], 'readwrite');
        const store = transaction.objectStore(STORES.FILE_HISTORY);
        const request = store.add(record);
        
        request.onsuccess = () => {
            resolve(request.result);
        };
        
        request.onerror = () => {
            console.error('Failed to save file history:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Get all file history entries
 * @param {number} limit - Maximum number of entries to return (default: 50)
 * @returns {Promise<Array>} - Array of file history entries
 */
export async function getFileHistory(limit = 50) {
    const db = await initializeDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.FILE_HISTORY], 'readonly');
        const store = transaction.objectStore(STORES.FILE_HISTORY);
        const index = store.index('uploadDate');
        const request = index.getAll(); // Get all, sorted by date
        
        request.onsuccess = () => {
            const files = request.result
                .sort((a, b) => b.uploadDate - a.uploadDate) // Newest first
                .slice(0, limit);
            resolve(files);
        };
        
        request.onerror = () => {
            console.error('Failed to get file history:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Get a specific file history entry by ID
 * @param {number} id - File history ID
 * @returns {Promise<Object|null>} - File history entry or null
 */
export async function getFileHistoryById(id) {
    const db = await initializeDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.FILE_HISTORY], 'readonly');
        const store = transaction.objectStore(STORES.FILE_HISTORY);
        const request = store.get(id);
        
        request.onsuccess = () => {
            resolve(request.result || null);
        };
        
        request.onerror = () => {
            reject(request.error);
        };
    });
}

/**
 * Delete a file history entry
 * @param {number} id - File history ID
 * @returns {Promise<void>}
 */
export async function deleteFileHistory(id) {
    const db = await initializeDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.FILE_HISTORY], 'readwrite');
        const store = transaction.objectStore(STORES.FILE_HISTORY);
        const request = store.delete(id);
        
        request.onsuccess = () => {
            resolve();
        };
        
        request.onerror = () => {
            console.error('Failed to delete file history:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Clear all file history
 * @returns {Promise<void>}
 */
export async function clearFileHistory() {
    return await clearStore(STORES.FILE_HISTORY);
}

/**
 * Get file history statistics
 * @returns {Promise<Object>}
 */
export async function getFileHistoryStats() {
    const db = await initializeDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.FILE_HISTORY], 'readonly');
        const store = transaction.objectStore(STORES.FILE_HISTORY);
        const countRequest = store.count();
        
        countRequest.onsuccess = () => {
            const totalFiles = countRequest.result;
            
            // Get all files to calculate totals
            const getAllRequest = store.getAll();
            getAllRequest.onsuccess = () => {
                const files = getAllRequest.result;
                const totalTransactions = files.reduce((sum, f) => sum + (f.transactionCount || 0), 0);
                const totalSize = files.reduce((sum, f) => sum + (f.fileSize || 0), 0);
                const oldestFile = files.length > 0 ? Math.min(...files.map(f => f.uploadDate)) : null;
                const newestFile = files.length > 0 ? Math.max(...files.map(f => f.uploadDate)) : null;
                
                resolve({
                    totalFiles: totalFiles,
                    totalTransactions: totalTransactions,
                    totalSize: totalSize,
                    oldestFile: oldestFile,
                    newestFile: newestFile,
                    averageTransactionsPerFile: totalFiles > 0 ? Math.round(totalTransactions / totalFiles) : 0
                });
            };
            
            getAllRequest.onerror = () => reject(getAllRequest.error);
        };
        
        countRequest.onerror = () => reject(countRequest.error);
    });
}

