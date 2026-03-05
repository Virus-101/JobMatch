// ============================================
// JobMatch AI — Browser Manager
// Connects to YOUR already-running Chrome
// so ALL your logins are preserved
// ============================================

const puppeteer = require('puppeteer');
const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');

const DEBUG_PORT = 9222;

class BrowserManager {
    constructor() {
        this.browser = null;
        this.isConnected = false;
        this.detectedAccounts = {};
        this.mode = null; // 'connect' or 'launch'
    }

    // ═══════════════════════════════════════════
    // MODE 1 (PREFERRED): Connect to running Chrome
    // Your Chrome must be started with:
    //   --remote-debugging-port=9222
    // ═══════════════════════════════════════════

    // Check if Chrome is running with debugging enabled
    async _getChromeDebugEndpoint() {
        return new Promise((resolve) => {
            const req = http.get(`http://127.0.0.1:${DEBUG_PORT}/json/version`, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const info = JSON.parse(data);
                        resolve(info.webSocketDebuggerUrl || null);
                    } catch { resolve(null); }
                });
            });
            req.on('error', () => resolve(null));
            req.setTimeout(3000, () => { req.abort(); resolve(null); });
        });
    }

    // Connect to user's already-running Chrome browser
    async connectToExistingChrome() {
        const wsEndpoint = await this._getChromeDebugEndpoint();
        if (!wsEndpoint) return false;

        try {
            this.browser = await puppeteer.connect({
                browserWSEndpoint: wsEndpoint,
                defaultViewport: null,
            });

            this.isConnected = true;
            this.mode = 'connect';

            this.browser.on('disconnected', () => {
                this.isConnected = false;
                this.browser = null;
                console.log('[Browser] Disconnected from Chrome');
            });

            console.log('[Browser] ✅ Connected to your running Chrome — all logins preserved!');
            return true;
        } catch (err) {
            console.log('[Browser] Could not connect:', err.message);
            return false;
        }
    }

    // ═══════════════════════════════════════════
    // MODE 2 (FALLBACK): Launch with user profile
    // Uses your Chrome profile directory directly
    // Requires Chrome to be closed first
    // ═══════════════════════════════════════════

    getChromeProfilePath() {
        const home = os.homedir();
        const platform = os.platform();
        const paths = {
            win32: path.join(home, 'AppData', 'Local', 'Google', 'Chrome', 'User Data'),
            darwin: path.join(home, 'Library', 'Application Support', 'Google', 'Chrome'),
            linux: path.join(home, '.config', 'google-chrome'),
        };
        const p = paths[platform];
        return (p && fs.existsSync(p)) ? p : null;
    }

    getChromeExecutablePath() {
        const platform = os.platform();
        const candidates = {
            win32: [
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
            ],
            darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
            linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'],
        };
        for (const p of (candidates[platform] || [])) {
            if (fs.existsSync(p)) return p;
        }
        return null;
    }

    async launchWithProfile() {
        const profilePath = this.getChromeProfilePath();
        const chromePath = this.getChromeExecutablePath();

        console.log('[Browser] Profile:', profilePath || 'not found');
        console.log('[Browser] Chrome:', chromePath || 'not found');

        const opts = {
            headless: false,
            defaultViewport: null,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--window-size=1366,900',
            ],
        };

        if (chromePath) opts.executablePath = chromePath;
        if (profilePath) opts.userDataDir = profilePath;

        try {
            this.browser = await puppeteer.launch(opts);
            this.isConnected = true;
            this.mode = 'launch';

            this.browser.on('disconnected', () => {
                this.isConnected = false;
                this.browser = null;
                console.log('[Browser] Disconnected');
            });

            console.log('[Browser] ✅ Launched with your Chrome profile — logins should be available');
            return true;
        } catch (err) {
            console.error('[Browser] Launch failed:', err.message);
            return false;
        }
    }

    // ═══════════════════════════════════════════
    // MAIN: Smart launch — tries connect first, then launch
    // ═══════════════════════════════════════════

    async launch() {
        if (this.browser && this.isConnected) return;

        // Try Mode 1 first: connect to running Chrome
        console.log('[Browser] Trying to connect to your running Chrome...');
        const connected = await this.connectToExistingChrome();
        if (connected) return;

        // Mode 2: launch with profile
        console.log('[Browser] Chrome not in debug mode. Launching with your profile...');
        console.log('[Browser] ⚡ TIP: For best results, restart Chrome with this shortcut:');
        console.log('[Browser]    chrome.exe --remote-debugging-port=9222');
        console.log('[Browser]    Then all your logins will be instantly available!');

        const launched = await this.launchWithProfile();
        if (!launched) {
            throw new Error('Could not connect to or launch Chrome. Close all Chrome windows and try again.');
        }
    }

    // Get a page (reuse existing tab or create new one)
    async newPage() {
        if (!this.browser) await this.launch();

        // When connected to existing Chrome, open a new tab
        const page = await this.browser.newPage();

        // Stealth: make automation less detectable
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            window.chrome = { runtime: {} };
        });

        return page;
    }

    // Detect which platforms the user is logged into
    async detectAccounts() {
        const accounts = {};
        const page = await this.newPage();

        const platforms = [
            {
                name: 'LinkedIn',
                url: 'https://www.linkedin.com/feed/',
                loggedInCheck: async (p) => {
                    const url = p.url();
                    // If we're NOT redirected to login page, we're logged in
                    return !url.includes('/login') && !url.includes('/authwall');
                },
                loginUrl: 'https://www.linkedin.com/login',
            },
            {
                name: 'Indeed',
                url: 'https://www.indeed.com/myaccount',
                loggedInCheck: async (p) => {
                    const url = p.url();
                    return !url.includes('/auth') && !url.includes('/login');
                },
                loginUrl: 'https://secure.indeed.com/auth',
            },
            {
                name: 'Glassdoor',
                url: 'https://www.glassdoor.com/member/home/index.htm',
                loggedInCheck: async (p) => {
                    const url = p.url();
                    return !url.includes('/login') && !url.includes('/auth');
                },
                loginUrl: 'https://www.glassdoor.com/profile/login_input.htm',
            },
        ];

        for (const platform of platforms) {
            try {
                await page.goto(platform.url, { waitUntil: 'networkidle2', timeout: 15000 });
                await new Promise(r => setTimeout(r, 2000));

                const isLoggedIn = await platform.loggedInCheck(page);
                accounts[platform.name.toLowerCase()] = {
                    name: platform.name,
                    loggedIn: isLoggedIn,
                    loginUrl: platform.loginUrl,
                };
                console.log(`[Accounts] ${platform.name}: ${isLoggedIn ? '✅ Logged in' : '❌ Not logged in'}`);
            } catch (err) {
                accounts[platform.name.toLowerCase()] = {
                    name: platform.name,
                    loggedIn: false,
                    loginUrl: platform.loginUrl,
                    error: err.message,
                };
            }
        }

        await page.close();
        this.detectedAccounts = accounts;
        return accounts;
    }

    async close() {
        if (this.browser) {
            if (this.mode === 'connect') {
                // Don't close the user's browser! Just disconnect.
                this.browser.disconnect();
            } else {
                await this.browser.close();
            }
            this.browser = null;
            this.isConnected = false;
        }
    }
}

module.exports = new BrowserManager();
