// ============================================
// JobMatch AI — Engine-side Job Filtering
// Pure helpers: salary parsing + lightweight relevance scoring.
//
// Search-result cards only expose title/company/location/salary, so this is
// intentionally a subset of the extension's full JobMatcher (which needs the
// job description). It exists to gate the auto-apply queue on salary + fit.
// ============================================

// Parse a salary string into an approximate annual { min, max } in dollars.
// Handles "$120,000", "120k", "$60-80k", "$45/hr", "£90,000 a year".
// Returns null when no usable figure is found.
function parseSalary(text) {
    if (!text) return null;
    const cleaned = String(text).toLowerCase().replace(/,/g, '');
    const hourly = /(per hour|\/\s*hr|\/\s*hour|an hour|hourly)/.test(cleaned);

    const nums = [];
    const re = /(\d+(?:\.\d+)?)\s*(k)?/g;
    let m;
    while ((m = re.exec(cleaned)) !== null) {
        let n = parseFloat(m[1]);
        if (!n) continue;
        if (m[2]) n *= 1000;   // "80k" -> 80000
        if (hourly) n *= 2080; // ~40h/week * 52 weeks
        nums.push(n);
    }

    // Keep only figures that look like real annual salaries.
    const annual = nums.filter(n => n >= 1000);
    if (annual.length === 0) return null;
    return { min: Math.min(...annual), max: Math.max(...annual) };
}

// Lightweight 0-100 relevance score from the fields a search card exposes.
function scoreRelevance(job, profile, settings = {}) {
    const prefs = (profile && profile.preferences) || {};
    const jobTitle = (job.title || '').toLowerCase();

    const titles = [];
    if (settings.query) titles.push(settings.query);
    (prefs.desiredTitles || []).forEach(t => titles.push(t));
    if (profile && profile.title) titles.push(profile.title);

    let titleScore = 50; // neutral when there's nothing to compare against
    if (titles.length && jobTitle) {
        let best = 0;
        for (const t of titles) {
            const words = t.toLowerCase().split(/\s+/).filter(w => w.length > 2);
            if (!words.length) continue;
            const hits = words.filter(w => jobTitle.includes(w)).length;
            best = Math.max(best, hits / words.length);
        }
        titleScore = Math.round(best * 100);
    }

    const jobLoc = (job.location || '').toLowerCase();
    const desiredLocs = (prefs.desiredLocations || []).map(l => l.toLowerCase());
    const isRemote = /remote|work from home|wfh|anywhere/.test(jobLoc);
    let locScore = 70;
    if (prefs.remoteOnly) locScore = isRemote ? 100 : 30;
    else if (isRemote) locScore = 90;
    else if (desiredLocs.length && jobLoc) {
        locScore = desiredLocs.some(l => jobLoc.includes(l) || l.includes(jobLoc)) ? 100 : 40;
    }

    return Math.round(titleScore * 0.7 + locScore * 0.3);
}

// Decide whether a job should be applied to. Returns { ok, reason, score }.
function passesFilters(job, profile, settings = {}) {
    const prefs = (profile && profile.preferences) || {};
    const haystack = `${job.title || ''} ${job.company || ''}`.toLowerCase();

    const exclude = (prefs.excludeKeywords || []).map(k => k.toLowerCase()).filter(Boolean);
    for (const kw of exclude) {
        if (haystack.includes(kw)) return { ok: false, reason: 'excluded_keyword', score: 0 };
    }

    const salaryMin = settings.salaryMin || prefs.salaryMin || 0;
    if (salaryMin > 0 && job.salary) {
        const parsed = parseSalary(job.salary);
        // Only reject when we parsed a real figure AND its top end is below the floor.
        // Unknown/unparseable salaries are kept (don't over-filter).
        if (parsed && parsed.max < salaryMin) {
            return { ok: false, reason: 'salary_below_min', score: 0 };
        }
    }

    const score = scoreRelevance(job, profile, settings);
    const minScore = settings.minMatchScore || 0;
    if (minScore > 0 && score < minScore) {
        return { ok: false, reason: 'low_match', score };
    }

    return { ok: true, reason: 'ok', score };
}

module.exports = { parseSalary, scoreRelevance, passesFilters };
