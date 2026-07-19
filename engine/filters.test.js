// ============================================
// Unit tests for engine/filters.js
// Run with:  node --test   (from the engine/ directory)
// Uses Node's built-in test runner — no dependencies.
// ============================================

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseSalary, scoreRelevance, passesFilters } = require('./filters');

// ── parseSalary ──────────────────────────────
test('parseSalary: annual range with currency and commas', () => {
    assert.deepEqual(parseSalary('€95,000 - €120,000 a year'), { min: 95000, max: 120000 });
});

test('parseSalary: "k" shorthand', () => {
    assert.deepEqual(parseSalary('$60k'), { min: 60000, max: 60000 });
    assert.deepEqual(parseSalary('$80k–$100k'), { min: 80000, max: 100000 });
});

test('parseSalary: hourly is annualized (~2080h)', () => {
    assert.deepEqual(parseSalary('$45/hr'), { min: 93600, max: 93600 });
});

test('parseSalary: plain annual number', () => {
    assert.deepEqual(parseSalary('120000'), { min: 120000, max: 120000 });
});

test('parseSalary: ignores non-salary noise and empties', () => {
    assert.equal(parseSalary('3+ years experience'), null);
    assert.equal(parseSalary(''), null);
    assert.equal(parseSalary(null), null);
    assert.equal(parseSalary(undefined), null);
});

// ── scoreRelevance ───────────────────────────
test('scoreRelevance: exact title + desired location scores high', () => {
    const profile = { preferences: { desiredLocations: ['Berlin'] } };
    const job = { title: 'Senior Frontend Engineer', location: 'Berlin, Germany' };
    const s = scoreRelevance(job, profile, { query: 'Senior Frontend Engineer' });
    assert.ok(s >= 90, `expected >=90, got ${s}`);
});

test('scoreRelevance: unrelated title scores low', () => {
    const profile = { preferences: {} };
    const job = { title: 'Warehouse Forklift Operator', location: 'Berlin' };
    const s = scoreRelevance(job, profile, { query: 'Senior Frontend Engineer' });
    assert.ok(s < 50, `expected <50, got ${s}`);
});

test('scoreRelevance: remoteOnly rewards remote and penalizes on-site', () => {
    const remoteProfile = { preferences: { remoteOnly: true } };
    const remote = scoreRelevance({ title: 'x', location: 'Remote' }, remoteProfile, { query: 'x' });
    const onsite = scoreRelevance({ title: 'x', location: 'Munich' }, remoteProfile, { query: 'x' });
    assert.ok(remote > onsite, `remote ${remote} should beat onsite ${onsite}`);
});

// ── passesFilters ────────────────────────────
const baseProfile = {
    title: 'Senior Frontend Engineer',
    preferences: {
        desiredTitles: ['Senior Frontend Engineer'],
        desiredLocations: ['Berlin'],
        salaryMin: 90000,
        excludeKeywords: ['junior'],
        remoteOnly: false,
    },
};
const baseSettings = { query: 'Senior Frontend Engineer', salaryMin: 90000, minMatchScore: 50 };

test('passesFilters: good salary + good fit passes', () => {
    const v = passesFilters(
        { title: 'Senior Frontend Engineer', company: 'Acme', location: 'Berlin', salary: '€95,000 - €120,000 a year' },
        baseProfile, baseSettings,
    );
    assert.equal(v.ok, true);
    assert.equal(v.reason, 'ok');
});

test('passesFilters: salary below floor is rejected', () => {
    const v = passesFilters(
        { title: 'Senior Frontend Engineer', company: 'LowPay', location: 'Berlin', salary: '$60k' },
        baseProfile, baseSettings,
    );
    assert.equal(v.ok, false);
    assert.equal(v.reason, 'salary_below_min');
});

test('passesFilters: excluded keyword is rejected', () => {
    const v = passesFilters(
        { title: 'Junior Frontend Developer', company: 'Acme', location: 'Berlin', salary: '' },
        baseProfile, baseSettings,
    );
    assert.equal(v.ok, false);
    assert.equal(v.reason, 'excluded_keyword');
});

test('passesFilters: low match is rejected when minMatchScore set', () => {
    const v = passesFilters(
        { title: 'Backend Cobol Specialist', company: 'Old', location: 'Remote', salary: '' },
        baseProfile, baseSettings,
    );
    assert.equal(v.ok, false);
    assert.equal(v.reason, 'low_match');
});

test('passesFilters: unknown/unparseable salary is NOT over-filtered', () => {
    const v = passesFilters(
        { title: 'Senior Frontend Engineer', company: 'NoPayInfo', location: 'Berlin', salary: '' },
        baseProfile, baseSettings,
    );
    assert.equal(v.ok, true);
});

test('passesFilters: no thresholds set — everything relevant passes', () => {
    const v = passesFilters(
        { title: 'Anything At All', company: 'X', location: '', salary: '$1/hr' },
        { preferences: {} }, {},
    );
    assert.equal(v.ok, true);
});
