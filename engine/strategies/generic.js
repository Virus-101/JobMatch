// ============================================
// Generic Strategy — Works on ANY website
// Handles ATS platforms + company career pages
// ============================================

const BaseStrategy = require('./base');

class GenericStrategy extends BaseStrategy {
    constructor() {
        super('Generic');

        // Known ATS patterns and their form structures
        this.atsPatterns = {
            greenhouse: {
                detect: url => url.includes('greenhouse.io') || url.includes('boards.greenhouse'),
                applyButton: '#submit_app, button[type="submit"], .application-form button[type="submit"]',
                formFields: {
                    name: '#first_name, input[name="job_application[first_name]"]',
                    lastName: '#last_name, input[name="job_application[last_name]"]',
                    email: '#email, input[name="job_application[email]"]',
                    phone: '#phone, input[name="job_application[phone]"]',
                    resume: 'input[type="file"][name*="resume"], input[type="file"][id*="resume"]',
                    linkedin: 'input[name*="linkedin"], input[id*="linkedin"]',
                    website: 'input[name*="website"], input[id*="website"]',
                    location: 'input[name*="location"], input[id*="location"]',
                },
            },
            lever: {
                detect: url => url.includes('lever.co') || url.includes('jobs.lever'),
                applyButton: '.postings-btn-wrapper button, button[type="submit"], .application-submit',
                formFields: {
                    name: 'input[name="name"], input[name="fullName"]',
                    email: 'input[name="email"]',
                    phone: 'input[name="phone"]',
                    resume: 'input[type="file"]',
                    linkedin: 'input[name="urls[LinkedIn]"], input[name*="linkedin"]',
                    website: 'input[name="urls[Portfolio]"], input[name*="website"]',
                    location: 'input[name*="location"]',
                },
            },
            workable: {
                detect: url => url.includes('workable.com') || url.includes('apply.workable'),
                applyButton: 'button[type="submit"], .application-form button',
                formFields: {
                    name: 'input[name="firstname"], input[data-ui="firstname"]',
                    lastName: 'input[name="lastname"], input[data-ui="lastname"]',
                    email: 'input[name="email"], input[data-ui="email"]',
                    phone: 'input[name="phone"], input[data-ui="phone"]',
                    resume: 'input[type="file"]',
                    location: 'input[name*="location"]',
                },
            },
            workday: {
                detect: url => url.includes('myworkdayjobs.com') || url.includes('workday.com'),
                applyButton: 'button[data-automation-id="applyButton"], button[data-automation-id="bottom-navigation-next-button"]',
                formFields: {
                    name: 'input[data-automation-id="legalNameSection_firstName"]',
                    lastName: 'input[data-automation-id="legalNameSection_lastName"]',
                    email: 'input[data-automation-id="email"]',
                    phone: 'input[data-automation-id="phone-number"]',
                    resume: 'input[type="file"][data-automation-id="file-upload-input-ref"]',
                },
            },
            smartrecruiters: {
                detect: url => url.includes('smartrecruiters.com'),
                applyButton: 'button.js-apply-btn, button[type="submit"]',
                formFields: {
                    name: 'input[name="firstName"]',
                    lastName: 'input[name="lastName"]',
                    email: 'input[name="email"]',
                    phone: 'input[name="phoneNumber"]',
                    resume: 'input[type="file"]',
                    location: 'input[name*="location"]',
                },
            },
        };
    }

    async searchJobs(page, query, location, limit = 10) {
        // Generic strategy doesn't search — it applies to URLs directly
        return { jobs: [], error: 'Generic strategy works with direct URLs. Search from LinkedIn/Indeed first.' };
    }

