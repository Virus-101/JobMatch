// ============================================
// JobMatch AI — Background Service Worker
// ============================================

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('[JobMatch AI] Extension installed!');

        // Set default profile
        chrome.storage.local.set({
            userProfile: {
                name: '',
                email: '',
                phone: '',
                location: '',
                title: '',
                summary: '',
                skills: [],
                experience: [],
                education: [],
                cvText: '',
                preferences: {
                    desiredTitles: [],
                    desiredLocations: [],
                    remoteOnly: false,
                    salaryMin: 0,
                    salaryMax: 0,
                    jobTypes: ['full-time'],
                    excludeKeywords: [],
                    mustHaveKeywords: []
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            savedJobs: []
        });
    }
});

// Listen for tab updates to re-inject content scripts if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        const jobSites = [
            'linkedin.com/jobs',
            'linkedin.com/feed',
            'indeed.com',
            'glassdoor.com',
            'monster.com',
            'ziprecruiter.com'
        ];

        const isJobSite = jobSites.some(site => tab.url.includes(site));

        if (isJobSite) {
            // Set badge to indicate extension is active on this page
            chrome.action.setBadgeText({ text: 'ON', tabId });
            chrome.action.setBadgeBackgroundColor({ color: '#6366F1', tabId });
        }
    }
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'profileUpdated') {
        // Notify all job site tabs to refresh their scores
        chrome.tabs.query({}, (tabs) => {
            const jobSites = ['linkedin.com', 'indeed.com', 'glassdoor.com', 'monster.com', 'ziprecruiter.com'];

            for (const tab of tabs) {
                if (tab.url && jobSites.some(site => tab.url.includes(site))) {
                    chrome.tabs.sendMessage(tab.id, { action: 'profileUpdated' }).catch(() => {
                        // Tab might not have content script loaded
                    });
                }
            }
        });

        sendResponse({ success: true });
    }

    return true;
});

// Context menu for saving jobs from right-click
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'saveToJobMatch',
        title: 'Save to JobMatch AI',
        contexts: ['link'],
        documentUrlPatterns: [
            '*://*.linkedin.com/*',
            '*://*.indeed.com/*',
            '*://*.glassdoor.com/*',
            '*://*.monster.com/*',
            '*://*.ziprecruiter.com/*'
        ]
    });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'saveToJobMatch') {
        const job = {
            id: 'ctx-' + Date.now(),
            title: info.linkText || 'Job from context menu',
            url: info.linkUrl,
            source: 'context-menu',
            savedAt: new Date().toISOString(),
            status: 'saved'
        };

        const result = await chrome.storage.local.get(['savedJobs']);
        const jobs = result.savedJobs || [];
        jobs.push(job);
        await chrome.storage.local.set({ savedJobs: jobs });

        // Show notification
        chrome.action.setBadgeText({ text: '✓', tabId: tab.id });
        chrome.action.setBadgeBackgroundColor({ color: '#10B981', tabId: tab.id });

        setTimeout(() => {
            chrome.action.setBadgeText({ text: 'ON', tabId: tab.id });
            chrome.action.setBadgeBackgroundColor({ color: '#6366F1', tabId: tab.id });
        }, 2000);
    }
});
