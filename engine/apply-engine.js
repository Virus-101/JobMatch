// ============================================
// JobMatch AI — Auto Apply Engine
// Main orchestrator that coordinates all strategies
// ============================================

const LinkedInStrategy = require('./strategies/linkedin');
const IndeedStrategy = require('./strategies/indeed');
const GenericStrategy = require('./strategies/generic');
const browserManager = require('./browser');
const fs = require('fs');
const path = require('path');

class ApplyEngine {
    constructor() {
        this.strategies = {
            linkedin: new LinkedInStrategy(),
            indeed: new IndeedStrategy(),
            generic: new GenericStrategy(),
        };

        this.isRunning = false;
        this.isPaused = false;
        this.currentJob = null;
        this.queue = [];
        this.results = [];
        this.profile = null;
        this.settings = {
            maxApplicationsPerSession: 50,
            delayBetweenApps: [8000, 15000], // min-max ms
            platforms: ['linkedin', 'indeed'],
            query: '',
            location: '',
            easyApplyOnly: true,
            skipApplied: true,
            autoSubmit: false, // false = fill only, user reviews. true = auto submit.
        };

        this.listeners = [];
        this._loadHistory();
    }

    // Register a listener for real-time updates
    onUpdate(callback) {
        this.listeners.push(callback);
    }

    _emit(event, data) {
        const payload = { event, data, timestamp: new Date().toISOString() };
        this.listeners.forEach(fn => fn(payload));
    }

    // Load profile from file or localStorage export
    loadProfile(profileData) {
        this.profile = profileData;
        this._emit('profile_loaded', {
            name: profileData.name,
            skills: profileData.skills?.length || 0,
        });
    }

    // Load application history
    _loadHistory() {
        const historyPath = path.join(__dirname, 'data', 'history.json');
        try {
            if (fs.existsSync(historyPath)) {
                this.results = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
            }
        } catch (e) {
            this.results = [];
        }
    }

    _saveHistory() {
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(path.join(dataDir, 'history.json'), JSON.stringify(this.results, null, 2));
    }

    // Configure settings
    configure(settings) {
        Object.assign(this.settings, settings);
        this._emit('settings_updated', this.settings);
    }

    // Get current status
    getStatus() {
        return {
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            currentJob: this.currentJob,
            queueLength: this.queue.length,
            totalApplied: this.results.filter(r => r.success).length,
            totalFailed: this.results.filter(r => !r.success).length,
            totalSkipped: this.results.filter(r => r.reason === 'already_applied' || r.reason === 'skipped').length,
            sessionApplied: this.results.filter(r => r.success && this._isCurrentSession(r)).length,
            accounts: browserManager.detectedAccounts,
        };
    }

    _isCurrentSession(result) {
        const sessionStart = Date.now() - 3600000; // Last hour
        return new Date(result.timestamp).getTime() > sessionStart;
    }

