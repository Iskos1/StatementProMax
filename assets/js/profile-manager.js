/**
 * Profile Manager
 * Handles syncing user data (settings, file history, patterns) with InstantDB
 * 
 * Security:
 * - All queries are scoped to the authenticated user's ID
 * - No sensitive file content is stored, only metadata
 * - OpenAI keys are stored per-user and only accessible by that user
 */

const APP_ID = '76a8365b-a4b6-48b0-a63b-d7a14d3587ec';

// ProfileManager Class
class ProfileManager {
    constructor() {
        this.db = null;
        this.user = null;
        this.profile = null;
        this.fileHistory = [];
        this.patterns = [];
        this.unsubscribers = [];
        this.onProfileUpdate = null;
        this.onFileHistoryUpdate = null;
        this.isInitialized = false;
    }

    /**
     * Initialize the ProfileManager with InstantDB
     */
    async init() {
        if (this.isInitialized) return this.db;
        
        try {
            const { init } = await import('https://cdn.jsdelivr.net/npm/@instantdb/core@0.14.30/+esm');
            this.db = init({ appId: APP_ID });
            this.isInitialized = true;
            return this.db;
        } catch (error) {
            console.error('[ProfileManager] Failed to initialize:', error);
            return null;
        }
    }

    /**
     * Set the current user and start subscriptions
     * @param {Object} user - User object from InstantDB auth
     */
    setUser(user) {
        if (!user) {
            this.cleanup();
            return;
        }

        this.user = user;

        // Start subscriptions for user data
        this.subscribeToProfile();
        this.subscribeToFileHistory();
        this.subscribeToPatterns();
    }

    /**
     * Subscribe to user profile data
     */
    subscribeToProfile() {
        if (!this.db || !this.user) return;

        const unsub = this.db.subscribeQuery(
            { profiles: { $: { where: { id: this.user.id } } } },
            (response) => {
                if (response.error) {
                    console.error('[ProfileManager] Profile query error:', response.error);
                    return;
                }
                
                if (response.data?.profiles?.length > 0) {
                    this.profile = response.data.profiles[0];
                    this.syncLocalSettings();
                    
                    if (this.onProfileUpdate) {
                        this.onProfileUpdate(this.profile);
                    }
                }
            }
        );
        this.unsubscribers.push(unsub);
    }

    /**
     * Subscribe to user's file history
     */
    subscribeToFileHistory() {
        if (!this.db || !this.user) return;

        const unsub = this.db.subscribeQuery(
            { fileHistory: { $: { where: { userId: this.user.id } } } },
            (response) => {
                if (response.error) {
                    console.error('[ProfileManager] File history query error:', response.error);
                    return;
                }
                
                if (response.data?.fileHistory) {
                    // Sort by upload date, newest first
                    this.fileHistory = response.data.fileHistory.sort(
                        (a, b) => (b.uploadDate || 0) - (a.uploadDate || 0)
                    );
                    
                    if (this.onFileHistoryUpdate) {
                        this.onFileHistoryUpdate(this.fileHistory);
                    }
                }
            }
        );
        this.unsubscribers.push(unsub);
    }

    /**
     * Subscribe to user's categorization patterns
     */
    subscribeToPatterns() {
        if (!this.db || !this.user) return;

        const unsub = this.db.subscribeQuery(
            { patterns: { $: { where: { userId: this.user.id } } } },
            (response) => {
                if (response.error) {
                    console.error('[ProfileManager] Patterns query error:', response.error);
                    return;
                }
                
                if (response.data?.patterns) {
                    this.patterns = response.data.patterns;
                }
            }
        );
        this.unsubscribers.push(unsub);
    }

    /**
     * Sync cloud settings to local storage
     */
    syncLocalSettings() {
        if (this.profile?.openaiKey) {
            const currentKey = localStorage.getItem('openai_api_key');
            if (currentKey !== this.profile.openaiKey) {
                localStorage.setItem('openai_api_key', this.profile.openaiKey);
            }
        }
    }

    /**
     * Save OpenAI API Key to cloud profile
     * @param {string} key - OpenAI API key
     */
    async saveOpenAIKey(key) {
        if (!this.db || !this.user) {
            console.warn('[ProfileManager] Cannot save key - not authenticated');
            return false;
        }

        try {
            await this.db.transact(
                this.db.tx.profiles[this.user.id].update({
                    openaiKey: key,
                    updatedAt: Date.now()
                })
            );
            return true;
        } catch (error) {
            console.error('[ProfileManager] Failed to save OpenAI key:', error);
            return false;
        }
    }

