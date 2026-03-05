// ============================================
// Base Strategy — All platforms extend this
// ============================================

class BaseStrategy {
    constructor(name) {
        this.name = name;
        this.applied = 0;
        this.skipped = 0;
        this.failed = 0;
    }

    // Override in subclasses
    async searchJobs(page, query, location, limit) {
        throw new Error(`${this.name}: searchJobs not implemented`);
    }

    async applyToJob(page, jobUrl, profile) {
        throw new Error(`${this.name}: applyToJob not implemented`);
    }

    // ── Shared helpers ──────────────────────────

    async waitAndClick(page, selector, timeout = 5000) {
        try {
            await page.waitForSelector(selector, { timeout });
            await page.click(selector);
            return true;
        } catch {
            return false;
        }
    }

    async waitAndType(page, selector, text, timeout = 5000) {
        try {
            await page.waitForSelector(selector, { timeout });
            await page.click(selector, { clickCount: 3 }); // Select all
            await page.type(selector, text, { delay: 30 + Math.random() * 50 });
            return true;
        } catch {
            return false;
        }
    }

    async fillField(page, selector, value) {
        try {
            const el = await page.$(selector);
            if (!el) return false;

            const currentVal = await page.evaluate(el => el.value, el);
            if (currentVal && currentVal.trim()) return true; // Already filled

            await el.click({ clickCount: 3 });
            await el.type(value, { delay: 25 + Math.random() * 40 });
            return true;
        } catch {
            return false;
        }
    }

    // Fill a field by finding its label text
    async fillByLabel(page, labelText, value) {
        try {
            const filled = await page.evaluate((labelText, value) => {
                const labels = [...document.querySelectorAll('label')];
                const label = labels.find(l => l.textContent.toLowerCase().includes(labelText.toLowerCase()));
                if (!label) return false;

                let input = label.querySelector('input, textarea, select');
                if (!input && label.htmlFor) {
                    input = document.getElementById(label.htmlFor);
                }
                if (!input) {
                    // Look for next sibling or nearby input
                    const parent = label.closest('.form-group, .field, .question, [class*="field"], [class*="input"]');
                    if (parent) input = parent.querySelector('input, textarea, select');
                }
                if (!input) return false;
                if (input.value && input.value.trim()) return true; // Already filled

                const nativeSetter = Object.getOwnPropertyDescriptor(
                    input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
                    'value'
                ).set;
                nativeSetter.call(input, value);
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            }, labelText, value);
            return filled;
        } catch {
            return false;
        }
    }

    // Upload a file to a file input
    async uploadFile(page, selector, filePath) {
        try {
            const input = await page.$(selector);
            if (!input) return false;
            await input.uploadFile(filePath);
            return true;
        } catch {
            return false;
        }
    }

    // Smart delay to mimic human behavior
    async humanDelay(min = 800, max = 2000) {
        const delay = min + Math.random() * (max - min);
        await new Promise(r => setTimeout(r, delay));
    }

    // Scroll down slowly like a human
    async humanScroll(page) {
        await page.evaluate(() => {
            window.scrollBy({ top: 200 + Math.random() * 300, behavior: 'smooth' });
        });
        await this.humanDelay(300, 800);
    }

    // Check if we're on a CAPTCHA/blocked page
    async checkForBlock(page) {
        const blocked = await page.evaluate(() => {
            const text = document.body?.innerText?.toLowerCase() || '';
            return text.includes('captcha') ||
                text.includes('verify you are human') ||
                text.includes('unusual traffic') ||
                text.includes('security check');
        });
        return blocked;
    }

    // Try to fill common form fields using profile data
    async fillCommonFields(page, profile) {
        const fieldMap = [
            { labels: ['first name', 'given name', 'prenom'], value: (profile.name || '').split(' ')[0] },
            { labels: ['last name', 'family name', 'surname', 'nom'], value: (profile.name || '').split(' ').slice(1).join(' ') },
            { labels: ['full name', 'your name', 'name'], value: profile.name },
            { labels: ['email', 'e-mail', 'courriel'], value: profile.email },
            { labels: ['phone', 'telephone', 'mobile', 'cell'], value: profile.phone },
            { labels: ['city', 'location', 'address', 'ville'], value: profile.location },
            { labels: ['linkedin', 'linkedin url', 'linkedin profile'], value: profile.linkedin },
            { labels: ['website', 'portfolio', 'personal website', 'url'], value: profile.website },
            { labels: ['current title', 'job title', 'position', 'titre'], value: profile.title },
            { labels: ['summary', 'cover letter', 'about', 'message', 'why', 'motivation'], value: profile.summary },
        ];

        let filled = 0;
        for (const field of fieldMap) {
            if (!field.value) continue;
            for (const label of field.labels) {
                const success = await this.fillByLabel(page, label, field.value);
                if (success) { filled++; break; }
            }
        }

        // Also try by input name/id/placeholder
        const inputMap = [
            { attrs: ['name', 'first_name', 'firstname', 'fname', 'given-name'], value: (profile.name || '').split(' ')[0] },
            { attrs: ['lastname', 'last_name', 'surname', 'lname', 'family-name'], value: (profile.name || '').split(' ').slice(1).join(' ') },
            { attrs: ['email', 'e-mail', 'mail'], value: profile.email },
            { attrs: ['phone', 'tel', 'mobile', 'telephone'], value: profile.phone },
            { attrs: ['city', 'location', 'address'], value: profile.location },
            { attrs: ['linkedin'], value: profile.linkedin },
            { attrs: ['website', 'portfolio', 'url'], value: profile.website },
        ];

        for (const field of inputMap) {
            if (!field.value) continue;
            for (const attr of field.attrs) {
                const filled_ok = await page.evaluate((attr, value) => {
                    const selectors = [
                        `input[name*="${attr}" i]`, `input[id*="${attr}" i]`,
                        `input[placeholder*="${attr}" i]`, `input[autocomplete*="${attr}" i]`,
                        `textarea[name*="${attr}" i]`, `textarea[id*="${attr}" i]`,
                    ];
                    for (const sel of selectors) {
                        const el = document.querySelector(sel);
                        if (el && !el.value) {
                            const setter = Object.getOwnPropertyDescriptor(
                                el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value'
                            ).set;
                            setter.call(el, value);
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                            return true;
                        }
                    }
                    return false;
                }, attr, field.value);
                if (filled_ok) { filled++; break; }
            }
        }

        return filled;
    }
}

module.exports = BaseStrategy;
