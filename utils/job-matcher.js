// ============================================
// JobMatch AI — Job Matching Engine
// ============================================

const JobMatcher = {

    // Score a job listing against user profile (0-100)
    score(jobData, profile) {
        if (!profile || !jobData) return { score: 0, breakdown: {} };

        const weights = {
            skills: 0.35,
            title: 0.25,
            location: 0.15,
            experience: 0.10,
            keywords: 0.10,
            salary: 0.05
        };

        const breakdown = {
            skills: this.scoreSkills(jobData, profile),
            title: this.scoreTitle(jobData, profile),
            location: this.scoreLocation(jobData, profile),
            experience: this.scoreExperience(jobData, profile),
            keywords: this.scoreKeywords(jobData, profile),
            salary: this.scoreSalary(jobData, profile)
        };

        // Check for deal-breakers
        if (this.hasExcludedKeywords(jobData, profile)) {
            return { score: 0, breakdown, excluded: true };
        }

        const totalScore = Math.round(
            breakdown.skills * weights.skills +
            breakdown.title * weights.title +
            breakdown.location * weights.location +
            breakdown.experience * weights.experience +
            breakdown.keywords * weights.keywords +
            breakdown.salary * weights.salary
        );

        return {
            score: Math.min(100, Math.max(0, totalScore)),
            breakdown,
            matchLevel: this.getMatchLevel(totalScore),
            matchedSkills: this.getMatchedSkills(jobData, profile),
            missingSkills: this.getMissingSkills(jobData, profile)
        };
    },

    // Score based on skill overlap
    scoreSkills(jobData, profile) {
        const jobText = (jobData.title + ' ' + jobData.description + ' ' + (jobData.requirements || '')).toLowerCase();
        const userSkills = (profile.skills || []).map(s => s.toLowerCase());

        if (userSkills.length === 0) return 50; // Neutral if no skills set

        let matched = 0;
        for (const skill of userSkills) {
            const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
            if (regex.test(jobText)) {
                matched++;
            }
        }

        return Math.min(100, Math.round((matched / Math.min(userSkills.length, 10)) * 100));
    },

    // Score based on job title match
    scoreTitle(jobData, profile) {
        const jobTitle = (jobData.title || '').toLowerCase();
        const desiredTitles = (profile.preferences?.desiredTitles || []).map(t => t.toLowerCase());
        const currentTitle = (profile.title || '').toLowerCase();

        if (desiredTitles.length === 0 && !currentTitle) return 50;

        let bestScore = 0;

        const titlesToCheck = [...desiredTitles];
        if (currentTitle) titlesToCheck.push(currentTitle);

        for (const title of titlesToCheck) {
            const words = title.split(/\s+/).filter(w => w.length > 2);
            let wordMatches = 0;

            for (const word of words) {
                if (jobTitle.includes(word)) wordMatches++;
            }

            const score = words.length > 0 ? (wordMatches / words.length) * 100 : 0;
            bestScore = Math.max(bestScore, score);
        }

        return Math.round(bestScore);
    },

    // Score based on location match
    scoreLocation(jobData, profile) {
        const jobLocation = (jobData.location || '').toLowerCase();
        const desiredLocations = (profile.preferences?.desiredLocations || []).map(l => l.toLowerCase());
        const remoteOnly = profile.preferences?.remoteOnly || false;

        // Check for remote
        const isRemote = /remote|work from home|wfh|anywhere|distributed/i.test(jobLocation);
        const isHybrid = /hybrid/i.test(jobLocation);

        if (remoteOnly) {
            if (isRemote) return 100;
            if (isHybrid) return 60;
            return 20;
        }

        if (isRemote) return 90; // Remote is generally good for everyone

        if (desiredLocations.length === 0) return 70; // Neutral

        for (const loc of desiredLocations) {
            if (jobLocation.includes(loc) || loc.includes(jobLocation)) {
                return 100;
            }
            // Check city/state parts
            const locParts = loc.split(/[,\s]+/).filter(p => p.length > 2);
            for (const part of locParts) {
                if (jobLocation.includes(part)) return 80;
            }
        }

        return 30;
    },

    // Score based on experience level
    scoreExperience(jobData, profile) {
        const jobText = (jobData.description + ' ' + (jobData.requirements || '')).toLowerCase();
        const userYears = profile.yearsOfExperience || 0;

        // Extract years requirement from job
        const yearsMatch = jobText.match(/(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp)/i);
        if (!yearsMatch) return 70; // No requirement stated, neutral

        const requiredYears = parseInt(yearsMatch[1]);

        if (userYears >= requiredYears) return 100;
        if (userYears >= requiredYears - 1) return 80;
        if (userYears >= requiredYears - 2) return 60;
        return 30;
    },

    // Score based on must-have keywords
    scoreKeywords(jobData, profile) {
        const jobText = (jobData.title + ' ' + jobData.description).toLowerCase();
        const mustHave = (profile.preferences?.mustHaveKeywords || []).map(k => k.toLowerCase());

        if (mustHave.length === 0) return 70; // Neutral

        let matched = 0;
        for (const keyword of mustHave) {
            if (jobText.includes(keyword)) matched++;
        }

        return Math.round((matched / mustHave.length) * 100);
    },

    // Score based on salary match
    scoreSalary(jobData, profile) {
        const salaryMin = profile.preferences?.salaryMin || 0;
        const salaryMax = profile.preferences?.salaryMax || 0;

        if (!salaryMin && !salaryMax) return 70; // Neutral
        if (!jobData.salary) return 60; // Can't evaluate

        const jobSalaryText = jobData.salary.toString().replace(/[,$]/g, '');
        const numbers = jobSalaryText.match(/\d+/g);

        if (!numbers || numbers.length === 0) return 60;

        const jobSalary = parseInt(numbers[numbers.length > 1 ? 1 : 0]); // Use higher end

        if (salaryMin && jobSalary >= salaryMin) return 100;
        if (salaryMin && jobSalary >= salaryMin * 0.9) return 70;
        return 40;
    },

    // Check for excluded keywords (deal-breaker)
    hasExcludedKeywords(jobData, profile) {
        const jobText = (jobData.title + ' ' + jobData.description).toLowerCase();
        const excluded = (profile.preferences?.excludeKeywords || []).map(k => k.toLowerCase());

        for (const keyword of excluded) {
            if (jobText.includes(keyword)) return true;
        }
        return false;
    },

    // Get matched skills list
    getMatchedSkills(jobData, profile) {
        const jobText = (jobData.title + ' ' + jobData.description + ' ' + (jobData.requirements || '')).toLowerCase();
        return (profile.skills || []).filter(skill => {
            const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
            return regex.test(jobText);
        });
    },

    // Get skills in job but not in profile
    getMissingSkills(jobData, profile) {
        const jobText = (jobData.title + ' ' + jobData.description + ' ' + (jobData.requirements || '')).toLowerCase();
        const userSkills = (profile.skills || []).map(s => s.toLowerCase());

        const jobSkills = CVParser.extractSkills(jobText);
        return jobSkills.filter(skill => !userSkills.includes(skill.toLowerCase()));
    },

    // Get human-readable match level
    getMatchLevel(score) {
        if (score >= 85) return { label: 'Excellent Match', emoji: '🔥', color: '#10B981' };
        if (score >= 70) return { label: 'Great Match', emoji: '⭐', color: '#6366F1' };
        if (score >= 55) return { label: 'Good Match', emoji: '👍', color: '#3B82F6' };
        if (score >= 40) return { label: 'Fair Match', emoji: '🤔', color: '#F59E0B' };
        return { label: 'Low Match', emoji: '😐', color: '#EF4444' };
    },

    // Extract job data from a DOM element (job card on job sites)
    extractJobFromElement(element, site) {
        const extractors = {
            linkedin: this.extractLinkedInJob,
            indeed: this.extractIndeedJob,
            glassdoor: this.extractGlassdoorJob,
            default: this.extractGenericJob
        };

        const extractor = extractors[site] || extractors.default;
        return extractor.call(this, element);
    },

    // LinkedIn job extractor
    extractLinkedInJob(element) {
        return {
            id: 'li-' + (element.getAttribute('data-job-id') || element.getAttribute('data-occludable-job-id') || Date.now()),
            title: (element.querySelector('.job-card-list__title, .job-card-container__link, a.job-card-list__title--link') || {}).textContent?.trim() || '',
            company: (element.querySelector('.job-card-container__primary-description, .job-card-container__company-name, .artdeco-entity-lockup__subtitle') || {}).textContent?.trim() || '',
            location: (element.querySelector('.job-card-container__metadata-item, .artdeco-entity-lockup__caption') || {}).textContent?.trim() || '',
            description: (element.querySelector('.job-card-list__description, .job-card-container__description') || {}).textContent?.trim() || '',
            url: (element.querySelector('a[href*="/jobs/"]') || {}).href || '',
            source: 'linkedin'
        };
    },

    // Indeed job extractor
    extractIndeedJob(element) {
        return {
            id: 'in-' + (element.getAttribute('data-jk') || element.id || Date.now()),
            title: (element.querySelector('.jobTitle, h2.jobTitle a, [data-testid="jobTitle"]') || {}).textContent?.trim() || '',
            company: (element.querySelector('.companyName, [data-testid="company-name"]') || {}).textContent?.trim() || '',
            location: (element.querySelector('.companyLocation, [data-testid="text-location"]') || {}).textContent?.trim() || '',
            description: (element.querySelector('.job-snippet, .jobCardShelfContainer') || {}).textContent?.trim() || '',
            salary: (element.querySelector('.salary-snippet-container, .estimatedSalary, [data-testid="attribute_snippet_testid"]') || {}).textContent?.trim() || '',
            url: (element.querySelector('a[href*="/viewjob"], a[data-jk], h2 a') || {}).href || '',
            source: 'indeed'
        };
    },

    // Glassdoor job extractor
    extractGlassdoorJob(element) {
        return {
            id: 'gd-' + (element.getAttribute('data-id') || Date.now()),
            title: (element.querySelector('[data-test="job-title"], .jobTitle') || {}).textContent?.trim() || '',
            company: (element.querySelector('[data-test="emp-name"], .jobEmpolyerName') || {}).textContent?.trim() || '',
            location: (element.querySelector('[data-test="emp-location"], .loc') || {}).textContent?.trim() || '',
            description: (element.querySelector('.jobDescriptionContent, .desc') || {}).textContent?.trim() || '',
            salary: (element.querySelector('[data-test="detailSalary"], .salaryEstimate') || {}).textContent?.trim() || '',
            url: (element.querySelector('a[href*="/job-listing/"]') || {}).href || '',
            source: 'glassdoor'
        };
    },

    // Generic job extractor
    extractGenericJob(element) {
        return {
            id: 'gen-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            title: element.querySelector('h2, h3, [class*="title"]')?.textContent?.trim() || '',
            company: element.querySelector('[class*="company"], [class*="employer"]')?.textContent?.trim() || '',
            location: element.querySelector('[class*="location"]')?.textContent?.trim() || '',
            description: element.textContent?.substring(0, 500) || '',
            url: element.querySelector('a')?.href || '',
            source: 'other'
        };
    },

    // Detect which job site we're on
    detectSite() {
        const hostname = window.location.hostname;
        if (hostname.includes('linkedin.com')) return 'linkedin';
        if (hostname.includes('indeed.com')) return 'indeed';
        if (hostname.includes('glassdoor.com')) return 'glassdoor';
        if (hostname.includes('monster.com')) return 'monster';
        if (hostname.includes('ziprecruiter.com')) return 'ziprecruiter';
        return 'other';
    }
};

if (typeof window !== 'undefined') {
    window.JobMatcher = JobMatcher;
}
