// ============================================
// JobMatch AI — Web Dashboard Controller
// Standalone web version with localStorage
// ============================================

document.addEventListener('DOMContentLoaded', () => {

    // ── State ────────────────────────────────
    let profile = JSON.parse(localStorage.getItem('jm_profile') || '{}');
    if (!profile.skills) profile.skills = [];
    if (!profile.experience) profile.experience = [];
    if (!profile.education) profile.education = [];
    if (!profile.languages) profile.languages = [];

    // ── Panel Navigation ─────────────────────
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    const panels = document.querySelectorAll('.panel');

    window.switchPanel = function (name) {
        sidebarLinks.forEach(l => l.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        const link = document.querySelector(`[data-panel="${name}"]`);
        const panel = document.getElementById(`panel-${name}`);
        if (link) link.classList.add('active');
        if (panel) panel.classList.add('active');
    };

    sidebarLinks.forEach(link => {
        link.addEventListener('click', () => switchPanel(link.dataset.panel));
    });

    // ── CV Parser (self-contained, v2) ────────
    const CVParser = {
        parse(text) {
            if (!text || typeof text !== 'string') return null;
            text = text.trim();
            const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            return {
                name: this.extractName(lines),
                title: this.extractTitle(lines, text),
                location: this.extractLocation(text, lines),
                skills: this.extractSkills(text),
                experience: this.extractExperience(lines),
                education: this.extractEducation(lines),
                contact: this.extractContact(text),
                summary: this.extractSummary(lines),
                languages: this.extractLanguages(text, lines),
                linkedin: this.extractLinkedIn(text),
                website: this.extractWebsite(text),
                certifications: this.extractCertifications(lines),
                rawText: text
            };
        },
        // ─ Name ─
        extractName(lines) {
            for (let i = 0; i < Math.min(5, lines.length); i++) {
                const l = lines[i];
                if (l.match(/@|http|www\.|skills|experience|education|summary|objective|phone|address|technical|expertise|professional/i)) continue;
                if (l.match(/^\+?\d[\d\s\-().]{7,}$/)) continue;
                if (l.match(/^(email|phone|linkedin|portfolio|website|personal)/i)) continue;
                const words = l.split(/\s+/);
                if (words.length >= 2 && words.length <= 5 && words.every(w => /^[A-Z][a-zA-Z'.()-]*$/.test(w))) return l;
            }
            return null;
        },
        // ─ Title ─
        extractTitle(lines, text) {
            const titleKw = ['engineer', 'developer', 'designer', 'manager', 'analyst', 'architect', 'consultant', 'director', 'specialist', 'coordinator', 'administrator', 'lead', 'scientist', 'researcher', 'intern', 'associate', 'executive', 'officer', 'president', 'founder', 'head of', 'data engineer', 'devops', 'full stack', 'frontend', 'backend'];
            for (let i = 0; i < Math.min(8, lines.length); i++) {
                const low = lines[i].toLowerCase();
                if (low.match(/^(experience|education|skills|summary|technical|professional\s+summary|work|expertise|contact|email|phone|linkedin|portfolio)/i)) continue;
                for (const t of titleKw) {
                    if (low.includes(t) && lines[i].length < 60) return lines[i];
                }
            }
            const tm = text.match(/(?:title|position|role)\s*[:\-–]\s*(.+)/i);
            return tm ? tm[1].trim() : null;
        },
        // ─ Location ─ (fixed: skip tech terms, look for cities/countries)
        extractLocation(text, lines) {
            // Known countries/regions for validation
            const countries = ['usa', 'us', 'uk', 'canada', 'australia', 'germany', 'france', 'italy', 'spain', 'netherlands', 'switzerland', 'sweden', 'norway', 'denmark', 'india', 'japan', 'china', 'brazil', 'mexico', 'portugal', 'ireland', 'belgium', 'austria', 'poland', 'czech', 'romania', 'hungary', 'ukraine', 'russia', 'turkey', 'israel', 'uae', 'saudi arabia', 'singapore', 'south korea', 'new zealand', 'argentina', 'chile', 'colombia', 'egypt', 'south africa', 'nigeria', 'kenya', 'morocco', 'algeria', 'tunisia', 'ghana'];
            const techTerms = ['git', 'vs', 'code', 'docker', 'aws', 'linux', 'python', 'javascript', 'node', 'react', 'angular', 'vue', 'sql', 'html', 'css', 'postman', 'jenkins', 'terraform', 'kubernetes', 'vscode', 'vs code', 'bash', 'c\\+\\+', 'mongodb', 'redis'];
            // Try explicit label first
            const labelMatch = text.match(/(?:location|address|city|based in)\s*[:\-–]\s*(.+)/i);
            if (labelMatch) return labelMatch[1].trim().split('\n')[0];
            // Try University location (e.g., "University of Pavia, Italy")
            const uniMatch = text.match(/university\s+of\s+[\w\s]+,\s*([A-Z][a-zA-Z]+)/i);
            if (uniMatch) {
                const country = uniMatch[1].toLowerCase();
                if (countries.includes(country)) return uniMatch[0].split(',').pop().trim();
            }
            // Try "City, State/Country" pattern in first 10 lines only, but skip tech terms
            for (let i = 0; i < Math.min(10, lines.length); i++) {
                const l = lines[i];
                if (l.match(/tools|os|programming|languages|database|cloud|technical|expertise/i)) continue;
                const m = l.match(/([A-Z][a-zA-Z\s]+,\s*[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/);
                if (m) {
                    const loc = m[1];
                    const locLow = loc.toLowerCase();
                    const isTech = techTerms.some(t => new RegExp('\\b' + t + '\\b', 'i').test(locLow));
                    if (!isTech) return loc;
                }
            }
            // Try to find country mentions tied to universities or addresses
            const countryMatch = text.match(/,\s*(Italy|Germany|France|UK|USA|Canada|Australia|Netherlands|Spain|Switzerland|Sweden|India|Japan|Brazil|Ukraine|Ireland|Belgium|Austria|Poland)\b/i);
            if (countryMatch) return countryMatch[0].replace(/^,\s*/, '');
            return null;
        },
        // ─ Skills ─ (expanded DB with 90+ skills)
        extractSkills(text) {
            const skillsDb = [
                'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'C', 'Go', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'R', 'Scala', 'Perl', 'Matlab',
                'React', 'Angular', 'Vue', 'Node.js', 'Express', 'Django', 'Flask', 'Spring', 'Next.js', 'Nuxt', 'Svelte', 'FastAPI',
                'HTML', 'CSS', 'SASS', 'Tailwind', 'Bootstrap',
                'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Firebase', 'SQLite', 'Cassandra', 'DynamoDB', 'Elasticsearch',
                'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'Git', 'Linux', 'REST', 'RESTful APIs', 'GraphQL',
                'CI/CD', 'Agile', 'Scrum', 'Kanban',
                'Figma', 'Photoshop', 'Adobe XD',
                'Machine Learning', 'AI', 'TensorFlow', 'PyTorch', 'Scikit-learn', 'NLP', 'Data Science', 'Deep Learning', 'Computer Vision', 'OpenCV', 'YOLO',
                'DevOps', 'Terraform', 'Jenkins', 'Webpack', 'Vite', 'Ansible', 'Nginx',
                'Raspberry Pi', 'Arduino',
                'Pandas', 'NumPy', 'Matplotlib', 'Jupyter',
                'Postman', 'Swagger',
                'Apache Spark', 'Kafka', 'Airflow', 'Hadoop',
                'Power BI', 'Tableau',
                'Unity', 'Unreal Engine',
                'Heroku', 'Netlify', 'Vercel',
                'OAuth', 'JWT',
                'WebSockets', 'Socket.io',
                'Twilio', 'Stripe',
                'LSTM', 'CNN', 'RNN', 'GAN', 'Transformers', 'BERT', 'GPT'
            ];
            const found = [];
            for (const s of skillsDb) {
                const esc = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                // Special handling for single-letter/short skills like "C" and "R"
                let pattern;
                if (s === 'C') {
                    pattern = /\bC\b(?![\+#\/])/; // Match "C" but not C++, C#, CI/CD
                    if (pattern.test(text) && (text.includes('C/C++') || text.includes('C,') || text.match(/\bC\s+programming/i))) {
                        found.push(s);
                    }
                } else if (s === 'R') {
                    if (/\bR\b/.test(text) && /\bR\s+(programming|studio|language)/i.test(text)) found.push(s);
                } else {
                    pattern = new RegExp(`\\b${esc}\\b`, 'i');
                    if (pattern.test(text)) found.push(s);
                }
            }
            return found;
        },
        // ─ Experience ─ (handles multi-line title/company)
        extractExperience(lines) {
            const entries = []; let sec = false; let cur = null; let prevLine = '';
            const isHeader = l => /^(work\s+)?experience\b/i.test(l);
            const isEndSec = l => /^(education|skills|technical|certif|project|key\s+tech|language|interest|reference|hobbies)/i.test(l);
            const isDate = l => l.match(/(\b\d{4}\b)\s*[-–—to]+\s*(present|\d{4})/i) || l.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4}\s*[-–—to]+\s*(present|\w+\s+\d{4})/i);
            const isBullet = l => /^[•\-\*▪●○◆➤►▸‣]/.test(l) || /^[a-z]/.test(l.charAt(0)) && l.length > 40;

            for (let idx = 0; idx < lines.length; idx++) {
                const l = lines[idx];
                if (isHeader(l)) { sec = true; continue; }
                if (sec && isEndSec(l)) break;
                if (!sec) { prevLine = l; continue; }

                const dm = isDate(l);
                if (dm) {
                    // Date line found — previous line(s) likely have title/company
                    if (cur) entries.push(cur);
                    // Look back for title and company
                    let title = '', company = '';
                    // Check if prevLine has the company, the line before that has the title
                    // Or if the title is on the same line as something
                    const lookback1 = idx > 0 ? lines[idx - 1] : '';
                    const lookback2 = idx > 1 ? lines[idx - 2] : '';
                    if (lookback1 && !isHeader(lookback1) && !isEndSec(lookback1) && !isBullet(lookback1)) {
                        company = lookback1;
                    }
                    if (lookback2 && !isHeader(lookback2) && !isEndSec(lookback2) && !isBullet(lookback2) && lookback2 !== company) {
                        title = lookback2;
                    }
                    // If company looks like a title, swap
                    if (!title && company) { title = company; company = ''; }
                    // Extract date range
                    const dateStr = dm[0] || l;
                    cur = { title: title.trim(), company: company.trim(), dateRange: dateStr.trim(), description: [] };
                } else if (!cur && !dm) {
                    // We haven't found a date yet — this might be a title line
                    // Check if next line has a date
                    const nextLine = idx + 1 < lines.length ? lines[idx + 1] : '';
                    const nextNext = idx + 2 < lines.length ? lines[idx + 2] : '';
                    if (l.includes('—') || l.includes('–') || l.includes(' at ') || l.includes(' @ ')) {
                        if (cur) entries.push(cur);
                        const parts = l.split(/\s*[—–]\s*/);
                        const datePart = isDate(l);
                        cur = { title: parts[0] || '', company: parts[1] || '', dateRange: datePart ? datePart[0] : (parts[2] || ''), description: [] };
                    }
                } else if (cur && isBullet(l)) {
                    cur.description.push(l.replace(/^[•\-\*▪●○◆➤►▸‣]\s*/, ''));
                } else if (cur && l.length > 30 && !isDate(l)) {
                    // Continuation of description without bullet
                    cur.description.push(l);
                }
                prevLine = l;
            }
            if (cur) entries.push(cur);
            // Clean up: remove empty entries
            return entries.filter(e => e.title || e.company || e.description.length > 0);
        },
        // ─ Education ─ (skip "Relevant Coursework" as separate entries)
        extractEducation(lines) {
            const entries = []; let sec = false; let cur = null;
            for (const l of lines) {
                if (/^education\b/i.test(l)) { sec = true; continue; }
                if (sec && /^(experience|work|skills|certif|project|language|interest|reference|key\s+tech)/i.test(l)) break;
                if (!sec) continue;
                // Skip "Relevant Coursework" as a degree entry
                if (/^relevant\s+coursework/i.test(l)) {
                    if (cur) cur.details.push(l);
                    continue;
                }
                if (/bachelor|master|phd|doctor|associate|diploma|degree|b\.?s\.?c|m\.?s\.?c|b\.?a|m\.?a|mba/i.test(l)) {
                    if (cur) entries.push(cur);
                    cur = { degree: l, details: [] };
                } else if (cur) {
                    // Add as details but skip pure date lines
                    cur.details.push(l);
                }
            }
            if (cur) entries.push(cur);
            return entries;
        },
        // ─ Contact ─
        extractContact(text) {
            const email = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
            const phone = text.match(/(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/);
            return { email: email ? email[0] : null, phone: phone ? phone[0] : null };
        },
        // ─ Summary ─ (handles PROFESSIONAL SUMMARY, CAREER SUMMARY, etc)
        extractSummary(lines) {
            let sec = false; const parts = [];
            for (const l of lines) {
                if (/^(professional\s+)?summary\b|^(career\s+)?objective\b|^about(\s+me)?\b|^(professional\s+)?profile\b/i.test(l)) { sec = true; continue; }
                if (sec && /^(experience|education|skills|work|project|certif|technical|expertise)/i.test(l)) break;
                if (sec) parts.push(l);
            }
            return parts.join(' ').trim() || null;
        },
        // ─ Languages ─ (handles "LANGUAGES & CORE COMPETENCIES")
        extractLanguages(text, lines) {
            const langs = ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Chinese', 'Mandarin', 'Japanese', 'Korean', 'Arabic', 'Hindi', 'Russian', 'Dutch', 'Swedish', 'Norwegian', 'Danish', 'Finnish', 'Polish', 'Turkish', 'Hebrew', 'Thai', 'Vietnamese', 'Indonesian', 'Malay', 'Tagalog', 'Swahili', 'Urdu', 'Bengali', 'Punjabi', 'Persian', 'Greek', 'Czech', 'Romanian', 'Hungarian', 'Ukrainian', 'Berber', 'Amazigh'];
            const found = [];
            let sec = false;
            for (const l of lines) {
                if (/^languages?\b/i.test(l)) { sec = true; continue; }
                if (sec && /^(experience|education|skills|certif|project|interest|work|technical)/i.test(l)) break;
                if (sec) { for (const lang of langs) { if (l.toLowerCase().includes(lang.toLowerCase()) && !found.includes(lang)) found.push(lang); } }
            }
            // Fallback: search in labeled lines like "Languages: English, French"
            if (found.length === 0) {
                const langLine = text.match(/languages?\s*[:]\s*(.+)/i);
                if (langLine) {
                    for (const lang of langs) {
                        if (langLine[1].toLowerCase().includes(lang.toLowerCase()) && !found.includes(lang)) found.push(lang);
                    }
                }
            }
            // Final fallback: full text search
            if (found.length === 0) {
                for (const lang of langs) { const r = new RegExp(`\\b${lang}\\b`, 'i'); if (r.test(text) && !found.includes(lang)) found.push(lang); }
            }
            return found;
        },
        // ─ LinkedIn ─
        extractLinkedIn(text) {
            const m = text.match(/linkedin\.com\/in\/[\w-]+\/?/i);
            return m ? m[0] : null;
        },
        // ─ Website ─
        extractWebsite(text) {
            const m = text.match(/(?:portfolio|website|site)\s*[:]\s*(https?:\/\/\S+|[\w.-]+\.\w{2,})/i);
            if (m) return m[1];
            // Try to find any .app, .io, .dev, .com URL that isn't linkedin/github
            const urls = text.match(/[\w-]+\.(?:netlify\.app|vercel\.app|github\.io|herokuapp\.com|[\w]+\.dev)/gi);
            return urls ? urls[0] : null;
        },
        // ─ Certifications ─
        extractCertifications(lines) {
            const certs = []; let sec = false;
            for (const l of lines) {
                if (/^certif/i.test(l)) { sec = true; continue; }
                if (sec && /^(experience|education|skills|project|language|interest|work|technical)/i.test(l)) break;
                if (sec && l.length > 3) {
                    certs.push(l.replace(/^[-•▪*]\s*/, '').trim());
                }
            }
            return certs;
        }
    };

    // ── File Upload ──────────────────────────
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const dropZoneInner = document.getElementById('dropZoneInner');
    const fileInfoBar = document.getElementById('fileInfoBar');
    const processingBar = document.getElementById('processingBar');

    document.getElementById('btnBrowse').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); fileInput.click(); });
    dropZone.addEventListener('click', e => { if (!e.target.closest('.file-remove') && !e.target.closest('.browse-btn') && !dropZone.classList.contains('has-file')) fileInput.click(); });
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('drag-over'); if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); });
    fileInput.addEventListener('change', () => { if (fileInput.files.length) handleFile(fileInput.files[0]); });
    document.getElementById('btnRemoveFile').addEventListener('click', e => {
        e.stopPropagation(); fileInput.value = '';
        dropZone.classList.remove('has-file');
        dropZoneInner.style.display = 'flex'; fileInfoBar.style.display = 'none';
        document.getElementById('cvText').value = '';
    });

    async function handleFile(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (!['pdf', 'docx', 'doc', 'txt', 'rtf'].includes(ext)) { toast('Unsupported file type. Use PDF, DOCX, or TXT.', 'error'); return; }
        if (file.size > 10 * 1024 * 1024) { toast('File too large (max 10MB).', 'error'); return; }

        const icons = { pdf: '📕', docx: '📘', doc: '📘', txt: '📄', rtf: '📄' };
        document.getElementById('fIcon').textContent = icons[ext] || '📄';
        document.getElementById('fName').textContent = file.name;
        document.getElementById('fSize').textContent = (file.size / 1024).toFixed(1) + ' KB';
        dropZone.classList.add('has-file');
        dropZoneInner.style.display = 'none';
        fileInfoBar.style.display = 'flex';
        processingBar.style.display = 'flex';

        try {
            let text = '';
            if (ext === 'pdf') {
                const ab = await file.arrayBuffer();
                // Wait for pdfjsLib to be available (loaded via module script)
                if (!window.pdfjsLib) {
                    await new Promise((resolve) => {
                        const handler = () => resolve();
                        window.addEventListener('pdfjsReady', handler, { once: true });
                        setTimeout(() => { window.removeEventListener('pdfjsReady', handler); resolve(); }, 5000);
                    });
                }
                if (window.pdfjsLib) {
                    try {
                        const pdf = await window.pdfjsLib.getDocument({ data: ab }).promise;
                        const parts = [];
                        for (let i = 1; i <= pdf.numPages; i++) {
                            const page = await pdf.getPage(i);
                            const tc = await page.getTextContent();
                            // Reconstruct lines using Y-position and hasEOL
                            const pageLines = [];
                            let currentLine = '';
                            let lastY = null;
                            for (const item of tc.items) {
                                if (item.str === undefined) continue;
                                const y = item.transform ? item.transform[5] : null;
                                // Detect line break: Y changed significantly or hasEOL flag
                                if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
                                    if (currentLine.trim()) pageLines.push(currentLine.trim());
                                    currentLine = '';
                                }
                                if (item.hasEOL && currentLine.trim()) {
                                    currentLine += item.str;
                                    pageLines.push(currentLine.trim());
                                    currentLine = '';
                                    lastY = y;
                                    continue;
                                }
                                currentLine += item.str;
                                lastY = y;
                            }
                            if (currentLine.trim()) pageLines.push(currentLine.trim());
                            parts.push(pageLines.join('\n'));
                        }
                        text = parts.join('\n\n');
                    } catch (pdfErr) {
                        console.error('PDF.js extraction error:', pdfErr);
                        toast('PDF extraction failed: ' + pdfErr.message + '. Try pasting text.', 'error');
                        processingBar.style.display = 'none';
                        return;
                    }
                } else {
                    toast('PDF library still loading. Please wait a moment and try again, or paste text instead.', 'error');
                    processingBar.style.display = 'none';
                    return;
                }
            } else if (ext === 'docx') {
                const ab = await file.arrayBuffer();
                if (typeof mammoth !== 'undefined') {
                    const r = await mammoth.extractRawText({ arrayBuffer: ab });
                    text = r.value || '';
                } else { text = await file.text(); }
            } else { text = await file.text(); }

            processingBar.style.display = 'none';
            if (text.trim().length > 10) {
                document.getElementById('cvText').value = text;
                toast(`📄 Extracted ${text.length.toLocaleString()} characters from ${file.name}`, 'success');
                parseCV(text);
            } else { toast('Could not extract enough text. Try a different file.', 'error'); }
        } catch (err) {
            processingBar.style.display = 'none';
            toast('Error reading file: ' + err.message, 'error');
        }
    }

    // ── Parse CV ─────────────────────────────
    document.getElementById('btnParse').addEventListener('click', () => {
        const text = document.getElementById('cvText').value;
        if (!text.trim()) { toast('Please upload a file or paste CV text.', 'error'); return; }
        parseCV(text);
    });

    function parseCV(text) {
        const p = CVParser.parse(text);
        if (!p) { toast('Could not parse CV.', 'error'); return; }

        profile.cvText = text;
        if (p.name) profile.name = p.name;
        if (p.title) profile.title = p.title;
        if (p.location) profile.location = p.location;
        if (p.contact.email) profile.email = p.contact.email;
        if (p.contact.phone) profile.phone = p.contact.phone;
        if (p.summary) profile.summary = p.summary;
        if (p.linkedin) profile.linkedin = p.linkedin;
        if (p.website) profile.website = p.website;
        if (p.certifications && p.certifications.length) profile.certifications = p.certifications;
        if (p.skills.length) {
            const ex = new Set((profile.skills).map(s => s.toLowerCase()));
            for (const s of p.skills) { if (!ex.has(s.toLowerCase())) { profile.skills.push(s); ex.add(s.toLowerCase()); } }
        }
        if (p.experience.length) profile.experience = p.experience;
        if (p.education.length) profile.education = p.education;
        if (p.languages && p.languages.length) {
            const ex = new Set((profile.languages).map(l => l.toLowerCase()));
            for (const l of p.languages) { if (!ex.has(l.toLowerCase())) { profile.languages.push(l); ex.add(l.toLowerCase()); } }
        }

        save();
        showDetection(p);
        refreshAll();

        // Highlight fields
        ['pName', 'pEmail', 'pPhone', 'pLocation', 'pTitle', 'pSummary'].forEach(id => {
            const el = document.getElementById(id);
            if (el && el.value) { el.classList.add('auto-filled'); el.addEventListener('input', () => el.classList.remove('auto-filled'), { once: true }); }
        });

        const items = [];
        if (p.name) items.push('name');
        if (p.title) items.push('title');
        if (p.summary) items.push('summary');
        if (p.skills.length) items.push(`${p.skills.length} skills`);
        if (p.experience.length) items.push(`${p.experience.length} jobs`);
        if (p.education.length) items.push(`${p.education.length} education`);
        if (p.languages.length) items.push(`${p.languages.length} languages`);
        if (p.certifications && p.certifications.length) items.push(`${p.certifications.length} certifications`);
        toast(`✅ Detected: ${items.join(', ')}. Review & edit below!`, 'success');
    }

    function showDetection(p) {
        const dr = document.getElementById('detectionResults');
        const grid = document.getElementById('detGrid');
        dr.style.display = 'block';

        const fields = [
            { icon: '👤', label: 'Name', value: p.name, ok: !!p.name },
            { icon: '💼', label: 'Title', value: p.title, ok: !!p.title },
            { icon: '📧', label: 'Email', value: p.contact.email, ok: !!p.contact.email },
            { icon: '📱', label: 'Phone', value: p.contact.phone, ok: !!p.contact.phone },
            { icon: '📍', label: 'Location', value: p.location, ok: !!p.location },
            { icon: '📝', label: 'Summary', value: p.summary ? p.summary.substring(0, 40) + '...' : null, ok: !!p.summary },
            { icon: '🛠️', label: 'Skills', value: `${p.skills.length} found`, ok: p.skills.length > 0 },
            { icon: '💼', label: 'Experience', value: `${p.experience.length} entries`, ok: p.experience.length > 0 },
            { icon: '🎓', label: 'Education', value: `${p.education.length} entries`, ok: p.education.length > 0 },
            { icon: '🌍', label: 'Languages', value: p.languages.length ? p.languages.join(', ') : null, ok: p.languages.length > 0 },
            { icon: '🔗', label: 'LinkedIn', value: p.linkedin, ok: !!p.linkedin },
            { icon: '🌐', label: 'Website', value: p.website, ok: !!p.website },
        ];
        if (p.certifications && p.certifications.length) fields.push({ icon: '📜', label: 'Certifications', value: `${p.certifications.length} found`, ok: true });

        const okCount = fields.filter(f => f.ok).length;
        document.getElementById('detBadge').textContent = `${okCount}/${fields.length} detected`;

        grid.innerHTML = fields.map(f => `
      <div class="det-card ${f.ok ? 'ok' : 'miss'}">
        <span class="det-card-icon">${f.icon}</span>
        <span class="det-card-label">${f.label}</span>
        <span class="det-card-value">${f.ok ? esc(f.value) : 'Not found'}</span>
      </div>
    `).join('');
    }

    // ── Refresh All Views ────────────────────
    function refreshAll() {
        fillProfile();
        fillDashboard();
        fillSkills();
        fillExperience();
        fillEducation();
    }

    // ── Profile Form ────────────────────────
    function fillProfile() {
        document.getElementById('pName').value = profile.name || '';
        document.getElementById('pEmail').value = profile.email || '';
        document.getElementById('pPhone').value = profile.phone || '';
        document.getElementById('pLocation').value = profile.location || '';
        document.getElementById('pTitle').value = profile.title || '';
        document.getElementById('pSummary').value = profile.summary || '';
        renderTags('langTags', profile.languages, i => { profile.languages.splice(i, 1); save(); fillProfile(); fillDashboard(); });
    }

    document.getElementById('btnSaveProfile').addEventListener('click', () => {
        profile.name = document.getElementById('pName').value;
        profile.email = document.getElementById('pEmail').value;
        profile.phone = document.getElementById('pPhone').value;
        profile.location = document.getElementById('pLocation').value;
        profile.title = document.getElementById('pTitle').value;
        profile.summary = document.getElementById('pSummary').value;
        save(); fillDashboard();
        toast('✅ Profile saved!', 'success');
    });

    // ── Dashboard ────────────────────────────
    function fillDashboard() {
        let fields = 0;
        if (profile.name) fields++;
        if (profile.email) fields++;
        if (profile.phone) fields++;
        if (profile.location) fields++;
        if (profile.title) fields++;
        if (profile.summary) fields++;
        document.getElementById('dStatFields').textContent = fields;
        document.getElementById('dStatSkills').textContent = profile.skills.length;
        document.getElementById('dStatExp').textContent = profile.experience.length;
        document.getElementById('dStatEdu').textContent = profile.education.length;

        // Completion
        const comp = calcCompletion();
        document.getElementById('dCompBadge').textContent = comp + '%';
        document.getElementById('dCompBar').style.width = comp + '%';
        const hint = document.getElementById('dCompHint');
        if (comp < 20) hint.textContent = '🔴 Upload your CV to get started!';
        else if (comp < 50) hint.textContent = '🟡 Good start! Review your detected profile.';
        else if (comp < 80) hint.textContent = '🟢 Almost there! Fine-tune your details.';
        else hint.textContent = '🔥 Profile looks great!';

        // Quick profile
        const qp = document.getElementById('dQuickProfile');
        if (profile.name || profile.title) {
            qp.innerHTML = `<div class="qp-filled">
        ${profile.name ? `<div class="qp-row"><span class="qp-icon">👤</span><span class="qp-label">Name</span><span class="qp-value">${esc(profile.name)}</span></div>` : ''}
        ${profile.title ? `<div class="qp-row"><span class="qp-icon">💼</span><span class="qp-label">Title</span><span class="qp-value">${esc(profile.title)}</span></div>` : ''}
        ${profile.email ? `<div class="qp-row"><span class="qp-icon">📧</span><span class="qp-label">Email</span><span class="qp-value">${esc(profile.email)}</span></div>` : ''}
        ${profile.location ? `<div class="qp-row"><span class="qp-icon">📍</span><span class="qp-label">Location</span><span class="qp-value">${esc(profile.location)}</span></div>` : ''}
        ${profile.phone ? `<div class="qp-row"><span class="qp-icon">📱</span><span class="qp-label">Phone</span><span class="qp-value">${esc(profile.phone)}</span></div>` : ''}
        ${profile.languages.length ? `<div class="qp-row"><span class="qp-icon">🌍</span><span class="qp-label">Languages</span><span class="qp-value">${esc(profile.languages.join(', '))}</span></div>` : ''}
      </div>`;
        } else {
            qp.innerHTML = '<div class="qp-empty"><span>📄</span><p>No profile data yet.<br>Upload your CV to auto-detect everything.</p></div>';
        }

        // Detection list on dashboard
        const dl = document.getElementById('dDetection');
        const checks = [
            { icon: '👤', label: 'Name', ok: !!profile.name },
            { icon: '💼', label: 'Title', ok: !!profile.title },
            { icon: '📧', label: 'Email', ok: !!profile.email },
            { icon: '📍', label: 'Location', ok: !!profile.location },
            { icon: '🛠️', label: 'Skills', ok: profile.skills.length > 0 },
            { icon: '💼', label: 'Experience', ok: profile.experience.length > 0 },
            { icon: '🎓', label: 'Education', ok: profile.education.length > 0 },
        ];
        dl.innerHTML = checks.map(c => `<div class="det-item ${c.ok ? 'ok' : 'miss'}">
      <span class="det-icon">${c.icon}</span>
      <span class="det-label">${c.label}</span>
      <span class="det-status">${c.ok ? '✅' : '⚠️'}</span>
    </div>`).join('');

        // Skills preview
        const sp = document.getElementById('dSkillsPreview');
        if (profile.skills.length) {
            sp.innerHTML = profile.skills.slice(0, 12).map(s => `<span class="skill-chip">${esc(s)}</span>`).join('') +
                (profile.skills.length > 12 ? `<span class="skill-chip" style="opacity:0.6">+${profile.skills.length - 12} more</span>` : '');
        } else {
            sp.innerHTML = '<p class="dash-empty-text">No skills detected yet.</p>';
        }
    }

    function calcCompletion() {
        let s = 0, t = 0;
        const checks = [
            [!!profile.name, 15], [!!profile.email, 5], [!!profile.title, 20], [!!profile.cvText, 10],
            [profile.skills.length > 0, 20], [profile.skills.length >= 5, 5],
            [profile.experience.length > 0, 10], [profile.education.length > 0, 10],
            [!!profile.location, 5],
        ];
        for (const [c, w] of checks) { t += w; if (c) s += w; }
        return Math.round(s / t * 100);
    }

    // ── Skills ───────────────────────────────
    function fillSkills() {
        renderTags('skillTags', profile.skills, i => { profile.skills.splice(i, 1); save(); fillSkills(); fillDashboard(); });
        document.getElementById('skillCountBadge').textContent = profile.skills.length + ' skills';
    }

    setupTagInput('skillInput', 'btnAddSkill', () => profile.skills, arr => { profile.skills = arr; save(); fillSkills(); fillDashboard(); });
    setupTagInput('langInput', 'btnAddLang', () => profile.languages, arr => { profile.languages = arr; save(); fillProfile(); fillDashboard(); });

    // ── Experience ───────────────────────────
    function fillExperience() {
        const c = document.getElementById('expList');
        document.getElementById('expBadge').textContent = profile.experience.length;
        if (!profile.experience.length) { c.innerHTML = '<div class="timeline-empty"><p>No experience detected yet. Upload your CV.</p></div>'; return; }
        c.innerHTML = '';
        profile.experience.forEach((exp, i) => {
            const el = document.createElement('div');
            el.className = 'tl-item';
            el.innerHTML = `
        <div class="tl-head">
          <div class="tl-main">
            <input class="tl-input tl-title" value="${esc(exp.title || '')}" placeholder="Job Title" data-i="${i}" data-f="title">
            <input class="tl-input tl-sub" value="${esc(exp.company || '')}" placeholder="Company" data-i="${i}" data-f="company">
          </div>
          <div class="tl-actions">
            <input class="tl-date" value="${esc(exp.dateRange || '')}" placeholder="2020 - Present" data-i="${i}" data-f="dateRange">
            <button class="tl-remove" data-i="${i}">✕</button>
          </div>
        </div>
        <textarea class="tl-desc" rows="2" placeholder="Description..." data-i="${i}" data-f="description">${esc((exp.description || []).join('\n'))}</textarea>`;
            el.querySelectorAll('input,textarea').forEach(inp => inp.addEventListener('change', () => {
                const idx = +inp.dataset.i, f = inp.dataset.f;
                if (f === 'description') profile.experience[idx].description = inp.value.split('\n').filter(l => l.trim());
                else profile.experience[idx][f] = inp.value;
                save();
            }));
            el.querySelector('.tl-remove').addEventListener('click', () => { profile.experience.splice(i, 1); save(); fillExperience(); fillDashboard(); });
            c.appendChild(el);
        });
    }

    document.getElementById('btnAddExp').addEventListener('click', () => {
        profile.experience.push({ title: '', company: '', dateRange: '', description: [] });
        save(); fillExperience(); fillDashboard();
    });

    // ── Education ────────────────────────────
    function fillEducation() {
        const c = document.getElementById('eduList');
        document.getElementById('eduBadge').textContent = profile.education.length;
        if (!profile.education.length) { c.innerHTML = '<div class="timeline-empty"><p>No education detected yet. Upload your CV.</p></div>'; return; }
        c.innerHTML = '';
        profile.education.forEach((edu, i) => {
            const el = document.createElement('div');
            el.className = 'tl-item';
            el.innerHTML = `
        <div class="tl-head">
          <div class="tl-main">
            <input class="tl-input tl-title" value="${esc(edu.degree || '')}" placeholder="Degree" data-i="${i}" data-f="degree">
          </div>
          <div class="tl-actions"><button class="tl-remove" data-i="${i}">✕</button></div>
        </div>
        <textarea class="tl-desc" rows="1" placeholder="Details..." data-i="${i}" data-f="details">${esc((edu.details || []).join('\n'))}</textarea>`;
            el.querySelectorAll('input,textarea').forEach(inp => inp.addEventListener('change', () => {
                const idx = +inp.dataset.i, f = inp.dataset.f;
                if (f === 'details') profile.education[idx].details = inp.value.split('\n').filter(l => l.trim());
                else profile.education[idx][f] = inp.value;
                save();
            }));
            el.querySelector('.tl-remove').addEventListener('click', () => { profile.education.splice(i, 1); save(); fillEducation(); fillDashboard(); });
            c.appendChild(el);
        });
    }

    document.getElementById('btnAddEdu').addEventListener('click', () => {
        profile.education.push({ degree: '', details: [] });
        save(); fillEducation(); fillDashboard();
    });

    // ── Helpers ──────────────────────────────
    function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    function save() { localStorage.setItem('jm_profile', JSON.stringify(profile)); }

    function renderTags(containerId, tags, onRemove) {
        const c = document.getElementById(containerId); if (!c) return;
        c.innerHTML = '';
        tags.forEach((t, i) => {
            const el = document.createElement('span');
            el.className = 'tag';
            el.innerHTML = `${esc(t)}<button class="tag-x">&times;</button>`;
            el.querySelector('.tag-x').addEventListener('click', () => onRemove(i));
            c.appendChild(el);
        });
    }

    function setupTagInput(inputId, btnId, getter, setter) {
        const input = document.getElementById(inputId);
        const btn = document.getElementById(btnId);
        if (!input || !btn) return;
        const add = () => { const v = input.value.trim(); if (!v) return; const arr = getter(); if (!arr.includes(v)) { arr.push(v); setter(arr); } input.value = ''; };
        btn.addEventListener('click', add);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    }

    function toast(msg, type = 'success') {
        const wrap = document.getElementById('toastWrap');
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.innerHTML = `<span>${type === 'success' ? '✅' : '⚠️'}</span><span>${msg}</span>`;
        wrap.appendChild(el);
        setTimeout(() => { el.style.animation = 'toastOut 0.3s ease'; setTimeout(() => el.remove(), 300); }, 3500);
    }

    // ── Init ─────────────────────────────────
    refreshAll();
});
