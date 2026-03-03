// ============================================
// JobMatch AI — Smart Auto-Fill Engine
// Detects application forms and fills from profile
// ============================================

const AutoFiller = {
    profile: null,
    filledFields: [],
    panel: null,

    // Field mapping: what profile data maps to what form labels
    FIELD_MAP: {
        name: {
            labels: ['full name', 'name', 'your name', 'first name', 'candidate name', 'applicant name', 'nome completo', 'nom complet'],
            value: (p) => p.name || ''
        },
        firstName: {
            labels: ['first name', 'given name', 'prénom', 'nome'],
            value: (p) => (p.name || '').split(' ')[0]
        },
        lastName: {
            labels: ['last name', 'surname', 'family name', 'nom de famille', 'cognome'],
            value: (p) => (p.name || '').split(' ').slice(1).join(' ')
        },
        email: {
            labels: ['email', 'e-mail', 'email address', 'your email'],
            value: (p) => p.email || (p.contact ? p.contact.email : '')
        },
        phone: {
            labels: ['phone', 'telephone', 'phone number', 'mobile', 'cell', 'contact number', 'téléphone', 'telefono'],
            value: (p) => p.phone || (p.contact ? p.contact.phone : '')
        },
        location: {
            labels: ['location', 'city', 'address', 'current location', 'where are you based', 'città', 'ville'],
            value: (p) => p.location || ''
        },
        title: {
            labels: ['current title', 'job title', 'current position', 'headline', 'current role', 'position'],
            value: (p) => p.title || ''
        },
        summary: {
            labels: ['summary', 'cover letter', 'about you', 'tell us about yourself', 'why are you interested', 'motivation', 'additional information', 'message', 'note to hiring manager'],
            value: (p) => p.summary || ''
        },
        linkedin: {
            labels: ['linkedin', 'linkedin url', 'linkedin profile', 'linkedin link'],
            value: (p) => p.linkedin || ''
        },
        website: {
            labels: ['website', 'portfolio', 'personal website', 'portfolio url', 'github', 'personal url'],
            value: (p) => p.website || ''
        },
        company: {
            labels: ['current company', 'current employer', 'employer', 'company name'],
            value: (p) => {
                if (p.experience && p.experience.length > 0) return p.experience[0].company || '';
                return '';
            }
        },
        yearsExp: {
            labels: ['years of experience', 'total experience', 'experience years', 'how many years'],
            value: (p) => {
                if (p.experience && p.experience.length > 0) {
                    const first = p.experience[p.experience.length - 1];
                    const match = first.dateRange ? first.dateRange.match(/\d{4}/) : null;
                    if (match) return String(new Date().getFullYear() - parseInt(match[0]));
                }
                return '';
            }
        }
    },

    // Auto-fill types for HTML input attributes
    AUTOCOMPLETE_MAP: {
        'name': 'name',
        'given-name': 'firstName',
        'family-name': 'lastName',
        'email': 'email',
        'tel': 'phone',
        'address-level2': 'location',
        'organization': 'company',
        'url': 'website',
    },

    // Initialize with profile data
    async init() {
        try {
            this.profile = await StorageManager.getProfile();
        } catch (e) {
            console.log('[AutoFill] Could not load profile:', e);
        }
    },

    // Main: Find and fill all form fields on the page
    async fillPage() {
        if (!this.profile) await this.init();
        if (!this.profile || !this.profile.name) {
            this.showNotification('⚠️ Please set up your profile first (upload CV in the extension popup)', 'warning');
            return { filled: 0, fields: [] };
        }

        this.filledFields = [];

        // Strategy 1: Fill by autocomplete attribute
        this.fillByAutocomplete();
        // Strategy 2: Fill by label text
        this.fillByLabels();
        // Strategy 3: Fill by input name/id/placeholder
        this.fillByAttributes();
        // Strategy 4: Site-specific fillers
        const site = this.detectSite();
        if (site === 'linkedin') this.fillLinkedIn();
        else if (site === 'indeed') this.fillIndeed();
        else if (site === 'glassdoor') this.fillGlassdoor();

        // Show results panel
        this.showResultsPanel();
        return { filled: this.filledFields.length, fields: this.filledFields };
    },

    // ── Strategy 1: autocomplete attribute ──
    fillByAutocomplete() {
        for (const [autoVal, fieldKey] of Object.entries(this.AUTOCOMPLETE_MAP)) {
            const inputs = document.querySelectorAll(`input[autocomplete="${autoVal}"], input[autocomplete="${autoVal.replace('-', '')}"]`);
            inputs.forEach(input => {
                if (this.shouldFill(input)) {
                    const mapping = this.FIELD_MAP[fieldKey];
                    if (mapping) {
                        const val = mapping.value(this.profile);
                        if (val) this.fillInput(input, val, fieldKey);
                    }
                }
            });
        }
    },

    // ── Strategy 2: Match by label text ──
    fillByLabels() {
        const labels = document.querySelectorAll('label');
        labels.forEach(label => {
            const labelText = (label.textContent || '').toLowerCase().trim();
            const input = this.findInputForLabel(label);
            if (!input || !this.shouldFill(input)) return;

            for (const [fieldKey, mapping] of Object.entries(this.FIELD_MAP)) {
                const matched = mapping.labels.some(lbl => {
                    return labelText.includes(lbl) || labelText.replace(/[*:]/g, '').trim() === lbl;
                });
                if (matched) {
                    const val = mapping.value(this.profile);
                    if (val) { this.fillInput(input, val, fieldKey); break; }
                }
            }
        });
    },

    // ── Strategy 3: Match by name/id/placeholder ──
    fillByAttributes() {
        const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea, select');
        inputs.forEach(input => {
            if (!this.shouldFill(input)) return;
            const attrs = [input.name || '', input.id || '', input.placeholder || '', input.getAttribute('aria-label') || ''].join(' ').toLowerCase();
            for (const [fieldKey, mapping] of Object.entries(this.FIELD_MAP)) {
                const matched = mapping.labels.some(lbl => attrs.includes(lbl.replace(/\s+/g, '')));
                if (matched || attrs.includes(fieldKey)) {
                    const val = mapping.value(this.profile);
                    if (val) { this.fillInput(input, val, fieldKey); break; }
                }
            }
        });
    },

    // ── LinkedIn Easy Apply ──
    fillLinkedIn() {
        const modal = document.querySelector('.jobs-easy-apply-modal, .artdeco-modal');
        if (!modal) return;
        modal.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], textarea').forEach(input => {
            if (!this.shouldFill(input)) return;
            const label = this.findNearestLabel(input);
            if (!label) return;
            const labelText = label.toLowerCase();
            for (const [fieldKey, mapping] of Object.entries(this.FIELD_MAP)) {
                if (mapping.labels.some(lbl => labelText.includes(lbl))) {
                    const val = mapping.value(this.profile);
                    if (val) this.fillInput(input, val, fieldKey);
                    break;
                }
            }
        });
    },

    // ── Indeed Apply ──
    fillIndeed() {
        const form = document.querySelector('#ia-container, .ia-ApplicationPage, form[action*="apply"]');
        if (!form) return;
        form.querySelectorAll('input, textarea, select').forEach(input => {
            if (!this.shouldFill(input)) return;
            const label = this.findNearestLabel(input);
            const attrs = [input.name || '', input.id || '', label || ''].join(' ').toLowerCase();
            if (attrs.includes('name') || attrs.includes('applicant')) this.fillInput(input, this.profile.name, 'name');
            else if (attrs.includes('email')) this.fillInput(input, this.profile.email || '', 'email');
            else if (attrs.includes('phone') || attrs.includes('tel')) this.fillInput(input, this.profile.phone || '', 'phone');
            else if (attrs.includes('city') || attrs.includes('location')) this.fillInput(input, this.profile.location || '', 'location');
        });
    },

    // ── Glassdoor Apply ──
    fillGlassdoor() {
        const form = document.querySelector('.applicationForm, form[data-test="applicationForm"]');
        if (!form) return;
        form.querySelectorAll('input, textarea').forEach(input => {
            if (!this.shouldFill(input)) return;
            const label = this.findNearestLabel(input);
            const attrs = [input.name || '', input.id || '', label || ''].join(' ').toLowerCase();
            for (const [fieldKey, mapping] of Object.entries(this.FIELD_MAP)) {
                if (mapping.labels.some(lbl => attrs.includes(lbl.replace(/\s+/g, '')))) {
                    const val = mapping.value(this.profile);
                    if (val) this.fillInput(input, val, fieldKey);
                    break;
                }
            }
        });
    },

    // ── Utility: fill a single input ──
    fillInput(input, value, fieldKey) {
        if (!value || !input) return;
        if (input.dataset.jmFilled) return;
        const oldValue = input.value;

        if (input.tagName === 'SELECT') {
            this.selectBestOption(input, value);
        } else {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
                || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
            if (nativeInputValueSetter) nativeInputValueSetter.call(input, value);
            else input.value = value;

            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new Event('blur', { bubbles: true }));
        }

        input.dataset.jmFilled = 'true';
        input.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.5)';
        input.style.transition = 'box-shadow 0.3s ease';

        this.filledFields.push({ element: input, fieldKey, newValue: value, oldValue, label: this.findNearestLabel(input) || fieldKey });
    },

    selectBestOption(select, value) {
        if (!value) return;
        const valueLow = value.toLowerCase();
        let bestMatch = null, bestScore = 0;
        Array.from(select.options).forEach(opt => {
            const optText = (opt.text || opt.value || '').toLowerCase();
            if (optText === valueLow) { bestMatch = opt; bestScore = 100; }
            else if ((optText.includes(valueLow) || valueLow.includes(optText)) && optText.length > 0) {
                if (50 > bestScore) { bestMatch = opt; bestScore = 50; }
            }
        });
        if (bestMatch) { select.value = bestMatch.value; select.dispatchEvent(new Event('change', { bubbles: true })); }
    },

    shouldFill(input) {
        if (!input) return false;
        if (input.dataset.jmFilled) return false;
        if (['hidden', 'submit', 'button', 'file', 'checkbox', 'radio'].includes(input.type)) return false;
        if (input.disabled || input.readOnly) return false;
        if (input.value && input.value.trim().length > 0) return false;
        const rect = input.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return false;
        return true;
    },

    findInputForLabel(label) {
        if (label.htmlFor) return document.getElementById(label.htmlFor);
        const nested = label.querySelector('input, textarea, select');
        if (nested) return nested;
        const sibling = label.nextElementSibling;
        if (sibling && ['INPUT', 'TEXTAREA', 'SELECT'].includes(sibling.tagName)) return sibling;
        const parent = label.parentElement;
        if (parent) return parent.querySelector('input, textarea, select');
        return null;
    },

    findNearestLabel(input) {
        if (input.id) { const label = document.querySelector(`label[for="${input.id}"]`); if (label) return label.textContent.trim(); }
        const parentLabel = input.closest('label');
        if (parentLabel) return parentLabel.textContent.trim();
        if (input.getAttribute('aria-label')) return input.getAttribute('aria-label');
        if (input.placeholder) return input.placeholder;
        const prev = input.previousElementSibling;
        if (prev && prev.tagName === 'LABEL') return prev.textContent.trim();
        const parent = input.closest('.form-group, .field, .input-group, [class*="field"], [class*="form"]');
        if (parent) { const lbl = parent.querySelector('label, .label, [class*="label"]'); if (lbl) return lbl.textContent.trim(); }
        return input.name || input.id || '';
    },

    detectSite() {
        const host = window.location.hostname;
        if (host.includes('linkedin.com')) return 'linkedin';
        if (host.includes('indeed.com')) return 'indeed';
        if (host.includes('glassdoor.com')) return 'glassdoor';
        if (host.includes('monster.com')) return 'monster';
        if (host.includes('ziprecruiter.com')) return 'ziprecruiter';
        return 'generic';
    },

    showResultsPanel() {
        if (this.panel) this.panel.remove();
        const panel = document.createElement('div');
        panel.id = 'jm-autofill-panel';
        panel.innerHTML = `
            <div class="jm-af-header">
                <div class="jm-af-logo">
                    <svg width="20" height="20" viewBox="0 0 28 28" fill="none"><rect width="28" height="28" rx="8" fill="url(#jmgrad)"/><path d="M8 11h12v2H8zm0 4h8v2H8zm4-8h4v2h-4z" fill="white" opacity="0.9"/><defs><linearGradient id="jmgrad" x1="0" y1="0" x2="28" y2="28"><stop stop-color="#6366F1"/><stop offset="1" stop-color="#8B5CF6"/></linearGradient></defs></svg>
                    <span>JobMatch AI</span>
                </div>
                <button class="jm-af-close" id="jmAfClose">&times;</button>
            </div>
            <div class="jm-af-body">
                ${this.filledFields.length > 0 ? `
                    <div class="jm-af-status jm-af-success"><span class="jm-af-status-icon">✅</span><span><strong>${this.filledFields.length}</strong> field${this.filledFields.length > 1 ? 's' : ''} auto-filled</span></div>
                    <div class="jm-af-fields">${this.filledFields.map((f, i) => `<div class="jm-af-field"><span class="jm-af-field-label">${this.escapeHtml(f.label)}</span><span class="jm-af-field-value">${this.escapeHtml(f.newValue.substring(0, 40))}${f.newValue.length > 40 ? '...' : ''}</span><button class="jm-af-undo" data-idx="${i}" title="Undo">↩</button></div>`).join('')}</div>
                    <div class="jm-af-hint">⚡ Review the filled fields, then submit your application!</div>
                ` : `
                    <div class="jm-af-status jm-af-empty"><span class="jm-af-status-icon">🔍</span><span>No fillable fields found on this page</span></div>
                    <div class="jm-af-hint">Try clicking "Apply" first to open the application form, then use Auto-Fill again.</div>
                `}
            </div>`;
        document.body.appendChild(panel);
        this.panel = panel;

        panel.querySelector('#jmAfClose').addEventListener('click', () => { panel.classList.add('jm-af-closing'); setTimeout(() => panel.remove(), 300); });
        panel.querySelectorAll('.jm-af-undo').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                const field = this.filledFields[idx];
                if (field && field.element) {
                    field.element.value = field.oldValue;
                    field.element.style.boxShadow = '';
                    delete field.element.dataset.jmFilled;
                    field.element.dispatchEvent(new Event('input', { bubbles: true }));
                    field.element.dispatchEvent(new Event('change', { bubbles: true }));
                    e.target.parentElement.style.opacity = '0.4';
                    e.target.textContent = '✓';
                }
            });
        });
        setTimeout(() => { if (panel.parentElement) { panel.classList.add('jm-af-closing'); setTimeout(() => panel.remove(), 300); } }, 15000);
    },

    showNotification(msg, type = 'info') {
        const notif = document.createElement('div');
        notif.className = `jm-af-notif jm-af-notif-${type}`;
        notif.textContent = msg;
        document.body.appendChild(notif);
        setTimeout(() => { notif.classList.add('jm-af-notif-out'); setTimeout(() => notif.remove(), 300); }, 4000);
    },

    undoAll() {
        this.filledFields.forEach(f => {
            if (f.element) {
                f.element.value = f.oldValue;
                f.element.style.boxShadow = '';
                delete f.element.dataset.jmFilled;
                f.element.dispatchEvent(new Event('input', { bubbles: true }));
                f.element.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        this.filledFields = [];
        if (this.panel) this.panel.remove();
    },

    escapeHtml(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }
};

if (typeof window !== 'undefined') { window.AutoFiller = AutoFiller; }
