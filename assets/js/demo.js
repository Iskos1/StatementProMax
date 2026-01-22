// Initialize demo button and drag functionality
export function initializeDemo() {
    const demoBtn = document.getElementById('useDemoBtn');
    const demoSection = document.getElementById('demoSection');
    const demoPdfPreview = document.getElementById('demoPdfPreview');
    const uploadArea = document.getElementById('uploadArea');
    
    if (demoBtn) {
        demoBtn.addEventListener('click', handleDemoClick);
    }
    
    // Make the sample PDF draggable
    if (demoPdfPreview) {
        demoPdfPreview.addEventListener('dragstart', handleDragStart);
        demoPdfPreview.addEventListener('dragend', handleDragEnd);
    }
    
    // Handle drop on upload area
    if (uploadArea) {
        const preventDefaults = (e) => { e.preventDefault(); e.stopPropagation(); };
        
        uploadArea.addEventListener('dragover', (e) => {
            preventDefaults(e);
            uploadArea.classList.add('drag-over');
        });
        
        uploadArea.addEventListener('drop', async (e) => {
            preventDefaults(e);
            uploadArea.classList.remove('drag-over');
            
                // Handle demo PDF drop
            if (e.dataTransfer.getData('text/demo-pdf')) {
                await handleDemoDrop();
            }
        });
        
        uploadArea.addEventListener('dragleave', (e) => {
            preventDefaults(e);
            uploadArea.classList.remove('drag-over');
        });
        
        document.addEventListener('dragend', () => {
            uploadArea.classList.remove('drag-over');
        });
    }
}

function handleDragStart(e) {
    const preview = e.currentTarget;
    preview.classList.add('dragging');
    
    // Set data to indicate this is a demo file
    e.dataTransfer.setData('text/demo-pdf', 'true');
    e.dataTransfer.effectAllowed = 'copy';
}

function handleDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
}

// Consolidated demo handler
async function handleDemoClick() {
    try {
        await processDemoFile();
    } catch (error) {
        console.error('Demo error:', error);
        alert('Failed to process demo file. Please try again.');
    }
}

async function handleDemoDrop() {
    await handleDemoClick(); // Reuse same logic
}

async function processDemoFile() {
    
    try {
        // Fetch the sample PDF
        const demoPdfPreview = document.getElementById('demoPdfPreview');
        const pdfPath = demoPdfPreview?.getAttribute('data-pdf-path') || 'assets/samples/sample-bank-statement.pdf';
        
        const response = await fetch(pdfPath);
        if (!response.ok) throw new Error('Failed to load sample PDF');
        
        // Create file from blob
        const blob = await response.blob();
        const file = new File([blob], 'sample-bank-statement.pdf', { 
            type: 'application/pdf',
            lastModified: Date.now()
        });
        file.isDemoFile = true; // Mark for special handling
        
    
        // Add file to converter
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInput.files = dataTransfer.files;
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            
            // Scroll to show added file
            await new Promise(resolve => setTimeout(resolve, 300));
            const fileList = document.getElementById('fileListContainer');
            if (fileList && fileList.style.display !== 'none') {
                fileList.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    } catch (error) {
        console.error('Error loading sample PDF:', error);
        throw error;
}
}


// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDemo);
} else {
    initializeDemo();
}
