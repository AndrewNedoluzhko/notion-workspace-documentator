// API Configuration
const API_BASE_URL = 'http://localhost:3000/api';

// DOM Elements (will be initialized after DOM loads)
let form;
let progressSection;
let resultsSection;
let generateButton;

// Progress tracking
let currentProgress = {
    connecting: 'pending',
    fetchingPages: 'pending',
    fetchingDatabases: 'pending',
    generating: 'pending'
};

// Initialize event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initialize DOM elements
    form = document.getElementById('mapperForm');
    progressSection = document.getElementById('progressSection');
    resultsSection = document.getElementById('resultsSection');
    generateButton = form.querySelector('button[type="submit"]');
    
    initializeForm();
    initializeSelectAllButton();
    enableClipboardOperations();
});

function enableClipboardOperations() {
    // Ensure clipboard operations (Ctrl+C, Ctrl+V, Ctrl+X) work properly
    const inputs = document.querySelectorAll('input[type="text"], input[type="password"]');
    
    inputs.forEach(input => {
        // Allow paste
        input.addEventListener('paste', (e) => {
            // Don't prevent default - allow paste to work
        });
        
        // Allow copy
        input.addEventListener('copy', (e) => {
            // Don't prevent default - allow copy to work
        });
        
        // Allow cut
        input.addEventListener('cut', (e) => {
            // Don't prevent default - allow cut to work
        });
        
        // Ensure keyboard shortcuts work
        input.addEventListener('keydown', (e) => {
            // Allow Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A
            if (e.ctrlKey || e.metaKey) {
                const key = e.key.toLowerCase();
                if (['c', 'v', 'x', 'a'].includes(key)) {
                    // Don't prevent default - allow clipboard operations
                    return;
                }
            }
        });
    });
}

function initializeForm() {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleFormSubmit();
    });
}

function initializeSelectAllButton() {
    const selectAllBtn = document.getElementById('selectAllFormats');
    const formatCheckboxes = document.querySelectorAll('input[name="formats"]');

    selectAllBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const allChecked = Array.from(formatCheckboxes).every(cb => cb.checked);
        formatCheckboxes.forEach(cb => {
            cb.checked = !allChecked;
        });
        selectAllBtn.textContent = allChecked ? 'Select All Formats' : 'Deselect All Formats';
    });
}

async function handleFormSubmit() {
    // Validate form
    const formData = getFormData();
    if (!validateFormData(formData)) {
        return;
    }

    // Reset UI
    resetProgress();
    showProgress();
    hideResults();
    setButtonLoading(true);

    try {
        // Step 1: Connect to Notion API and test connection
        updateProgress('connecting', 'active');
        
        // Test connection
        await testConnection(formData.apiKey, formData.apiVersion);
        updateProgress('connecting', 'success');
        
        // Step 2: Fetch pages
        updateProgress('fetchingPages', 'active');
        const pagesData = await fetchPages({
            apiKey: formData.apiKey,
            apiVersion: formData.apiVersion
        });
        updateProgress('fetchingPages', 'success');
        updateProgressDetails('fetchingPages', `Found ${pagesData.count} pages`);
        
        // Step 3: Fetch databases
        updateProgress('fetchingDatabases', 'active');
        const databasesData = await fetchDatabases({
            apiKey: formData.apiKey,
            apiVersion: formData.apiVersion,
            includeSchema: formData.includeSchema,
            includeItems: formData.includeItems
        });
        updateProgress('fetchingDatabases', 'success');
        updateProgressDetails('fetchingDatabases', `Found ${databasesData.count} databases`);
        
        // Step 4: Generate documentation
        updateProgress('generating', 'active');
        const result = await generateDocumentation(formData);
        updateProgress('generating', 'success');

        // Show results
        displayResults(result, formData);
        
    } catch (error) {
        handleError(error);
    } finally {
        setButtonLoading(false);
    }
}

function getFormData() {
    const formElement = document.getElementById('mapperForm');
    const formDataObj = new FormData(formElement);
    
    // Get selected formats
    const formats = Array.from(document.querySelectorAll('input[name="formats"]:checked'))
        .map(cb => cb.value);
    
    return {
        workspaceName: formDataObj.get('workspaceName'),
        apiKey: formDataObj.get('apiKey'),
        formats: formats,
        includeSchema: document.getElementById('includeSchema').checked,
        includeItems: document.getElementById('includeItems').checked,
        apiVersion: formDataObj.get('apiVersion')
    };
}

function validateFormData(data) {
    // Check workspace name
    if (!data.workspaceName || data.workspaceName.trim().length < 3) {
        showError('Workspace name must be at least 3 characters long.');
        return false;
    }

    // Check API key
    if (!data.apiKey || data.apiKey.trim().length < 10) {
        showError('Please provide a valid Notion API key.');
        return false;
    }

    // Check formats
    if (data.formats.length === 0) {
        showError('Please select at least one output format.');
        return false;
    }

    return true;
}

