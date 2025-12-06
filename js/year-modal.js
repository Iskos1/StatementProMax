// Shared Year Modal Module
// This module provides year selection functionality used across multiple pages

let yearModalResolve = null;
let yearModalReject = null;
let isModalOpen = false;
let eventListenersAttached = false;
let escKeyHandler = null;  // Store reference for cleanup

// Initialize Year Modal
export function initializeYearModal() {
    try {
        const yearModal = document.getElementById('yearModal');
        const yearSelect = document.getElementById('yearSelect');
        const yearQuickButtons = document.getElementById('yearQuickButtons');
        const cancelYearBtn = document.getElementById('cancelYearBtn');
        const confirmYearBtn = document.getElementById('confirmYearBtn');
        
        if (!yearModal || !yearSelect || !yearQuickButtons || !cancelYearBtn || !confirmYearBtn) {
            console.warn('Year modal elements not found, skipping initialization');
            return false;
        }
        
        if (eventListenersAttached) {
            console.warn('Year modal already initialized');
            return true;
        }
    
    // Populate year dropdown (last 10 years + next 2 years)
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear + 2; i >= currentYear - 10; i--) {
        years.push(i);
    }
    
    yearSelect.innerHTML = years.map(year => 
        `<option value="${year}" ${year === currentYear ? 'selected' : ''}>${year}</option>`
    ).join('');
    
    // Populate quick year buttons (last 3 years + current + next)
    const quickYears = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2];
    yearQuickButtons.innerHTML = quickYears.map(year => 
        `<button class="year-quick-btn ${year === currentYear ? 'selected' : ''}" data-year="${year}">${year}</button>`
    ).join('');
    
    // Add event listeners to quick buttons
    yearQuickButtons.addEventListener('click', (e) => {
        if (e.target.classList.contains('year-quick-btn')) {
            const selectedYear = parseInt(e.target.dataset.year);
            
            // Update button states
            document.querySelectorAll('.year-quick-btn').forEach(btn => {
                btn.classList.remove('selected');
            });
            e.target.classList.add('selected');
            
            // Update dropdown
            yearSelect.value = selectedYear;
        }
    });
    
    // Sync dropdown with quick buttons
    yearSelect.addEventListener('change', () => {
        const selectedYear = parseInt(yearSelect.value);
        document.querySelectorAll('.year-quick-btn').forEach(btn => {
            if (parseInt(btn.dataset.year) === selectedYear) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
    });
    
    // Cancel button
    cancelYearBtn.addEventListener('click', () => {
        hideYearModal();
        if (yearModalReject) {
            yearModalReject(new Error('User cancelled year selection'));
            yearModalReject = null;
            yearModalResolve = null;
        }
    });
    
    // Confirm button
    confirmYearBtn.addEventListener('click', () => {
        const selectedYear = parseInt(yearSelect.value);
        hideYearModal();
        if (yearModalResolve) {
            yearModalResolve(selectedYear);
            yearModalResolve = null;
            yearModalReject = null;
        }
    });
    
    // Close modal on background click
    yearModal.addEventListener('click', (e) => {
        if (e.target === yearModal) {
            hideYearModal();
            if (yearModalReject) {
                yearModalReject(new Error('User cancelled year selection'));
                yearModalReject = null;
                yearModalResolve = null;
            }
        }
    });
    
    // Store ESC handler reference for proper cleanup management
    escKeyHandler = (e) => {
        if (e.key === 'Escape' && yearModal.classList.contains('show')) {
            e.stopPropagation(); // Prevent other handlers from interfering
            hideYearModal();
            if (yearModalReject) {
                yearModalReject(new Error('User cancelled year selection'));
                yearModalReject = null;
                yearModalResolve = null;
            }
        }
    };
    document.addEventListener('keydown', escKeyHandler, true); // Use capture phase
        
        eventListenersAttached = true;
        return true;
        
    } catch (error) {
        console.error('Error initializing year modal:', error);
        return false;
    }
}

// Show Year Modal
export function showYearModal() {
    return new Promise((resolve, reject) => {
        try {
            if (isModalOpen) {
                reject(new Error('Modal is already open'));
                return;
            }
            
            const yearModal = document.getElementById('yearModal');
            const yearSelect = document.getElementById('yearSelect');
            
            if (!yearModal || !yearSelect) {
                reject(new Error('Year modal elements not found'));
                return;
            }
            
            yearModalResolve = resolve;
            yearModalReject = reject;
            
            // Reset to current year
            const currentYear = new Date().getFullYear();
            yearSelect.value = currentYear;
            
            // Update quick button states
            try {
                document.querySelectorAll('.year-quick-btn').forEach(btn => {
                    if (parseInt(btn.dataset.year) === currentYear) {
                        btn.classList.add('selected');
                    } else {
                        btn.classList.remove('selected');
                    }
                });
            } catch (error) {
                console.warn('Error updating quick buttons:', error);
            }
            
            // Use requestAnimationFrame to ensure smooth animation
            requestAnimationFrame(() => {
                isModalOpen = true;
                yearModal.classList.add('show');
                document.body.style.overflow = 'hidden';
            });
            
        } catch (error) {
            isModalOpen = false;
            reject(error);
        }
    });
}

// Hide Year Modal
export function hideYearModal() {
    try {
        const yearModal = document.getElementById('yearModal');
        if (yearModal) {
            yearModal.classList.remove('show');
        }
        document.body.style.overflow = 'auto';
        isModalOpen = false;
    } catch (error) {
        console.error('Error hiding year modal:', error);
        document.body.style.overflow = 'auto';
        isModalOpen = false;
    }
}

