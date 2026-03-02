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
            return true; // Keep channel open for async response
        }

        if (msg.action === 'profileUpdated') {
            loadProfile().then(() => {
                // Re-process all cards
                document.querySelectorAll('[data-jobmatch-processed]').forEach(card => {
                    const badge = card.querySelector('.jm-badge');
                    if (badge) badge.remove();
                    delete card.dataset.jobmatchProcessed;
                });
                processJobListings();
            });
        }
    });

    // ── Initial scan ────────────────────────────
    // Wait for page to load, then scan
    if (document.readyState === 'complete') {
        setTimeout(processJobListings, 1000);
    } else {
        window.addEventListener('load', () => {
            setTimeout(processJobListings, 1500);
        });
    }

    // Periodic re-scan for dynamically loaded content
    setInterval(() => {
        processJobListings();
    }, 5000);

})();