    async applyToJob(page, jobUrl, profile) {
        try {
            await page.goto(jobUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            await this.humanDelay(2000, 3000);

            if (await this.checkForBlock(page)) {
                return { success: false, reason: 'blocked' };
            }

            // Detect which ATS this is
            const ats = this._detectATS(jobUrl);
            console.log(`[Generic] Detected ATS: ${ats ? ats : 'Unknown — using smart fill'}`);

            if (ats && this.atsPatterns[ats]) {
                return await this._applyATS(page, profile, this.atsPatterns[ats]);
            } else {
                return await this._applyGeneric(page, profile);
            }
        } catch (err) {
            return { success: false, reason: 'error', error: err.message };
        }
    }

    _detectATS(url) {
        for (const [name, config] of Object.entries(this.atsPatterns)) {
            if (config.detect(url)) return name;
        }
        return null;
    }

    // Apply using known ATS form structure
    async _applyATS(page, profile, atsConfig) {
        const nameParts = (profile.name || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        // Try clicking "Apply" first if needed
        const applyBtn = await page.$(atsConfig.applyButton);
        if (applyBtn) {
            const btnText = await page.evaluate(el => el.textContent.toLowerCase(), applyBtn);
            if (btnText.includes('apply')) {
                await applyBtn.click();
                await this.humanDelay(1500, 2500);
            }
        }

        // Fill form fields
        const fields = atsConfig.formFields;
        let filled = 0;

        if (fields.name) filled += await this.fillField(page, fields.name, firstName) ? 1 : 0;
        if (fields.lastName) filled += await this.fillField(page, fields.lastName, lastName) ? 1 : 0;
        if (fields.email) filled += await this.fillField(page, fields.email, profile.email || '') ? 1 : 0;
        if (fields.phone) filled += await this.fillField(page, fields.phone, profile.phone || '') ? 1 : 0;
        if (fields.location) filled += await this.fillField(page, fields.location, profile.location || '') ? 1 : 0;
        if (fields.linkedin) filled += await this.fillField(page, fields.linkedin, profile.linkedin || '') ? 1 : 0;
        if (fields.website) filled += await this.fillField(page, fields.website, profile.website || '') ? 1 : 0;

        // Upload resume
        if (fields.resume && profile.cvFilePath) {
            await this.uploadFile(page, fields.resume, profile.cvFilePath);
            filled++;
        }

        // Also fill any fields not covered by ATS-specific selectors
        filled += await this.fillCommonFields(page, profile);

        await this.humanDelay(1000, 2000);

        // Submit
        const submitBtn = await page.$(atsConfig.applyButton);
        if (submitBtn) {
            const btnText = await page.evaluate(el => el.textContent.toLowerCase(), submitBtn);
            if (btnText.includes('submit') || btnText.includes('apply') || btnText.includes('send')) {
                await submitBtn.click();
                await this.humanDelay(2000, 3000);

                const success = await page.evaluate(() => {
                    const text = document.body.innerText.toLowerCase();
                    return text.includes('thank') || text.includes('submitted') ||
                        text.includes('received') || text.includes('success');
                });

                return { success, filled, reason: success ? 'submitted' : 'submit_unclear' };
            }
        }

        return { success: false, filled, reason: 'form_filled_not_submitted' };
    }

    // Apply to unknown websites using smart field detection
    async _applyGeneric(page, profile) {
        // First, try to find and click an "Apply" button
        const applyClicked = await page.evaluate(() => {
            const btns = [...document.querySelectorAll('a, button')];
            const applyBtn = btns.find(b => {
                const text = b.textContent.toLowerCase().trim();
                return text === 'apply' || text === 'apply now' || text === 'apply for this job' ||
                    text === 'submit application' || text.includes('apply');
            });
            if (applyBtn) { applyBtn.click(); return true; }
            return false;
        });

        if (applyClicked) {
            await this.humanDelay(2000, 3000);
        }

        // Fill all detectable fields
        const filled = await this.fillCommonFields(page, profile);

        // Upload resume if possible
        const fileInput = await page.$('input[type="file"]');
        if (fileInput && profile.cvFilePath) {
            await fileInput.uploadFile(profile.cvFilePath);
        }

        await this.humanDelay(1000, 1500);

        // Try to find and click submit
        const submitted = await page.evaluate(() => {
            const btns = [...document.querySelectorAll('button[type="submit"], input[type="submit"], button')];
            const submitBtn = btns.find(b => {
                const text = (b.textContent || b.value || '').toLowerCase().trim();
                return text === 'submit' || text === 'apply' || text === 'submit application' ||
                    text === 'send application' || text.includes('submit');
            });
            if (submitBtn) { submitBtn.click(); return true; }
            return false;
        });

        if (submitted) {
            await this.humanDelay(2000, 3000);
            const success = await page.evaluate(() => {
                const text = document.body.innerText.toLowerCase();
                return text.includes('thank') || text.includes('submitted') ||
                    text.includes('received') || text.includes('success');
            });
            return { success, filled, reason: success ? 'submitted' : 'submit_unclear' };
        }

        return { success: false, filled, reason: filled > 0 ? 'form_filled_not_submitted' : 'no_form_found' };
    }
}

module.exports = GenericStrategy;