    // ══════════════════════════════════════════
    // MAIN: Start auto-apply process
    // ══════════════════════════════════════════
    async start() {
        if (this.isRunning) {
            this._emit('error', { message: 'Engine is already running' });
            return;
        }

        if (!this.profile || !this.profile.name) {
            this._emit('error', { message: 'Load your profile first (upload CV in dashboard)' });
            return;
        }

        this.isRunning = true;
        this.isPaused = false;
        this._emit('started', { settings: this.settings });

        try {
            // Step 1: Launch browser
            this._emit('status', { message: '🚀 Launching browser with your Chrome profile...' });
            await browserManager.launch();

            // Step 2: Detect accounts
            this._emit('status', { message: '🔍 Detecting your logged-in accounts...' });
            const accounts = await browserManager.detectAccounts();
            this._emit('accounts_detected', accounts);

            // Step 3: Search for jobs on each platform
            for (const platform of this.settings.platforms) {
                if (!this.isRunning) break;

                const strategy = this.strategies[platform];
                if (!strategy) continue;

                const account = accounts[platform];
                if (account && !account.loggedIn) {
                    this._emit('warning', {
                        platform,
                        message: `Not logged into ${account.name}. Skipping. Log in at: ${account.loginUrl}`,
                    });
                    continue;
                }

                this._emit('status', { message: `🔎 Searching ${strategy.name} for "${this.settings.query}"...` });

                const page = await browserManager.newPage();
                const { jobs, error } = await strategy.searchJobs(
                    page, this.settings.query, this.settings.location, this.settings.maxApplicationsPerSession
                );

                if (error) {
                    this._emit('warning', { platform, message: error });
                    await page.close();
                    continue;
                }

                this._emit('jobs_found', { platform, count: jobs.length });

                // Filter jobs
                const filtered = jobs.filter(job => {
                    if (this.settings.easyApplyOnly && !job.easyApply) return false;
                    if (this.settings.skipApplied) {
                        const alreadyInHistory = this.results.some(r => r.url === job.url);
                        if (alreadyInHistory) return false;
                    }
                    return true;
                });

                this._emit('status', { message: `📋 ${filtered.length} jobs to apply (${jobs.length - filtered.length} filtered out)` });

                // Add to queue
                this.queue.push(...filtered);
                await page.close();
            }

            // Step 4: Apply to each job in queue
            if (this.queue.length === 0) {
                this._emit('status', { message: '📭 No new jobs to apply to. Try different search terms.' });
                this.isRunning = false;
                return;
            }

            this._emit('status', { message: `⚡ Starting applications: ${this.queue.length} jobs in queue` });

            let applied = 0;
            for (let i = 0; i < this.queue.length; i++) {
                if (!this.isRunning) break;

                // Wait if paused
                while (this.isPaused) {
                    await new Promise(r => setTimeout(r, 1000));
                    if (!this.isRunning) break;
                }

                if (applied >= this.settings.maxApplicationsPerSession) {
                    this._emit('status', { message: `🛑 Reached session limit (${this.settings.maxApplicationsPerSession})` });
                    break;
                }

                const job = this.queue[i];
                this.currentJob = job;
                this._emit('applying', {
                    index: i + 1,
                    total: this.queue.length,
                    job: { title: job.title, company: job.company, platform: job.platform },
                });

                const page = await browserManager.newPage();
                const strategy = this.strategies[job.platform] || this.strategies.generic;

                const result = await strategy.applyToJob(page, job.url, this.profile);
                await page.close();

                const record = {
                    ...job,
                    ...result,
                    timestamp: new Date().toISOString(),
                    autoSubmitted: this.settings.autoSubmit,
                };

                this.results.push(record);
                this._saveHistory();

                if (result.success) {
                    applied++;
                    this._emit('applied', {
                        job: { title: job.title, company: job.company },
                        total: applied,
                    });
                } else if (result.reason === 'already_applied') {
                    this._emit('skipped', {
                        job: { title: job.title, company: job.company },
                        reason: 'Already applied',
                    });
                } else if (result.reason === 'external_apply') {
                    this._emit('external', {
                        job: { title: job.title, company: job.company },
                        url: result.externalUrl,
                    });
                } else {
                    this._emit('failed', {
                        job: { title: job.title, company: job.company },
                        reason: result.reason,
                        error: result.error,
                    });
                }

                // Human-like delay between applications
                if (i < this.queue.length - 1) {
                    const [min, max] = this.settings.delayBetweenApps;
                    const delay = min + Math.random() * (max - min);
                    this._emit('status', { message: `⏳ Waiting ${Math.round(delay / 1000)}s before next application...` });
                    await new Promise(r => setTimeout(r, delay));
                }
            }

            this._emit('completed', {
                applied,
                total: this.queue.length,
                failed: this.results.filter(r => !r.success && this._isCurrentSession(r)).length,
            });

        } catch (err) {
            this._emit('error', { message: err.message });
        } finally {
            this.isRunning = false;
            this.currentJob = null;
            this.queue = [];
        }
    }

    // Pause the engine
    pause() {
        this.isPaused = true;
        this._emit('paused', {});
    }

    // Resume the engine
    resume() {
        this.isPaused = false;
        this._emit('resumed', {});
    }

    // Stop the engine
    async stop() {
        this.isRunning = false;
        this.isPaused = false;
        this.queue = [];
        this.currentJob = null;
        this._emit('stopped', {});
    }

    // Apply to a single URL directly
    async applyToUrl(url, profile) {
        this._emit('status', { message: `🎯 Applying to: ${url}` });

        await browserManager.launch();
        const page = await browserManager.newPage();

        // Detect platform from URL
        let strategy = this.strategies.generic;
        if (url.includes('linkedin.com')) strategy = this.strategies.linkedin;
        else if (url.includes('indeed.com')) strategy = this.strategies.indeed;

        const result = await strategy.applyToJob(page, url, profile || this.profile);
        await page.close();

        const record = { url, ...result, timestamp: new Date().toISOString() };
        this.results.push(record);
        this._saveHistory();

        return record;
    }

    // Get full history
    getHistory() {
        return this.results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    // Clear history
    clearHistory() {
        this.results = [];
        this._saveHistory();
    }
}

module.exports = new ApplyEngine();
