// ============================================
// JobMatch AI — Content Script
// Injects match scores into job listings
// ============================================

(async function () {
    'use strict';

    const SITE = JobMatcher.detectSite();
    let profile = null;
    let isProcessing = false;

    // Load user profile
    async function loadProfile() {
        try {
            profile = await StorageManager.getProfile();
        } catch (e) {
            console.log('[JobMatch AI] Could not load profile:', e);
        }
    }

    await loadProfile();

    // ── Main: Process job listings on the page ──
    function processJobListings() {
        if (isProcessing || !profile || !profile.skills || profile.skills.length === 0) return;
        isProcessing = true;

        const selectors = {
            linkedin: '.job-card-container, .jobs-search-results__list-item, .scaffold-layout__list-item',
            indeed: '.job_seen_beacon, .jobsearch-ResultsList > li, .resultContent',
            glassdoor: '.react-job-listing, [data-test="jobListing"]',
            monster: '.card-content',
            ziprecruiter: '.job_result',
        };

        const jobCards = document.querySelectorAll(selectors[SITE] || '.job-card');

        jobCards.forEach(card => {
            // Skip already processed cards
            if (card.dataset.jobmatchProcessed) return;
            card.dataset.jobmatchProcessed = 'true';

            try {
                const jobData = JobMatcher.extractJobFromElement(card, SITE);
                if (!jobData.title && !jobData.description) return;

                const result = JobMatcher.score(jobData, profile);
                injectScoreBadge(card, result, jobData);
            } catch (e) {
                console.log('[JobMatch AI] Error processing card:', e);
            }
        });

        isProcessing = false;
    }

    // ── Inject score badge into job card ────────
    function injectScoreBadge(card, result, jobData) {
        // Don't add duplicate badges
        if (card.querySelector('.jm-badge')) return;

        const badge = document.createElement('div');
        badge.className = 'jm-badge';
        badge.setAttribute('data-score', result.score);

        const matchLevel = result.matchLevel || { label: 'Low Match', emoji: '😐', color: '#EF4444' };

        badge.innerHTML = `
      <div class="jm-badge-score" style="background: ${matchLevel.color}">
        ${result.score}
      </div>
      <div class="jm-badge-info">
        <span class="jm-badge-label">${matchLevel.emoji} ${matchLevel.label}</span>
        ${result.matchedSkills && result.matchedSkills.length > 0 ?
                `<span class="jm-badge-skills">${result.matchedSkills.slice(0, 3).join(', ')}${result.matchedSkills.length > 3 ? ` +${result.matchedSkills.length - 3}` : ''}</span>`
                : ''
            }
      </div>
      <button class="jm-save-btn" title="Save to JobMatch">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
      </button>
    `;

        // Save button click
        badge.querySelector('.jm-save-btn').addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            jobData.matchScore = result.score;
            await StorageManager.saveJob(jobData);

            const btn = e.currentTarget;
            btn.innerHTML = '✓';
            btn.classList.add('jm-saved');
            btn.title = 'Saved!';
        });

        // Position relative to the card
        card.style.position = card.style.position || 'relative';
        card.appendChild(badge);
    }

    // ── Observe for dynamic content (infinite scroll, etc) ──
    const observer = new MutationObserver((mutations) => {
        let hasNewNodes = false;
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                hasNewNodes = true;
                break;
            }
        }
        if (hasNewNodes) {
            setTimeout(processJobListings, 500);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // ── Listen for messages from popup ──────────
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.action === 'scanPage') {
            loadProfile().then(() => {
                processJobListings();
                const processed = document.querySelectorAll('[data-jobmatch-processed]');
                sendResponse({ jobsFound: processed.length });
            });
            return true;
        }

        if (msg.action === 'profileUpdated') {
            loadProfile().then(() => {
                document.querySelectorAll('[data-jobmatch-processed]').forEach(card => {
                    const badge = card.querySelector('.jm-badge');
                    if (badge) badge.remove();
                    delete card.dataset.jobmatchProcessed;
                });
                processJobListings();
            });
        }

        // ── Auto-Fill from popup ──
        if (msg.action === 'fillApplication') {
            if (typeof AutoFiller !== 'undefined') {
                AutoFiller.fillPage().then(result => {
                    sendResponse(result);
                });
            } else {
                sendResponse({ filled: 0, error: 'AutoFiller not available' });
            }
            return true;
        }

        if (msg.action === 'undoFill') {
            if (typeof AutoFiller !== 'undefined') {
                AutoFiller.undoAll();
                sendResponse({ success: true });
            }
            return true;
        }
    });

    // ── Floating Auto-Fill FAB ──────────────────
    function maybeShowAutoFillFAB() {
        if (document.getElementById('jm-autofill-fab')) return;

        const forms = document.querySelectorAll('form');
        let isApplicationPage = false;

        const url = window.location.href.toLowerCase();
        const appPatterns = ['apply', 'application', 'submit', 'careers', 'jobs/view', 'easy-apply'];
        if (appPatterns.some(p => url.includes(p))) isApplicationPage = true;

        if (!isApplicationPage) {
            forms.forEach(form => {
                const text = form.textContent.toLowerCase();
                const inputs = form.querySelectorAll('input, textarea');
                if (inputs.length >= 3 && (text.includes('name') || text.includes('email') || text.includes('resume') || text.includes('apply'))) {
                    isApplicationPage = true;
                }
            });
        }

        if (document.querySelector('.jobs-easy-apply-modal, .artdeco-modal--layer-default')) {
            isApplicationPage = true;
        }

        if (!isApplicationPage) return;

        const fab = document.createElement('button');
        fab.id = 'jm-autofill-fab';
        fab.className = 'jm-fill-btn';
        fab.style.cssText = 'position:fixed!important;bottom:24px!important;left:24px!important;z-index:2147483646!important;padding:12px 20px!important;font-size:14px!important;border-radius:12px!important;';
        fab.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> ⚡ Auto-Fill Application`;

        fab.addEventListener('click', async () => {
            fab.innerHTML = '⏳ Filling...';
            if (typeof AutoFiller !== 'undefined') {
                const result = await AutoFiller.fillPage();
                if (result.filled > 0) {
                    fab.innerHTML = `✅ ${result.filled} fields filled`;
                    fab.style.background = 'linear-gradient(135deg, #059669, #10b981)';
                } else {
                    fab.innerHTML = '🔍 No fields found';
                    fab.style.background = 'linear-gradient(135deg, #d97706, #f59e0b)';
                }
                setTimeout(() => {
                    fab.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> ⚡ Auto-Fill Application`;
                    fab.style.background = '';
                }, 3000);
            }
        });

        document.body.appendChild(fab);
    }

    // ── Initial scan ────────────────────────────
    if (document.readyState === 'complete') {
        setTimeout(processJobListings, 1000);
        setTimeout(maybeShowAutoFillFAB, 2000);
    } else {
        window.addEventListener('load', () => {
            setTimeout(processJobListings, 1500);
            setTimeout(maybeShowAutoFillFAB, 2500);
        });
    }

    // Periodic re-scan for dynamically loaded content + FAB
    setInterval(() => {
        processJobListings();
        maybeShowAutoFillFAB();
    }, 5000);

})();
