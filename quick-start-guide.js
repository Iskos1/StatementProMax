// Quick Start Guide Modal for First-Time Users
// Provides a friendly onboarding experience

const GUIDE_STORAGE_KEY = 'statementpromax_guide_shown';

// Check if user has seen the guide
function hasSeenGuide() {
    return localStorage.getItem(GUIDE_STORAGE_KEY) === 'true';
}

// Mark guide as seen
function markGuideAsSeen() {
    localStorage.setItem(GUIDE_STORAGE_KEY, 'true');
}

// Show Quick Start Guide
export function showQuickStartGuide() {
    if (hasSeenGuide()) {
        return; // Don't show if already seen
    }

    const modal = document.createElement('div');
    modal.id = 'quickStartGuideModal';
    modal.className = 'auth-modal show';
    modal.style.zIndex = '10001';
    
    modal.innerHTML = `
        <div class="auth-modal-content" style="max-width: 700px; max-height: 90vh; overflow-y: auto;">
            <button class="auth-modal-close" onclick="this.closest('.auth-modal').remove(); localStorage.setItem('${GUIDE_STORAGE_KEY}', 'true');">&times;</button>
            
            <div class="auth-modal-header">
                <h2>👋 Welcome to StatementProMax!</h2>
                <p>Let's get you started in just 3 simple steps</p>
            </div>
            
            <div class="auth-modal-body" style="padding: 24px 40px 32px;">
                <!-- Step 1 -->
                <div style="display: flex; gap: 20px; margin-bottom: 32px; padding: 20px; background: linear-gradient(135deg, #FFF5F5 0%, #FFF9F9 100%); border-radius: 12px; border: 2px solid #FFE8E8;">
                    <div style="flex-shrink: 0;">
                        <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #FF6B6B 0%, #FF5252 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: 800; box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);">1</div>
                    </div>
                    <div style="flex: 1;">
                        <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 8px; color: #1a1a1a;">Upload Your Files</h3>
                        <p style="font-size: 14px; line-height: 1.6; color: #4a4a4a; margin-bottom: 12px;">
                            Simply drag and drop your PDF bank statements or Excel files, or click to browse. We support multiple files at once!
                        </p>
                        <div class="callout callout-info" style="margin: 0;">
                            <div style="font-size: 13px;">💡 Your files are processed <strong>100% locally</strong> in your browser - never uploaded to any server!</div>
                        </div>
                    </div>
                </div>

                <!-- Step 2 -->
                <div style="display: flex; gap: 20px; margin-bottom: 32px; padding: 20px; background: linear-gradient(135deg, #F0FDF4 0%, #F9FFF9 100%); border-radius: 12px; border: 2px solid #E8F5E9;">
                    <div style="flex-shrink: 0;">
                        <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: 800; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);">2</div>
                    </div>
                    <div style="flex: 1;">
                        <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 8px; color: #1a1a1a;">Convert & Analyze</h3>
                        <p style="font-size: 14px; line-height: 1.6; color: #4a4a4a; margin-bottom: 12px;">
                            For PDFs: Convert to Excel in seconds. For Excel files: Upload directly to the Financial Dashboard for instant insights.
                        </p>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <span class="status-badge info">⚡ 3-second conversion</span>
                            <span class="status-badge success">📊 Auto-categorization</span>
                            <span class="status-badge warning">🔁 Recurring detection</span>
                        </div>
                    </div>
                </div>

                <!-- Step 3 -->
                <div style="display: flex; gap: 20px; margin-bottom: 24px; padding: 20px; background: linear-gradient(135deg, #EFF6FF 0%, #F9FBFF 100%); border-radius: 12px; border: 2px solid #DBEAFE;">
                    <div style="flex-shrink: 0;">
                        <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: 800; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">3</div>
                    </div>
                    <div style="flex: 1;">
                        <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 8px; color: #1a1a1a;">Get Insights</h3>
                        <p style="font-size: 14px; line-height: 1.6; color: #4a4a4a; margin-bottom: 12px;">
                            View beautiful charts, discover spending patterns, find recurring subscriptions, and export your analysis to Excel!
                        </p>
                        <ul style="font-size: 13px; color: #4a4a4a; line-height: 1.8; padding-left: 20px;">
                            <li>📈 Income vs Expenses charts</li>
                            <li>🎯 Category breakdown</li>
                            <li>💡 Savings optimization tips</li>
                            <li>🔁 Subscription management</li>
                        </ul>
                    </div>
                </div>

                <!-- Keyboard Shortcuts Teaser -->
                <div style="background: #fafafa; padding: 16px 20px; border-radius: 10px; border: 2px solid #e5e5e5; margin-bottom: 24px;">
                    <h4 style="font-size: 16px; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                        ⌨️ Pro Tip: Keyboard Shortcuts
                    </h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; font-size: 13px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span>Open Files</span>
                            <span class="kbd">Ctrl+O</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span>Export</span>
                            <span class="kbd">Ctrl+E</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span>Show Help</span>
                            <span class="kbd">?</span>
                        </div>
                    </div>
                </div>

                <!-- CTA Buttons -->
                <div style="display: flex; gap: 12px;">
                    <button class="btn-outline" style="flex: 1;" onclick="this.closest('.auth-modal').remove(); localStorage.setItem('${GUIDE_STORAGE_KEY}', 'true');">
                        Skip Tour
                    </button>
                    <button class="btn-primary btn-with-icon" style="flex: 2;" onclick="this.closest('.auth-modal').remove(); localStorage.setItem('${GUIDE_STORAGE_KEY}', 'true'); document.getElementById('fileInput')?.click();">
                        <span class="btn-icon">🚀</span>
                        <span>Let's Get Started!</span>
                    </button>
                </div>

                <!-- Don't show again option -->
                <div style="text-align: center; margin-top: 16px;">
                    <label style="display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: #6a6a6a; cursor: pointer;">
                        <input type="checkbox" id="dontShowAgain" style="width: 16px; height: 16px; cursor: pointer;">
                        <span>Don't show this again</span>
                    </label>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Handle checkbox
    const checkbox = document.getElementById('dontShowAgain');
    if (checkbox) {
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                markGuideAsSeen();
            }
        });
    }

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
            markGuideAsSeen();
        }
    });
}

// Show guide on first load with a delay
function initQuickStartGuide() {
    // Only show on converter or dashboard page
    const isRelevantPage = window.location.pathname.includes('index.html') || 
                           window.location.pathname.includes('dashboard.html') ||
                           window.location.pathname === '/';

    if (isRelevantPage && !hasSeenGuide()) {
        // Show after a brief delay to let page load
        setTimeout(() => {
            showQuickStartGuide();
        }, 1500);
    }
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initQuickStartGuide);
} else {
    initQuickStartGuide();
}

// Export for manual trigger
export default {
    show: showQuickStartGuide,
    hasSeenGuide,
    markAsSeen: markGuideAsSeen
};

