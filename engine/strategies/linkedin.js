// ============================================
// LinkedIn Strategy — Easy Apply Automation
// ============================================

const BaseStrategy = require('./base');

class LinkedInStrategy extends BaseStrategy {
    constructor() {
        super('LinkedIn');
    }

    async searchJobs(page, query, location, limit = 25) {
        const q = encodeURIComponent(query);
        const loc = encodeURIComponent(location);
        // f_AL=true filters for Easy Apply only
        const url = `https://www.linkedin.com/jobs/search/?keywords=${q}&location=${loc}&f_AL=true&sortBy=DD`;

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await this.humanDelay(2000, 3000);

        // Check if logged in
        const isLoggedIn = await page.$('.global-nav__me-photo, .feed-identity-module') !== null;
        if (!isLoggedIn) {
            return { jobs: [], error: 'Not logged into LinkedIn. Please log in first.', loginRequired: true };
        }

        // Scroll to load more jobs
        for (let i = 0; i < 3; i++) {
            await this.humanScroll(page);
            await this.humanDelay(1000, 2000);
        }

        // Extract job listings
        const jobs = await page.evaluate((limit) => {
            const cards = document.querySelectorAll('.jobs-search-results__list-item, .job-card-container, .scaffold-layout__list-item');
            const results = [];

            cards.forEach((card, idx) => {
                if (idx >= limit) return;
                const titleEl = card.querySelector('.job-card-list__title, .artdeco-entity-lockup__title, a[class*="job-card"]');
                const companyEl = card.querySelector('.job-card-container__primary-description, .artdeco-entity-lockup__subtitle');
                const locationEl = card.querySelector('.job-card-container__metadata-item, .artdeco-entity-lockup__caption');
                const linkEl = card.querySelector('a[href*="/jobs/view/"]');
                const easyApply = card.querySelector('.job-card-container__apply-method') !== null ||
                    card.textContent.includes('Easy Apply');

                if (titleEl && linkEl) {
                    results.push({
                        title: titleEl.textContent.trim(),
                        company: companyEl ? companyEl.textContent.trim() : '',
                        location: locationEl ? locationEl.textContent.trim() : '',
                        url: linkEl.href.split('?')[0],
                        easyApply,
                        platform: 'linkedin',
                    });
                }
            });

            return results;
        }, limit);

        return { jobs, error: null };
    }

    async applyToJob(page, jobUrl, profile) {
        try {
            await page.goto(jobUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            await this.humanDelay(2000, 3000);

            // Check if already applied
            const alreadyApplied = await page.evaluate(() => {
                return document.body.innerText.includes('Applied') &&
                    document.querySelector('.jobs-s-apply button[aria-label*="Applied"]') !== null;
            });
            if (alreadyApplied) return { success: false, reason: 'already_applied' };

            // Click Easy Apply button
            const easyApplyClicked = await this.waitAndClick(page,
                '.jobs-apply-button, button[aria-label*="Easy Apply"], .jobs-s-apply button',
                5000
            );

            if (!easyApplyClicked) {
                // Maybe it's external apply
                return { success: false, reason: 'no_easy_apply' };
            }

            await this.humanDelay(1500, 2500);

            // Handle multi-step Easy Apply modal
            let step = 0;
            const maxSteps = 10;

            while (step < maxSteps) {
                step++;

                // Check for modal
                const modalVisible = await page.$('.jobs-easy-apply-modal, .artdeco-modal--layer-default') !== null;
                if (!modalVisible) break;

                // Fill fields in current step
                await this._fillEasyApplyStep(page, profile);
                await this.humanDelay(800, 1500);

                // Check for "Review" or "Submit" button
                const submitBtn = await page.$('button[aria-label*="Submit"], button[aria-label*="Review"]');
                if (submitBtn) {
                    const btnText = await page.evaluate(el => el.textContent.trim(), submitBtn);

                    if (btnText.toLowerCase().includes('review')) {
                        await submitBtn.click();
                        await this.humanDelay(1000, 2000);
                        // Now click actual Submit
                        const finalSubmit = await page.$('button[aria-label*="Submit"]');
                        if (finalSubmit) {
                            await finalSubmit.click();
                            await this.humanDelay(2000, 3000);
                            return { success: true, reason: 'submitted' };
                        }
                    } else {
                        await submitBtn.click();
                        await this.humanDelay(2000, 3000);
                        return { success: true, reason: 'submitted' };
                    }
                }

                // Click "Next" button to go to next step
                const nextBtn = await page.$('button[aria-label*="Next"], button[aria-label*="Continue"]');
                if (nextBtn) {
                    await nextBtn.click();
                    await this.humanDelay(1000, 2000);
                } else {
                    break;
                }
            }

            // Check for success message
            const success = await page.evaluate(() => {
                return document.body.innerText.includes('application was sent') ||
                    document.body.innerText.includes('Application submitted');
            });

            return { success, reason: success ? 'submitted' : 'incomplete' };
        } catch (err) {
            return { success: false, reason: 'error', error: err.message };
        }
    }

    async _fillEasyApplyStep(page, profile) {
        // Contact info
        await this.fillByLabel(page, 'Phone', profile.phone || '');
        await this.fillByLabel(page, 'Email', profile.email || '');
        await this.fillByLabel(page, 'City', profile.location || '');

        // Additional questions — try to answer common ones
        const questions = await page.$$('.jobs-easy-apply-form-section__grouping, .fb-dash-form-element');
        for (const q of questions) {
            const text = await page.evaluate(el => el.textContent.toLowerCase(), q);

            // Years of experience
            if (text.includes('years') && text.includes('experience')) {
                const input = await q.$('input[type="text"], input[type="number"]');
                if (input) {
                    const years = profile.experience?.length ? String(profile.experience.length + 1) : '3';
                    await input.click({ clickCount: 3 });
                    await input.type(years, { delay: 50 });
                }
            }

            // Work authorization
            if (text.includes('authorized') || text.includes('sponsorship') || text.includes('work permit')) {
                const yesRadio = await q.$('input[value="Yes"], label:has-text("Yes")');
                if (yesRadio) await yesRadio.click();
            }

            // Select dropdowns
            const select = await q.$('select');
            if (select && text.includes('experience')) {
                await select.select('3'); // Default to some experience
            }
        }

        // Resume upload
        const fileInput = await page.$('input[type="file"]');
        if (fileInput && profile.cvFilePath) {
            await fileInput.uploadFile(profile.cvFilePath);
            await this.humanDelay(1000, 2000);
        }
    }
}

module.exports = LinkedInStrategy;
