// ============================================
// JobMatch AI — Popup Controller
// Smart CV Detection + Edit Flow
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    // ── Tab Navigation ─────────────────────────
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`tab-${target}`).classList.add('active');
        });
    });

    // ── Load profile ─────────────────────────
    let profile = await StorageManager.getProfile();
    // Ensure nested objects exist
    if (!profile.preferences) profile.preferences = {};
    if (!profile.skills) profile.skills = [];
    if (!profile.experience) profile.experience = [];
    if (!profile.education) profile.education = [];
    if (!profile.languages) profile.languages = [];

    // ── Utility: escape HTML ─────────────────
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ── Utility: highlight auto-filled fields ─
    function highlightField(inputId) {
        const el = document.getElementById(inputId);
        if (!el) return;
        el.classList.add('auto-filled');
        // Remove highlight when user edits
        el.addEventListener('input', () => {
            el.classList.remove('auto-filled');
        }, { once: true });
    }

    // ── Tag Rendering ──────────────────────────
    function renderTags(containerId, tags, onRemove) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';

        tags.forEach((tag, idx) => {
            const el = document.createElement('span');
            el.className = 'tag';
            el.innerHTML = `
                ${escapeHtml(tag)}
                <button class="tag-remove" data-idx="${idx}">&times;</button>
            `;
            el.querySelector('.tag-remove').addEventListener('click', () => onRemove(idx));
            container.appendChild(el);
        });
    }

    // ── Tag Input Setup ──────────────────────
    function setupTagInput(inputId, btnId, arrayGetter, arraySetter) {
        const input = document.getElementById(inputId);
        const btn = document.getElementById(btnId);
        if (!input || !btn) return;

        const addTag = () => {
            const value = input.value.trim();
            if (!value) return;
            const arr = arrayGetter();
            if (!arr.includes(value)) {
                arr.push(value);
                arraySetter(arr);
            }
            input.value = '';
        };

        btn.addEventListener('click', addTag);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); addTag(); }
        });
    }

    // ── Populate All Profile Fields ──────────
    function populateProfile() {
        document.getElementById('profileName').value = profile.name || '';
        document.getElementById('profileEmail').value = profile.email || '';
        document.getElementById('profilePhone').value = profile.phone || '';
        document.getElementById('profileLocation').value = profile.location || '';
        document.getElementById('profileTitle').value = profile.title || '';
        document.getElementById('profileSummary').value = profile.summary || '';
        document.getElementById('cvTextArea').value = profile.cvText || '';

        // Skills
        renderTags('skillsTags', profile.skills || [], (idx) => {
            profile.skills.splice(idx, 1);
            populateProfile();
        });
        const skillsBadge = document.getElementById('skillsCountBadge');
        if (skillsBadge) skillsBadge.textContent = (profile.skills || []).length;

        // Languages
        renderTags('languageTags', profile.languages || [], (idx) => {
            profile.languages.splice(idx, 1);
            populateProfile();
        });
        const langBadge = document.getElementById('langCountBadge');
        if (langBadge) langBadge.textContent = (profile.languages || []).length;

        // Experience
        renderExperience();

        // Education
        renderEducation();
    }

    // ── Render Experience List ────────────────
    function renderExperience() {
        const container = document.getElementById('experienceList');
        const badge = document.getElementById('expCountBadge');
        const exps = profile.experience || [];

        badge.textContent = exps.length;

        if (exps.length === 0) {
            container.innerHTML = `
                <div class="empty-state-sm">
                    <p>No experience detected yet. Paste your CV above to extract.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        exps.forEach((exp, idx) => {
            const el = document.createElement('div');
            el.className = 'entry-item';
            el.innerHTML = `
                <div class="entry-header">
                    <div class="entry-main">
                        <input type="text" class="input input-inline entry-title-input" value="${escapeHtml(exp.title || '')}" placeholder="Job Title" data-idx="${idx}" data-field="title">
                        <input type="text" class="input input-inline entry-company-input" value="${escapeHtml(exp.company || '')}" placeholder="Company" data-idx="${idx}" data-field="company">
                    </div>
                    <div class="entry-actions">
                        <input type="text" class="input input-sm entry-date-input" value="${escapeHtml(exp.dateRange || '')}" placeholder="2020 - Present" data-idx="${idx}" data-field="dateRange">
                        <button class="entry-remove-btn" data-idx="${idx}" title="Remove">✕</button>
                    </div>
                </div>
                <textarea class="textarea textarea-sm entry-desc-input" rows="2" placeholder="Description / bullet points..." data-idx="${idx}" data-field="description">${escapeHtml((exp.description || []).join('\n'))}</textarea>
            `;

            // Bind edits back to profile
            el.querySelectorAll('input, textarea').forEach(input => {
                input.addEventListener('change', () => {
                    const i = parseInt(input.dataset.idx);
                    const field = input.dataset.field;
                    if (field === 'description') {
                        profile.experience[i].description = input.value.split('\n').filter(l => l.trim());
                    } else {
                        profile.experience[i][field] = input.value;
                    }
                });
            });

            // Remove button
            el.querySelector('.entry-remove-btn').addEventListener('click', () => {
                profile.experience.splice(idx, 1);
                renderExperience();
            });

            container.appendChild(el);
        });
    }

    // ── Render Education List ────────────────
    function renderEducation() {
        const container = document.getElementById('educationList');
        const badge = document.getElementById('eduCountBadge');
        const edus = profile.education || [];

        badge.textContent = edus.length;

        if (edus.length === 0) {
            container.innerHTML = `
                <div class="empty-state-sm">
                    <p>No education detected yet. Paste your CV above to extract.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        edus.forEach((edu, idx) => {
            const el = document.createElement('div');
            el.className = 'entry-item';
            el.innerHTML = `
                <div class="entry-header">
                    <div class="entry-main">
                        <input type="text" class="input input-inline entry-title-input" value="${escapeHtml(edu.degree || '')}" placeholder="Degree" data-idx="${idx}" data-field="degree">
                    </div>
                    <div class="entry-actions">
                        <button class="entry-remove-btn" data-idx="${idx}" title="Remove">✕</button>
                    </div>
                </div>
                <textarea class="textarea textarea-sm entry-desc-input" rows="1" placeholder="Details..." data-idx="${idx}" data-field="details">${escapeHtml((edu.details || []).join('\n'))}</textarea>
            `;

            el.querySelectorAll('input, textarea').forEach(input => {
                input.addEventListener('change', () => {
                    const i = parseInt(input.dataset.idx);
                    const field = input.dataset.field;
                    if (field === 'details') {
                        profile.education[i].details = input.value.split('\n').filter(l => l.trim());
                    } else {
                        profile.education[i][field] = input.value;
                    }
                });
            });

            el.querySelector('.entry-remove-btn').addEventListener('click', () => {
                profile.education.splice(idx, 1);
                renderEducation();
            });

            container.appendChild(el);
        });
    }

    // ── Add Experience ───────────────────────
    document.getElementById('btnAddExperience').addEventListener('click', () => {
        profile.experience.push({
            title: '',
            company: '',
            dateRange: '',
            description: []
        });
        renderExperience();
    });

    // ── Add Education ────────────────────────
    document.getElementById('btnAddEducation').addEventListener('click', () => {
        profile.education.push({
            degree: '',
            details: []
        });
        renderEducation();
    });

    // ── Populate Preferences ─────────────────
    function populatePreferences() {
        const prefs = profile.preferences || {};

        renderTags('titleTags', prefs.desiredTitles || [], (idx) => {
            profile.preferences.desiredTitles.splice(idx, 1);
            populatePreferences();
        });
        renderTags('locationTags', prefs.desiredLocations || [], (idx) => {
            profile.preferences.desiredLocations.splice(idx, 1);
            populatePreferences();
        });
        renderTags('mustHaveTags', prefs.mustHaveKeywords || [], (idx) => {
            profile.preferences.mustHaveKeywords.splice(idx, 1);
            populatePreferences();
        });
        renderTags('excludeTags', prefs.excludeKeywords || [], (idx) => {
            profile.preferences.excludeKeywords.splice(idx, 1);
            populatePreferences();
        });

        document.getElementById('remoteOnly').checked = prefs.remoteOnly || false;
        document.getElementById('salaryMin').value = prefs.salaryMin || '';
        document.getElementById('salaryMax').value = prefs.salaryMax || '';

        document.querySelectorAll('.jobTypeCheckbox').forEach(cb => {
            cb.checked = (prefs.jobTypes || ['full-time']).includes(cb.value);
        });
    }

    // ── Setup tag inputs ─────────────────────
    setupTagInput('skillInput', 'btnAddSkill',
        () => profile.skills,
        (arr) => { profile.skills = arr; populateProfile(); }
    );
    setupTagInput('languageInput', 'btnAddLanguage',
        () => profile.languages || [],
        (arr) => { profile.languages = arr; populateProfile(); }
    );
    setupTagInput('titleInput', 'btnAddTitle',
        () => profile.preferences.desiredTitles || [],
        (arr) => { profile.preferences.desiredTitles = arr; populatePreferences(); }
    );
    setupTagInput('locationInput', 'btnAddLocation',
        () => profile.preferences.desiredLocations || [],
        (arr) => { profile.preferences.desiredLocations = arr; populatePreferences(); }
    );
    setupTagInput('mustHaveInput', 'btnAddMustHave',
        () => profile.preferences.mustHaveKeywords || [],
        (arr) => { profile.preferences.mustHaveKeywords = arr; populatePreferences(); }
    );
    setupTagInput('excludeInput', 'btnAddExclude',
        () => profile.preferences.excludeKeywords || [],
        (arr) => { profile.preferences.excludeKeywords = arr; populatePreferences(); }
    );

    // ══════════════════════════════════════════
    // ★ CV PARSING — The main detection flow ★
    // ══════════════════════════════════════════
    document.getElementById('btnParseCV').addEventListener('click', () => {
        const cvText = document.getElementById('cvTextArea').value;
        if (!cvText.trim()) {
            showToast('Please paste your CV text first.', 'error');
            return;
        }

        const parsed = CVParser.parse(cvText);
        if (!parsed) {
            showToast('Could not parse CV. Try again.', 'error');
            return;
        }

        // ── Auto-fill EVERYTHING from parsed data ──
        profile.cvText = cvText;

        // Name — always overwrite with detected
        if (parsed.name) {
            profile.name = parsed.name;
        }

        // Title
        if (parsed.title) {
            profile.title = parsed.title;
        }

        // Location
        if (parsed.location) {
            profile.location = parsed.location;
        }

        // Email
        if (parsed.contact.email) {
            profile.email = parsed.contact.email;
        }

        // Phone
        if (parsed.contact.phone) {
            profile.phone = parsed.contact.phone;
        }

        // Summary
        if (parsed.summary) {
            profile.summary = parsed.summary;
        }

        // Skills — merge (add new ones, keep existing)
        if (parsed.skills.length > 0) {
            const existingSkills = new Set((profile.skills || []).map(s => s.toLowerCase()));
            for (const skill of parsed.skills) {
                if (!existingSkills.has(skill.toLowerCase())) {
                    profile.skills.push(skill);
                    existingSkills.add(skill.toLowerCase());
                }
            }
        }

        // Experience — overwrite with parsed
        if (parsed.experience.length > 0) {
            profile.experience = parsed.experience;
        }

        // Education — overwrite with parsed
        if (parsed.education.length > 0) {
            profile.education = parsed.education;
        }

        // Languages
        if (parsed.languages && parsed.languages.length > 0) {
            const existingLangs = new Set((profile.languages || []).map(l => l.toLowerCase()));
            for (const lang of parsed.languages) {
                if (!existingLangs.has(lang.toLowerCase())) {
                    if (!profile.languages) profile.languages = [];
                    profile.languages.push(lang);
                    existingLangs.add(lang.toLowerCase());
                }
            }
        }

        // Years of experience
        profile.yearsOfExperience = CVParser.calculateYearsOfExperience(parsed.experience);

        // ── Show detection summary ──
        showDetectionSummary(parsed);

        // ── Populate all fields ──
        populateProfile();

        // ── Highlight auto-filled fields ──
        const fieldsToHighlight = [];
        if (parsed.name) fieldsToHighlight.push('profileName');
        if (parsed.contact.email) fieldsToHighlight.push('profileEmail');
        if (parsed.contact.phone) fieldsToHighlight.push('profilePhone');
        if (parsed.location) fieldsToHighlight.push('profileLocation');
        if (parsed.title) fieldsToHighlight.push('profileTitle');
        if (parsed.summary) fieldsToHighlight.push('profileSummary');
        fieldsToHighlight.forEach(id => highlightField(id));

        // Show auto-filled badge
        if (fieldsToHighlight.length > 0) {
            document.getElementById('personalInfoBadge').style.display = 'inline-flex';
        }

        // Build toast message
        const detectedItems = [];
        if (parsed.name) detectedItems.push('name');
        if (parsed.title) detectedItems.push('title');
        if (parsed.contact.email) detectedItems.push('email');
        if (parsed.skills.length > 0) detectedItems.push(`${parsed.skills.length} skills`);
        if (parsed.experience.length > 0) detectedItems.push(`${parsed.experience.length} jobs`);
        if (parsed.education.length > 0) detectedItems.push(`${parsed.education.length} education`);

        showToast(`✅ Detected: ${detectedItems.join(', ')}. Review & edit below!`, 'success');
    });

    // ── Detection Summary Panel ──────────────
    function showDetectionSummary(parsed) {
        const summary = document.getElementById('detectionSummary');
        const grid = document.getElementById('detectionGrid');
        const badge = document.getElementById('detectionBadge');

        summary.style.display = 'block';
        summary.classList.add('pulse');
        setTimeout(() => summary.classList.remove('pulse'), 500);

        // Count detected fields
        const fields = [];
        if (parsed.name) fields.push({ icon: '👤', label: 'Name', value: parsed.name, status: 'detected' });
        else fields.push({ icon: '👤', label: 'Name', value: 'Not found', status: 'missing' });

        if (parsed.title) fields.push({ icon: '💼', label: 'Title', value: parsed.title, status: 'detected' });
        else fields.push({ icon: '💼', label: 'Title', value: 'Not found', status: 'missing' });

        if (parsed.contact.email) fields.push({ icon: '📧', label: 'Email', value: parsed.contact.email, status: 'detected' });
        else fields.push({ icon: '📧', label: 'Email', value: 'Not found', status: 'missing' });

        if (parsed.contact.phone) fields.push({ icon: '📱', label: 'Phone', value: parsed.contact.phone, status: 'detected' });
        else fields.push({ icon: '📱', label: 'Phone', value: 'Not found', status: 'missing' });

        if (parsed.location) fields.push({ icon: '📍', label: 'Location', value: parsed.location, status: 'detected' });
        else fields.push({ icon: '📍', label: 'Location', value: 'Not found', status: 'missing' });

        if (parsed.summary) fields.push({ icon: '📝', label: 'Summary', value: parsed.summary.substring(0, 50) + '...', status: 'detected' });
        else fields.push({ icon: '📝', label: 'Summary', value: 'Not found', status: 'missing' });

        fields.push({ icon: '🛠️', label: 'Skills', value: `${parsed.skills.length} found`, status: parsed.skills.length > 0 ? 'detected' : 'missing' });
        fields.push({ icon: '💼', label: 'Experience', value: `${parsed.experience.length} entries`, status: parsed.experience.length > 0 ? 'detected' : 'missing' });
        fields.push({ icon: '🎓', label: 'Education', value: `${parsed.education.length} entries`, status: parsed.education.length > 0 ? 'detected' : 'missing' });

        if (parsed.languages && parsed.languages.length > 0) {
            fields.push({ icon: '🌍', label: 'Languages', value: parsed.languages.join(', '), status: 'detected' });
        }

        const detectedCount = fields.filter(f => f.status === 'detected').length;
        badge.textContent = `${detectedCount}/${fields.length} detected`;

        grid.innerHTML = fields.map(f => `
            <div class="detection-item ${f.status}">
                <span class="detection-icon">${f.icon}</span>
                <span class="detection-label">${f.label}</span>
                <span class="detection-value">${escapeHtml(f.value)}</span>
                <span class="detection-status">${f.status === 'detected' ? '✅' : '⚠️'}</span>
            </div>
        `).join('');
    }

    // ── Save Profile ─────────────────────────
    document.getElementById('btnSaveProfile').addEventListener('click', async () => {
        // Read all fields back from the form (user may have edited)
        profile.name = document.getElementById('profileName').value;
        profile.email = document.getElementById('profileEmail').value;
        profile.phone = document.getElementById('profilePhone').value;
        profile.location = document.getElementById('profileLocation').value;
        profile.title = document.getElementById('profileTitle').value;
        profile.summary = document.getElementById('profileSummary').value;
        profile.cvText = document.getElementById('cvTextArea').value;

        await StorageManager.saveProfile(profile);
        updateDashboard();
        showToast('✅ Profile saved successfully!', 'success');

        // Notify content scripts
        try {
            chrome.runtime.sendMessage({ action: 'profileUpdated' });
        } catch (e) { /* ignore if no background */ }
    });

    // ── Save Preferences ─────────────────────
    document.getElementById('btnSavePreferences').addEventListener('click', async () => {
        profile.preferences.remoteOnly = document.getElementById('remoteOnly').checked;
        profile.preferences.salaryMin = parseInt(document.getElementById('salaryMin').value) || 0;
        profile.preferences.salaryMax = parseInt(document.getElementById('salaryMax').value) || 0;
        profile.preferences.jobTypes = Array.from(document.querySelectorAll('.jobTypeCheckbox:checked'))
            .map(cb => cb.value);

        await StorageManager.saveProfile(profile);
        updateDashboard();
        showToast('✅ Preferences saved!', 'success');
    });

    // ── Dashboard ────────────────────────────
    async function updateDashboard() {
        const stats = await StorageManager.getStats();

        document.getElementById('statSaved').textContent = stats.totalSaved;
        document.getElementById('statApplied').textContent = stats.applied;
        document.getElementById('statInterview').textContent = stats.interviews;
        document.getElementById('statOffers').textContent = stats.offers;

        const completion = calculateCompletion(profile);
        document.getElementById('completionBadge').textContent = `${completion}%`;
        document.getElementById('completionBar').style.width = `${completion}%`;

        if (completion < 30) {
            document.getElementById('completionHint').textContent = '🔴 Paste your CV to auto-fill your profile and unlock job matching.';
        } else if (completion < 60) {
            document.getElementById('completionHint').textContent = '🟡 Good start! Review extracted data and set your preferences.';
        } else if (completion < 90) {
            document.getElementById('completionHint').textContent = '🟢 Almost there! Fine-tune your preferences.';
        } else {
            document.getElementById('completionHint').textContent = '🔥 Profile complete! Browse job sites to see match scores.';
        }

        await renderRecentJobs();
    }

    function calculateCompletion(profile) {
        let score = 0, total = 0;
        const checks = [
            { check: !!profile.name, weight: 10 },
            { check: !!profile.email, weight: 5 },
            { check: !!profile.title, weight: 15 },
            { check: !!profile.cvText, weight: 10 },
            { check: (profile.skills || []).length > 0, weight: 20 },
            { check: (profile.skills || []).length >= 5, weight: 5 },
            { check: (profile.experience || []).length > 0, weight: 10 },
            { check: (profile.education || []).length > 0, weight: 5 },
            { check: (profile.preferences?.desiredTitles || []).length > 0, weight: 10 },
            { check: (profile.preferences?.desiredLocations || []).length > 0 || profile.preferences?.remoteOnly, weight: 5 },
            { check: !!profile.preferences?.salaryMin, weight: 5 },
        ];
        for (const { check, weight } of checks) { total += weight; if (check) score += weight; }
        return Math.round((score / total) * 100);
    }

    // ── Render Recent Jobs ───────────────────
    async function renderRecentJobs() {
        const jobs = await StorageManager.getSavedJobs();
        const container = document.getElementById('recentJobsList');

        if (jobs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">💼</span>
                    <p>No saved jobs yet. Browse job sites and save matching positions!</p>
                </div>
            `;
            return;
        }

        const recent = jobs.slice(-3).reverse();
        container.innerHTML = '';
        for (const job of recent) {
            container.appendChild(createJobElement(job));
        }
    }

    // ── Render Saved Jobs ────────────────────
    async function renderSavedJobs(filter = 'all', search = '') {
        let jobs = await StorageManager.getSavedJobs();
        if (filter !== 'all') jobs = jobs.filter(j => j.status === filter);
        if (search) {
            const q = search.toLowerCase();
            jobs = jobs.filter(j =>
                (j.title || '').toLowerCase().includes(q) ||
                (j.company || '').toLowerCase().includes(q) ||
                (j.location || '').toLowerCase().includes(q)
            );
        }

        const container = document.getElementById('savedJobsList');
        if (jobs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">🔍</span>
                    <p>${filter !== 'all' ? 'No jobs with this status.' : 'No saved jobs yet. Visit a job site to start matching!'}</p>
                </div>
            `;
            return;
        }
        container.innerHTML = '';
        jobs.reverse().forEach(job => container.appendChild(createJobElement(job, true)));
    }

    function createJobElement(job, showActions = false) {
        const matchResult = JobMatcher.score(job, profile);
        const scoreClass = getScoreClass(matchResult.score);

        const el = document.createElement('div');
        el.className = 'job-item';
        el.innerHTML = `
            <div class="job-score ${scoreClass}">${matchResult.score}</div>
            <div class="job-details">
                <div class="job-title" title="${escapeHtml(job.title)}">${escapeHtml(job.title || 'Untitled')}</div>
                <div class="job-company">${escapeHtml(job.company || 'Unknown Company')}</div>
                <div class="job-meta">
                    <span>📍 ${escapeHtml(job.location || 'N/A')}</span>
                    <span>• ${job.source || 'Manual'}</span>
                </div>
                ${matchResult.matchedSkills && matchResult.matchedSkills.length > 0 ? `
                    <div class="match-skills-row">
                        ${matchResult.matchedSkills.slice(0, 4).map(s => `<span class="match-skill-tag">${escapeHtml(s)}</span>`).join('')}
                        ${matchResult.matchedSkills.length > 4 ? `<span class="match-skill-tag">+${matchResult.matchedSkills.length - 4}</span>` : ''}
                    </div>
                ` : ''}
            </div>
            ${showActions ? `
                <div class="job-actions">
                    <select class="job-status-select" data-job-id="${job.id}">
                        <option value="saved" ${job.status === 'saved' ? 'selected' : ''}>💾 Saved</option>
                        <option value="applied" ${job.status === 'applied' ? 'selected' : ''}>📤 Applied</option>
                        <option value="interview" ${job.status === 'interview' ? 'selected' : ''}>🎯 Interview</option>
                        <option value="offer" ${job.status === 'offer' ? 'selected' : ''}>🏆 Offer</option>
                        <option value="rejected" ${job.status === 'rejected' ? 'selected' : ''}>❌ Rejected</option>
                    </select>
                    <button class="job-remove-btn" data-job-id="${job.id}" title="Remove">🗑️</button>
                </div>
            ` : ''}
        `;

        el.querySelector('.job-details').addEventListener('click', () => {
            if (job.url) chrome.tabs.create({ url: job.url });
        });

        const statusSelect = el.querySelector('.job-status-select');
        if (statusSelect) {
            statusSelect.addEventListener('change', async (e) => {
                await StorageManager.updateJobStatus(job.id, e.target.value);
                updateDashboard();
                showToast(`Job status updated to ${e.target.value}`, 'success');
            });
        }

        const removeBtn = el.querySelector('.job-remove-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await StorageManager.removeJob(job.id);
                renderSavedJobs(document.getElementById('jobFilter').value, document.getElementById('jobSearch').value);
                updateDashboard();
                showToast('Job removed', 'success');
            });
        }

        return el;
    }

    function getScoreClass(score) {
        if (score >= 85) return 'score-excellent';
        if (score >= 70) return 'score-great';
        if (score >= 55) return 'score-good';
        if (score >= 40) return 'score-fair';
        return 'score-low';
    }

    // ── Job Filters ──────────────────────────
    document.getElementById('jobFilter').addEventListener('change', () => {
        renderSavedJobs(document.getElementById('jobFilter').value, document.getElementById('jobSearch').value);
    });
    document.getElementById('jobSearch').addEventListener('input', () => {
        renderSavedJobs(document.getElementById('jobFilter').value, document.getElementById('jobSearch').value);
    });

    // ── View All Jobs ────────────────────────
    document.getElementById('btnViewAllJobs').addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        document.querySelector('[data-tab="jobs"]').classList.add('active');
        document.getElementById('tab-jobs').classList.add('active');
        renderSavedJobs();
    });

    // ── Scan Page ────────────────────────────
    document.getElementById('btnScanPage').addEventListener('click', async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) { showToast('No active tab found.', 'error'); return; }
            chrome.tabs.sendMessage(tab.id, { action: 'scanPage' }, (response) => {
                if (chrome.runtime.lastError) {
                    showToast('Open a job site first (LinkedIn, Indeed, etc.)', 'error');
                    return;
                }
                if (response && response.jobsFound) {
                    showToast(`🔍 Found ${response.jobsFound} jobs on this page!`, 'success');
                } else {
                    showToast('No jobs detected on this page.', 'error');
                }
            });
        } catch (err) {
            showToast('Could not scan page. Make sure you\'re on a job site.', 'error');
        }
    });

    // ── Export Data ───────────────────────────
    document.getElementById('btnExportData').addEventListener('click', async () => {
        const jobs = await StorageManager.getSavedJobs();
        const data = {
            profile: profile,
            savedJobs: jobs,
            exportedAt: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `jobmatch-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('📁 Data exported successfully!', 'success');
    });

    // ── Toast Notifications ──────────────────
    function showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span>${type === 'success' ? '✅' : '⚠️'}</span>
            <span>${message}</span>
        `;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'toastOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ── Initialize ───────────────────────────
    populateProfile();
    populatePreferences();
    updateDashboard();
    renderSavedJobs();
});