async function testConnection(apiKey, apiVersion) {
    try {
        const response = await fetch(`${API_BASE_URL}/pages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                apiKey: apiKey,
                apiVersion: apiVersion || '2025-09-03'
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to connect to Notion API');
        }

        return true;
    } catch (error) {
        throw error;
    }
}

async function fetchPages(config) {
    try {
        const response = await fetch(`${API_BASE_URL}/pages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                apiKey: config.apiKey,
                apiVersion: config.apiVersion
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch pages: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        throw new Error(`Error fetching pages: ${error.message}`);
    }
}

async function fetchDatabases(config) {
    try {
        const response = await fetch(`${API_BASE_URL}/databases`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                apiKey: config.apiKey,
                apiVersion: config.apiVersion,
                includeSchema: config.includeSchema,
                includeItems: config.includeItems
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch databases: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        throw new Error(`Error fetching databases: ${error.message}`);
    }
}

async function generateDocumentation(config) {
    try {
        const response = await fetch(`${API_BASE_URL}/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                workspaceName: config.workspaceName,
                apiKey: config.apiKey,
                apiVersion: config.apiVersion,
                formats: config.formats,
                includeSchema: config.includeSchema,
                includeItems: config.includeItems
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Failed to generate documentation: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        throw error;
    }
}

function resetProgress() {
    currentProgress = {
        connecting: 'pending',
        fetchingPages: 'pending',
        fetchingDatabases: 'pending',
        generating: 'pending'
    };
    
    // Reset status icons
    document.querySelectorAll('.progress-status').forEach(status => {
        status.className = 'progress-status status-pending';
        status.textContent = '○';
    });

    // Clear progress details
    const details = document.getElementById('progressDetails');
    if (details) {
        details.innerHTML = '';
    }
}

function updateProgress(step, status) {
    currentProgress[step] = status;
    const statusElement = document.getElementById(`status-${step}`);
    
    if (!statusElement) return;
    
    statusElement.className = `progress-status status-${status}`;
    
    switch (status) {
        case 'pending':
            statusElement.textContent = '○';
            break;
        case 'active':
            statusElement.textContent = '⟳';
            break;
        case 'success':
            statusElement.textContent = '✓';
            break;
        case 'error':
            statusElement.textContent = '✗';
            break;
    }
}

function updateProgressDetails(step, message) {
    const detailsContainer = document.getElementById('progressDetails');
    if (!detailsContainer) return;

    const detail = document.createElement('div');
    detail.className = 'progress-details';
    detail.textContent = `${getStepLabel(step)}: ${message}`;
    detailsContainer.appendChild(detail);
}

function getStepLabel(step) {
    const labels = {
        connecting: 'Connection',
        fetchingPages: 'Pages',
        fetchingDatabases: 'Databases',
        generating: 'Generation'
    };
    return labels[step] || step;
}

function showProgress() {
    progressSection.style.display = 'block';
    // Scroll to progress section so user can see it
    progressSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideProgress() {
    progressSection.style.display = 'none';
}

function displayResults(result, config) {
    const resultsBox = document.querySelector('#resultsSection .results-box');
    const downloadLinks = document.getElementById('downloadLinks');
    const summarySection = document.getElementById('summaryBox');

    // Clear previous results
    downloadLinks.innerHTML = '';

    // Show success state
    if (resultsBox) {
        resultsBox.className = 'results-box success';
    }
    
    // Create download links
    if (result.files && result.files.length > 0 && downloadLinks) {
        result.files.forEach(file => {
            const link = createDownloadLink(file);
            downloadLinks.appendChild(link);
        });
    }

    // Display summary
    if (summarySection && result.summary) {
        summarySection.innerHTML = `
            <h4>Summary</h4>
            <div class="summary-grid">
                <div class="summary-item">
                    <span class="summary-value">${result.summary.totalPages || 0}</span>
                    <span class="summary-label">Pages</span>
                </div>
                <div class="summary-item">
                    <span class="summary-value">${result.summary.totalDatabases || 0}</span>
                    <span class="summary-label">Databases</span>
                </div>
                <div class="summary-item">
                    <span class="summary-value">${result.files.length}</span>
                    <span class="summary-label">Files Generated</span>
                </div>
            </div>
        `;
    }

    showResults();
}

function createDownloadLink(file) {
    const link = document.createElement('a');
    link.href = `${API_BASE_URL}/download/${file.id}`;
    link.className = 'download-link';
    link.download = file.filename;
    
    link.innerHTML = `
        <span>${file.filename}</span>
        <span class="download-icon">⬇</span>
    `;
    
    return link;
}

function showResults() {
    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideResults() {
    resultsSection.style.display = 'none';
}

function handleError(error) {
    console.error('Error:', error);
    
    const errorSection = document.getElementById('errorSection');
    const errorMessage = document.getElementById('errorMessage');

    // Set error message
    if (errorMessage) {
        errorMessage.textContent = error.message || 'An unexpected error occurred. Please try again.';
    }

    // Find the first active or pending step and mark it as error
    const steps = ['connecting', 'fetchingPages', 'fetchingDatabases', 'generating'];
    let errorStepFound = false;
    
    for (const step of steps) {
        if (currentProgress[step] === 'active') {
            // This is the step that failed
            updateProgress(step, 'error');
            errorStepFound = true;
        } else if (errorStepFound || currentProgress[step] === 'pending') {
            // Reset any remaining steps to pending
            updateProgress(step, 'pending');
        }
    }

    // Hide results and show error
    hideResults();
    if (errorSection) {
        errorSection.style.display = 'block';
        errorSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function showError(message) {
    handleError(new Error(message));
}

function setButtonLoading(isLoading) {
    const spinner = generateButton.querySelector('.spinner');
    const buttonText = generateButton.querySelector('span:last-child');

    if (isLoading) {
        generateButton.disabled = true;
        spinner.style.display = 'block';
        buttonText.textContent = 'Generating...';
    } else {
        generateButton.disabled = false;
        spinner.style.display = 'none';
        buttonText.textContent = 'Generate Documentation';
    }
}

function handleRetry() {
    hideResults();
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetForm() {
    hideResults();
    hideProgress();
    
    // Hide error section
    const errorSection = document.getElementById('errorSection');
    if (errorSection) {
        errorSection.style.display = 'none';
    }
    
    form.reset();
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Utility function to simulate delay (for demo purposes)
function simulateDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Sleep helper for progress visualization
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Export for retry button
window.handleRetry = handleRetry;
window.resetForm = resetForm;
