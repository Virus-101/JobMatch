// ============================================
// Indeed Strategy — Indeed Apply Automation
// ============================================

const BaseStrategy = require('./base');

class IndeedStrategy extends BaseStrategy {
    constructor() {
        super('Indeed');
    }

    async searchJobs(page, query, location, limit = 25) {
        const q = encodeURIComponent(query);
        const loc = encodeURIComponent(location);
        // fromage=7 = last 7 days, sort=date
        const url = `https://www.indeed.com/jobs?q=${q}&l=${loc}&fromage=7&sort=date`;

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await this.humanDelay(2000, 3000);

        if (await this.checkForBlock(page)) {
            return { jobs: [], error: 'Indeed detected automation. Try again later.', blocked: true };
        }

        // Scroll to load jobs
        for (let i = 0; i < 2; i++) {
            await this.humanScroll(page);
            await this.humanDelay(1000, 1500);
        }

        const jobs = await page.evaluate((limit) => {
            const cards = document.querySelectorAll('.job_seen_beacon, .resultContent, .jobsearch-ResultsList > li');
            const results = [];

            cards.forEach((card, idx) => {
                if (idx >= limit) return;
                const titleEl = card.querySelector('.jobTitle a, h2.jobTitle a, a[data-jk]');
                const companyEl = card.querySelector('.companyName, [data-testid="company-name"]');
                const locationEl = card.querySelector('.companyLocation, [data-testid="text-location"]');
                const salaryEl = card.querySelector('.salary-snippet-container, .estimatedSalary, [data-testid="attribute_snippet_testid"], .metadata.salary-snippet-container');
                const indeedApply = card.querySelector('.indeedApply, .iaLabel') !== null ||
                    card.textContent.includes('Easily apply');

                if (titleEl) {
                    const href = titleEl.href || '';
                    const jk = titleEl.getAttribute('data-jk') || new URL(href, 'https://www.indeed.com').searchParams.get('jk') || '';

                    results.push({
                        title: titleEl.textContent.trim(),
                        company: companyEl ? companyEl.textContent.trim() : '',
                        location: locationEl ? locationEl.textContent.trim() : '',
                        salary: salaryEl ? salaryEl.textContent.trim() : '',
                        url: jk ? `https://www.indeed.com/viewjob?jk=${jk}` : href,
                        easyApply: indeedApply,
                        platform: 'indeed',
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

            if (await this.checkForBlock(page)) {
                return { success: false, reason: 'blocked' };
            }

            // Check if already applied
            const alreadyApplied = await page.evaluate(() => {
                return document.body.innerText.toLowerCase().includes('you have already applied');
            });
            if (alreadyApplied) return { success: false, reason: 'already_applied' };

            // Click Apply button
            const applyClicked = await this.waitAndClick(page,
                '#indeedApplyButton, .jobsearch-IndeedApplyButton-newDesign button, button[id*="apply"], .ia-IndeedApplyButton',
                5000
            );

            if (!applyClicked) {
                // Check for external apply link
                const externalLink = await page.$('a[href*="apply"], button[aria-label*="Apply"]');
                if (externalLink) {
                    const href = await page.evaluate(el => el.href, externalLink);
                    if (href) {
                        return { success: false, reason: 'external_apply', externalUrl: href };
                    }
                }
                return { success: false, reason: 'no_apply_button' };
            }

            await this.humanDelay(2000, 3000);

            // Handle Indeed's application flow (may open in iframe or new page)
            const frames = page.frames();
            let applyFrame = page;

            // Check for iframe
            for (const frame of frames) {
                const isApplyFrame = await frame.evaluate(() => {
                    return !!document.querySelector('#ia-container, .ia-Resume, form[action*="apply"]');
                }).catch(() => false);
                if (isApplyFrame) {
                    applyFrame = frame;
                    break;
                }
            }

            // Fill application form
            let step = 0;
            const maxSteps = 8;

            while (step < maxSteps) {
                step++;

                // Fill common fields
                await this.fillCommonFields(applyFrame, profile);
                await this.humanDelay(500, 1000);

                // Upload resume if file input exists
                const fileInput = await applyFrame.$('input[type="file"]');
                if (fileInput && profile.cvFilePath) {
                    await fileInput.uploadFile(profile.cvFilePath);
                    await this.humanDelay(1500, 2500);
                }

                // Look for Continue/Next button
                const continueBtn = await applyFrame.$('button[id*="continue"], button[data-testid*="continue"], .ia-continueButton button, button.ia-continueButton');
                if (continueBtn) {
                    await continueBtn.click();
                    await this.humanDelay(1500, 2500);
                    continue;
                }

                // Look for Submit/Apply button
                const submitBtn = await applyFrame.$('button[type="submit"], button[id*="submit"], .ia-ReviewForm button');
                if (submitBtn) {
                    const btnText = await applyFrame.evaluate(el => el.textContent.toLowerCase(), submitBtn);
                    if (btnText.includes('submit') || btnText.includes('apply')) {
                        await submitBtn.click();
                        await this.humanDelay(2000, 3000);

                        // Check for success
                        const success = await page.evaluate(() => {
                            const text = document.body.innerText.toLowerCase();
                            return text.includes('application has been submitted') ||
                                text.includes('application was sent') ||
                                text.includes('successfully applied');
                        });

                        return { success, reason: success ? 'submitted' : 'submit_unclear' };
                    }
                }

                break; // No more buttons found
            }

            return { success: false, reason: 'incomplete' };
        } catch (err) {
            return { success: false, reason: 'error', error: err.message };
        }
    }
}

module.exports = IndeedStrategy;
