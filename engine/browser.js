// ============================================
// JobMatch AI — Browser Manager
// Connects Puppeteer to YOUR Chrome profile
// so all your existing logins are available
// ============================================

const puppeteer = require('puppeteer');
const path = require('path');
const os = require('os');
const fs = require('fs');

class BrowserManager {
    constructor() {
        this.browser = null;
        this.activePage = null;
        this.isConnected = false;
        this.detectedAccounts = {};
    }

    // Find the user's default Chrome profile path
    getChromeProfilePath() {
        const platform = os.platform();
        const home = os.homedir();

        const paths = {
            win32: path.join(home, 'AppData', 'Local', 'Google', 'Chrome', 'User Data'),
            darwin: path.join(home, 'Library', 'Application Support', 'Google', 'Chrome'),
            linux: path.join(home, '.config', 'google-chrome'),
        };

        const profilePath = paths[platform];
        if (profilePath && fs.existsSync(profilePath)) return profilePath;

        // Fallback: try other Chromium browsers
        const fallbacks = {
            win32: [
                path.join(home, 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data'),
                path.join(home, 'AppData', 'Local', 'BraveSoftware', 'Brave-Browser', 'User Data'),
            ],
            darwin: [
                path.join(home, 'Library', 'Application Support', 'Microsoft Edge'),
                path.join(home, 'Library', 'Application Support', 'BraveSoftware', 'Brave-Browser'),
            ],
            linux: [
                path.join(home, '.config', 'microsoft-edge'),
                path.join(home, '.config', 'BraveSoftware', 'Brave-Browser'),
            ],
        };

        for (const fallbackPath of (fallbacks[platform] || [])) {
            if (fs.existsSync(fallbackPath)) return fallbackPath;
        }

        return null;
    }

    // Launch browser with user's profile (preserves all logins)
    async launch() {
        if (this.browser && this.isConnected) return;

        const profilePath = this.getChromeProfilePath();
        console.log('[Browser] Chrome profile path:', profilePath || 'Not found, using fresh profile');

        const launchOptions = {
            headless: false, // Must be visible so user can intervene
            defaultViewport: null,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--window-size=1366,900',
                '--start-maximized',
            ],
        };

        // Use a copy of the profile to avoid conflicts with running Chrome
        if (profilePath) {
            const tempProfile = path.join(os.tmpdir(), 'jobmatch-chrome-profile');
            launchOptions.userDataDir = tempProfile;

            // Copy cookies & login data from main profile
            await this._copyLoginData(profilePath, tempProfile);
        }

        try {
            this.browser = await puppeteer.launch(launchOptions);
            this.isConnected = true;

            this.browser.on('disconnected', () => {
                this.isConnected = false;
                this.browser = null;
                console.log('[Browser] Disconnected');
            });

            console.log('[Browser] Launched successfully');
        } catch (err) {
            console.error('[Browser] Launch failed:', err.message);
            throw err;
        }
    }

    // Copy login/cookie data from main Chrome profile
    async _copyLoginData(sourcePath, destPath) {
        try {
            if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });

            const defaultSrc = path.join(sourcePath, 'Default');
            const defaultDest = path.join(destPath, 'Default');
            if (!fs.existsSync(defaultDest)) fs.mkdirSync(defaultDest, { recursive: true });

            // Copy key files that store login sessions
            const filesToCopy = ['Cookies', 'Login Data', 'Web Data', 'Preferences', 'Secure Preferences'];
            for (const file of filesToCopy) {
                const src = path.join(defaultSrc, file);
                const dest = path.join(defaultDest, file);
                if (fs.existsSync(src)) {
                    try { fs.copyFileSync(src, dest); } catch (e) { /* file may be locked */ }
                }
            }

            // Copy Local State (needed for decryption)
            const localStateSrc = path.join(sourcePath, 'Local State');
            const localStateDest = path.join(destPath, 'Local State');
            if (fs.existsSync(localStateSrc)) {
                try { fs.copyFileSync(localStateSrc, localStateDest); } catch (e) { /* ignore */ }
            }
        } catch (err) {
            console.log('[Browser] Could not copy login data:', err.message);
        }
    }

    // Get a new page
    async newPage() {
        if (!this.browser) await this.launch();
        const page = await this.browser.newPage();

        // Make automation less detectable
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
            window.chrome = { runtime: {} };
        });

        // Set realistic user agent
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        );

        this.activePage = page;
        return page;
    }

    // Detect which accounts the user is logged into
    async detectAccounts() {
        const accounts = {};
        const page = await this.newPage();

        const platforms = [
            {
                name: 'LinkedIn',
                url: 'https://www.linkedin.com/feed/',
                loggedInSelector: '.feed-identity-module, .global-nav__me-photo, img.feed-identity-module__member-photo',
                loginUrl: 'https://www.linkedin.com/login',
            },
            {
                name: 'Indeed',
                url: 'https://www.indeed.com/',
                loggedInSelector: '[data-gnav-element-name="AccountMenu"], .gnav-Account',
                loginUrl: 'https://secure.indeed.com/auth',
            },
            {
                name: 'Glassdoor',
                url: 'https://www.glassdoor.com/',
                loggedInSelector: '#AccountMenuButton, .accountMenu',
                loginUrl: 'https://www.glassdoor.com/profile/login_input.htm',
            },
        ];

        for (const platform of platforms) {
            try {
                await page.goto(platform.url, { waitUntil: 'networkidle2', timeout: 15000 });
                await new Promise(r => setTimeout(r, 2000));

                const isLoggedIn = await page.$(platform.loggedInSelector) !== null;
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

    // Close everything
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.isConnected = false;
        }
    }
}

module.exports = new BrowserManager();