    /**
     * Save file metadata to cloud history
     * @param {Object} fileData - File metadata object
     */
    async saveFileToHistory(fileData) {
        if (!this.db || !this.user) {
            return null;
        }

        try {
            // Generate a unique ID for the file
            const fileId = `${this.user.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const record = {
                userId: this.user.id,
                fileName: fileData.fileName,
                fileSize: fileData.fileSize || 0,
                transactionCount: fileData.transactionCount || 0,
                year: fileData.year || null,
                uploadDate: Date.now(),
                summary: {
                    totalIncome: fileData.summary?.totalIncome || 0,
                    totalExpenses: fileData.summary?.totalExpenses || 0,
                    netBalance: fileData.summary?.netBalance || 0,
                    incomeCount: fileData.summary?.incomeCount || 0,
                    expenseCount: fileData.summary?.expenseCount || 0
                },
                categoryBreakdown: fileData.categoryBreakdown || {}
            };

            await this.db.transact(
                this.db.tx.fileHistory[fileId].update(record)
            );
            
            return fileId;
        } catch (error) {
            console.error('[ProfileManager] Failed to save file to history:', error);
            return null;
        }
    }

    /**
     * Delete a file from cloud history
     * @param {string} fileId - File ID to delete
     */
    async deleteFileFromHistory(fileId) {
        if (!this.db || !this.user) return false;

        try {
            await this.db.transact(
                this.db.tx.fileHistory[fileId].delete()
            );
            return true;
        } catch (error) {
            console.error('[ProfileManager] Failed to delete file:', error);
            return false;
        }
    }

    /**
     * Save a categorization pattern to cloud
     * @param {string} merchantName - Merchant name
     * @param {string} category - Category
     * @param {string} description - Original description
     * @param {number} confidence - Confidence score
     */
    async savePattern(merchantName, category, description, confidence = 1.0) {
        if (!this.db || !this.user) return false;

        try {
            const patternId = `${this.user.id}_${merchantName.replace(/\s+/g, '_').toLowerCase()}`;
            
            await this.db.transact(
                this.db.tx.patterns[patternId].update({
                    userId: this.user.id,
                    merchantName: merchantName,
                    description: description,
                    category: category,
                    confidence: confidence,
                    lastUsed: Date.now()
                })
            );
            return true;
        } catch (error) {
            console.error('[ProfileManager] Failed to save pattern:', error);
            return false;
        }
    }

    /**
     * Get a cloud pattern by merchant name
     * @param {string} merchantName - Merchant name to search
     */
    getCloudPattern(merchantName) {
        if (!this.patterns.length) return null;
        
        const normalizedInput = merchantName.toLowerCase().trim();
        return this.patterns.find(p => 
            p.merchantName?.toLowerCase().trim() === normalizedInput
        );
    }

    /**
     * Get profile statistics
     */
    getStats() {
        const totalFiles = this.fileHistory.length;
        const totalTransactions = this.fileHistory.reduce(
            (sum, f) => sum + (f.transactionCount || 0), 0
        );
        const totalIncome = this.fileHistory.reduce(
            (sum, f) => sum + (f.summary?.totalIncome || 0), 0
        );
        const totalExpenses = this.fileHistory.reduce(
            (sum, f) => sum + (f.summary?.totalExpenses || 0), 0
        );
        const learnedPatterns = this.patterns.length;

        // Calculate top categories across all files
        const categoryTotals = {};
        this.fileHistory.forEach(file => {
            if (file.categoryBreakdown) {
                Object.entries(file.categoryBreakdown).forEach(([category, amount]) => {
                    categoryTotals[category] = (categoryTotals[category] || 0) + amount;
                });
            }
        });

        const topCategories = Object.entries(categoryTotals)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([category, amount]) => ({ category, amount }));

        return {
            totalFiles,
            totalTransactions,
            totalIncome,
            totalExpenses,
            netBalance: totalIncome - totalExpenses,
            learnedPatterns,
            memberSince: this.profile?.createdAt || this.user?.createdAt || null,
            topCategories
        };
    }

    /**
     * Update user profile settings
     * @param {Object} settings - Settings to update
     */
    async updateProfile(settings) {
        if (!this.db || !this.user) return false;

        try {
            await this.db.transact(
                this.db.tx.profiles[this.user.id].update({
                    ...settings,
                    updatedAt: Date.now()
                })
            );
            return true;
        } catch (error) {
            console.error('[ProfileManager] Failed to update profile:', error);
            return false;
        }
    }

    /**
     * Cleanup subscriptions
     */
    cleanup() {
        this.unsubscribers.forEach(unsub => {
            if (typeof unsub === 'function') unsub();
        });
        this.unsubscribers = [];
        this.user = null;
        this.profile = null;
        this.fileHistory = [];
        this.patterns = [];
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!this.user;
    }
}

// Export singleton instance
export const profileManager = new ProfileManager();

// Also export the class for testing
export { ProfileManager };
