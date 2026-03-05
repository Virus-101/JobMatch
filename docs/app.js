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
        // ─ Experience ─ (robust: handles PROFESSIONAL EXPERIENCE, multi-line entries)
        extractExperience(lines) {
            // Match all common experience section headers
            const isHeader = l => /^(professional\s+|work\s+|relevant\s+|career\s+)?experience\b/i.test(l);
            const isEndSec = l => /^(education|skills|technical|certif|project|key\s+tech|language|interest|reference|hobbies)/i.test(l);
            const isDate = l => {
                const m1 = l.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\.?\s+\d{4}\s*[-–—to]+\s*(present|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\.?\s+\d{4}|\d{4})/i);
                if (m1) return m1;
                const m2 = l.match(/(\b\d{4}\b)\s*[-–—to]+\s*(present|\d{4})/i);
                return m2 || null;
            };
            const isBullet = l => /^[•\-\*▪●○◆➤►▸‣■□▶]/.test(l);

            // Step 1: Collect all lines in the experience section
            const secLines = [];
            let sec = false;
            for (const l of lines) {
                if (isHeader(l)) { sec = true; continue; }
                if (sec && isEndSec(l)) break;
                if (sec) secLines.push(l);
            }
            if (secLines.length === 0) return [];

            // Step 2: Find all date line indices
            const dateIndices = [];
            for (let i = 0; i < secLines.length; i++) {
                if (isDate(secLines[i])) dateIndices.push(i);
            }

            // If no dates found at all, try a simpler approach
            if (dateIndices.length === 0) {
                // Try to find entries with em-dash or "at" patterns
                const entries = [];
                let cur = null;
                for (const l of secLines) {
                    if (l.includes('—') || l.includes('–') || l.includes(' at ') || l.includes(' @ ')) {
                        if (cur) entries.push(cur);
                        const parts = l.split(/\s*[—–]\s*/);
                        cur = { title: parts[0] || '', company: parts[1] || '', dateRange: parts[2] || '', description: [] };
                    } else if (cur && isBullet(l)) {
                        cur.description.push(l.replace(/^[•\-\*▪●○◆➤►▸‣■□▶]\s*/, ''));
                    } else if (cur) {
                        cur.description.push(l);
                    }
                }
                if (cur) entries.push(cur);
                return entries.filter(e => e.title || e.company);
            }

            // Step 3: Group lines into entries based on date positions
            const entries = [];
            for (let di = 0; di < dateIndices.length; di++) {
                const dateIdx = dateIndices[di];
                const dateLine = secLines[dateIdx];
                const dateMatch = isDate(dateLine);
                const dateRange = dateMatch ? dateMatch[0] : dateLine;

                // Look BACK from date line to find title and company
                // The lines between previous date's bullets and this date should be title/company
                let title = '', company = '';

                // Line immediately before the date
                const lb1 = dateIdx > 0 ? secLines[dateIdx - 1] : '';
                // Line 2 before the date
                const lb2 = dateIdx > 1 ? secLines[dateIdx - 2] : '';

                // Check if lb1 and lb2 are part of previous entry's bullets
                const prevDateEnd = di > 0 ? dateIndices[di - 1] : -1;

                if (lb1 && !isBullet(lb1) && !isDate(lb1) && (dateIdx - 1) > prevDateEnd) {
                    company = lb1;
                }
                if (lb2 && !isBullet(lb2) && !isDate(lb2) && (dateIdx - 2) > prevDateEnd) {
                    title = lb2;
                }

                // If we only found company but not title, it's probably the title
                if (!title && company) { title = company; company = ''; }

                // Collect bullet points / description lines after the date
                const description = [];
                const nextDateIdx = di + 1 < dateIndices.length ? dateIndices[di + 1] : secLines.length;
                for (let j = dateIdx + 1; j < nextDateIdx; j++) {
                    const line = secLines[j];
                    // Skip if this is a title/company for the next entry
                    if (di + 1 < dateIndices.length) {
                        const nextDI = dateIndices[di + 1];
                        if (j >= nextDI - 2 && !isBullet(line)) continue;
                    }
                    if (isBullet(line)) {
                        description.push(line.replace(/^[•\-\*▪●○◆➤►▸‣■□▶]\s*/, ''));
                    } else if (line.length > 20) {
                        description.push(line);
                    }
                }

                entries.push({
                    title: title.trim(),
                    company: company.trim(),
                    dateRange: dateRange.trim(),
                    description
                });
            }

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

    // ════════════════════════════════════════════
    // ★ JOB SEARCH ★
    // ════════════════════════════════════════════
    function initJobSearch() {
        const titleInput = document.getElementById('jsTitle');
        const locInput = document.getElementById('jsLocation');
        if (profile.title) titleInput.value = profile.title;
        if (profile.location) locInput.value = profile.location;

        // Populate skill search tags
        const skillTagsC = document.getElementById('jsSkillTags');
        if (skillTagsC && profile.skills.length) {
            skillTagsC.innerHTML = '';
            profile.skills.forEach(s => {
                const btn = document.createElement('button');
                btn.className = 'skill-search-tag';
                btn.textContent = s;
                btn.addEventListener('click', () => {
                    titleInput.value = s;
                    document.getElementById('btnSearchJobs').click();
                });
                skillTagsC.appendChild(btn);
            });
        } else if (skillTagsC) {
            skillTagsC.innerHTML = '<p class="dash-empty-text">Upload your CV first to see your skills here.</p>';
        }
    }

    document.getElementById('btnSearchJobs').addEventListener('click', () => {
        const title = document.getElementById('jsTitle').value.trim();
        const location = document.getElementById('jsLocation').value.trim();
        if (!title) { toast('Enter a job title or keyword to search.', 'error'); return; }

        const q = encodeURIComponent(title);
        const loc = encodeURIComponent(location);

        const platforms = [
            { name: 'LinkedIn', icon: '🔗', color: '#0A66C2', url: `https://www.linkedin.com/jobs/search/?keywords=${q}&location=${loc}` },
            { name: 'Indeed', icon: '🟦', color: '#2164f3', url: `https://www.indeed.com/jobs?q=${q}&l=${loc}` },
            { name: 'Glassdoor', icon: '🟢', color: '#0caa41', url: `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${q}&locT=C&locKeyword=${loc}` },
            { name: 'Google Jobs', icon: '🔍', color: '#4285F4', url: `https://www.google.com/search?q=${encodeURIComponent(title + ' jobs ' + location)}&ibp=htl;jobs` },
            { name: 'RemoteOK', icon: '🌍', color: '#FF4742', url: `https://remoteok.com/remote-${q.replace(/%20/g, '-')}-jobs` },
            { name: 'We Work Remotely', icon: '💻', color: '#1a1a2e', url: `https://weworkremotely.com/remote-jobs/search?term=${q}` },
            { name: 'ZipRecruiter', icon: '📋', color: '#6b9f1e', url: `https://www.ziprecruiter.com/jobs-search?search=${q}&location=${loc}` },
            { name: 'Monster', icon: '👾', color: '#6e45a5', url: `https://www.monster.com/jobs/search?q=${q}&where=${loc}` },
        ];

        const container = document.getElementById('jsPlatforms');
        container.innerHTML = '';
        platforms.forEach(p => {
            const a = document.createElement('a');
            a.href = p.url;
            a.target = '_blank';
            a.className = 'js-platform-card';
            a.style.borderColor = p.color + '40';
            a.innerHTML = `
                <span class="js-platform-icon">${p.icon}</span>
                <span class="js-platform-name">${p.name}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            `;
            container.appendChild(a);
        });

        document.getElementById('jsResultsCard').style.display = 'block';
        toast(`🔍 Search links ready for "${title}"`, 'success');
    });

    // ════════════════════════════════════════════
    // ★ MATCH SCORE ★
    // ════════════════════════════════════════════
    document.getElementById('btnAnalyzeMatch').addEventListener('click', () => {
        const jd = document.getElementById('msJobDesc').value.trim();
        if (!jd) { toast('Paste a job description first.', 'error'); return; }
        if (!profile.skills || !profile.skills.length) { toast('Upload your CV first to detect your skills.', 'error'); return; }

        const jdLower = jd.toLowerCase();

        // 1) Skill matching
        const matched = [], missing = [];
        const allSkills = new Set();
        // Extract skills mentioned in JD
        const skillsDb = profile.skills;
        const jdSkills = CVParser.extractSkills(jd);

        skillsDb.forEach(s => {
            const sLow = s.toLowerCase();
            if (jdLower.includes(sLow) || jdSkills.map(x => x.toLowerCase()).includes(sLow)) {
                matched.push(s);
            }
        });
        jdSkills.forEach(s => {
            if (!skillsDb.map(x => x.toLowerCase()).includes(s.toLowerCase())) {
                missing.push(s);
            }
        });

        // 2) Title match
        let titleScore = 0;
        if (profile.title) {
            const titleWords = profile.title.toLowerCase().split(/\s+/);
            const matchedWords = titleWords.filter(w => w.length > 2 && jdLower.includes(w));
            titleScore = Math.min(100, (matchedWords.length / Math.max(titleWords.length, 1)) * 100);
        }

        // 3) Experience match
        let expScore = 0;
        if (profile.experience && profile.experience.length) {
            const expKeywords = [];
            profile.experience.forEach(e => {
                if (e.title) expKeywords.push(...e.title.toLowerCase().split(/\s+/));
                if (e.description) e.description.forEach(d => expKeywords.push(...d.toLowerCase().split(/\s+/).filter(w => w.length > 4)));
            });
            const expMatched = expKeywords.filter(w => jdLower.includes(w));
            expScore = Math.min(100, (expMatched.length / Math.max(expKeywords.length * 0.3, 1)) * 100);
        }

        // 4) Education match
        let eduScore = 0;
        if (profile.education && profile.education.length) {
            const eduKeywords = ['bachelor', 'master', 'phd', 'degree', 'computer science', 'engineering', 'data science'];
            profile.education.forEach(e => {
                if (e.degree) {
                    const words = e.degree.toLowerCase().split(/\s+/);
                    words.forEach(w => { if (jdLower.includes(w) && w.length > 3) eduScore += 20; });
                }
            });
            eduScore = Math.min(100, eduScore);
        }

        // 5) Calculate overall score
        const skillScore = jdSkills.length > 0 ? (matched.length / Math.max(jdSkills.length, 1)) * 100 : (matched.length > 0 ? 60 : 0);
        const overall = Math.round(skillScore * 0.40 + titleScore * 0.25 + expScore * 0.20 + eduScore * 0.15);

        // Display results
        document.getElementById('msResultCard').style.display = 'block';
        const scoreNum = document.getElementById('msScoreNum');
        const ring = document.getElementById('msScoreRing');

        // Animate score
        let current = 0;
        const interval = setInterval(() => {
            current += 2;
            if (current >= overall) { current = overall; clearInterval(interval); }
            scoreNum.textContent = current;
        }, 20);

        // Color the ring
        const color = overall >= 80 ? '#10B981' : overall >= 60 ? '#6366F1' : overall >= 40 ? '#F59E0B' : '#EF4444';
        ring.style.background = `conic-gradient(${color} ${overall * 3.6}deg, rgba(255,255,255,0.06) 0deg)`;

        // Labels
        const labels = {
            80: ['🔥 Excellent Match', 'You\'re a strong candidate! Apply with confidence.'],
            60: ['⭐ Great Match', 'Very good fit. Highlight your matching skills.'],
            40: ['👍 Good Match', 'Decent fit. Consider upskilling the missing areas.'],
            0: ['🤔 Fair Match', 'Some gaps. Focus on transferable skills in your application.']
        };
        const [label, advice] = Object.entries(labels).sort(([a], [b]) => b - a).find(([threshold]) => overall >= threshold)?.[1] || labels[0];
        document.getElementById('msScoreLabel').textContent = label;
        document.getElementById('msScoreAdvice').textContent = advice;

        // Matched/Missing tags
        const matchedC = document.getElementById('msMatchedSkills');
        const missingC = document.getElementById('msMissingSkills');
        matchedC.innerHTML = matched.length ? matched.map(s => `<span class="tag tag-match">${esc(s)}</span>`).join('') : '<p class="dash-empty-text">No matching skills found</p>';
        missingC.innerHTML = missing.length ? missing.map(s => `<span class="tag tag-miss">${esc(s)}</span>`).join('') : '<p class="dash-empty-text">No missing skills — great coverage!</p>';

        // Breakdown bars
        const breakdown = document.getElementById('msBreakdown');
        const factors = [
            { name: 'Skills Match', score: Math.round(skillScore), weight: '40%' },
            { name: 'Title Match', score: Math.round(titleScore), weight: '25%' },
            { name: 'Experience', score: Math.round(expScore), weight: '20%' },
            { name: 'Education', score: Math.round(eduScore), weight: '15%' },
        ];
        breakdown.innerHTML = factors.map(f => `
            <div class="ms-bar-row">
                <span class="ms-bar-label">${f.name} <small>(${f.weight})</small></span>
                <div class="ms-bar-track"><div class="ms-bar-fill" style="width:${f.score}%; background:${f.score >= 60 ? '#10B981' : f.score >= 30 ? '#F59E0B' : '#EF4444'};"></div></div>
                <span class="ms-bar-val">${f.score}%</span>
            </div>
        `).join('');

        // Store last match for save
        window._lastMatch = { title: '', jd, score: overall, matched, missing, date: new Date().toISOString() };
        toast(`📊 Match score: ${overall}/100`, 'success');
    });

    document.getElementById('btnSaveMatch').addEventListener('click', () => {
        if (!window._lastMatch) return;
        const apps = JSON.parse(localStorage.getItem('jm_applications') || '[]');
        apps.push({
            id: Date.now(),
            company: 'Unknown (from Match Score)',
            title: window._lastMatch.title || 'Job from Match Score',
            score: window._lastMatch.score,
            status: 'saved',
            date: window._lastMatch.date,
            notes: `Score: ${window._lastMatch.score}/100. Matched: ${window._lastMatch.matched.join(', ')}`
        });
        localStorage.setItem('jm_applications', JSON.stringify(apps));
        fillApplications();
        toast('💾 Saved to Applications!', 'success');
    });

    // ════════════════════════════════════════════
    // ★ APPLICATIONS TRACKER ★
    // ════════════════════════════════════════════
    function getApps() { return JSON.parse(localStorage.getItem('jm_applications') || '[]'); }
    function saveApps(apps) { localStorage.setItem('jm_applications', JSON.stringify(apps)); }

    let appFilter = 'all';
    document.querySelectorAll('.app-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.app-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            appFilter = btn.dataset.filter;
            fillApplications();
        });
    });

    document.getElementById('btnAddApp').addEventListener('click', () => {
        const company = prompt('Company name:');
        if (!company) return;
        const title = prompt('Job title:');
        const url = prompt('Job URL (optional):') || '';
        const apps = getApps();
        apps.push({ id: Date.now(), company, title: title || '', url, status: 'saved', score: 0, date: new Date().toISOString(), notes: '' });
        saveApps(apps);
        fillApplications();
        toast('✅ Application added!', 'success');
    });

    function fillApplications() {
        const apps = getApps();
        const filtered = appFilter === 'all' ? apps : apps.filter(a => a.status === appFilter);

        // Stats
        document.getElementById('appStatTotal').textContent = apps.length;
        document.getElementById('appStatApplied').textContent = apps.filter(a => a.status === 'applied').length;
        document.getElementById('appStatInterview').textContent = apps.filter(a => a.status === 'interview').length;
        document.getElementById('appStatOffer').textContent = apps.filter(a => a.status === 'offer').length;

        const container = document.getElementById('appList');
        if (!filtered.length) {
            container.innerHTML = '<div class="timeline-empty"><p>No applications in this category.</p></div>';
            return;
        }

        container.innerHTML = '';
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(app => {
            const statusEmoji = { saved: '💾', applied: '📤', interview: '🎯', offer: '🏆', rejected: '❌' };
            const statusColors = { saved: '#818CF8', applied: '#3B82F6', interview: '#F59E0B', offer: '#10B981', rejected: '#EF4444' };
            const el = document.createElement('div');
            el.className = 'app-item';
            el.innerHTML = `
                <div class="app-item-left">
                    <div class="app-status-dot" style="background:${statusColors[app.status] || '#818CF8'}"></div>
                    <div class="app-item-info">
                        <div class="app-item-title">${esc(app.title || 'Untitled Position')}</div>
                        <div class="app-item-company">${esc(app.company)} ${app.score ? `<span class="app-score">${app.score}/100</span>` : ''}</div>
                        <div class="app-item-date">${new Date(app.date).toLocaleDateString()}</div>
                    </div>
                </div>
                <div class="app-item-right">
                    <select class="app-status-select" data-id="${app.id}">
                        <option value="saved" ${app.status === 'saved' ? 'selected' : ''}>💾 Saved</option>
                        <option value="applied" ${app.status === 'applied' ? 'selected' : ''}>📤 Applied</option>
                        <option value="interview" ${app.status === 'interview' ? 'selected' : ''}>🎯 Interview</option>
                        <option value="offer" ${app.status === 'offer' ? 'selected' : ''}>🏆 Offer</option>
                        <option value="rejected" ${app.status === 'rejected' ? 'selected' : ''}>❌ Rejected</option>
                    </select>
                    ${app.url ? `<a href="${esc(app.url)}" target="_blank" class="btn btn-sm" title="Open">🔗</a>` : ''}
                    <button class="btn btn-sm app-remove" data-id="${app.id}" title="Remove">🗑️</button>
                </div>
            `;

            el.querySelector('.app-status-select').addEventListener('change', e => {
                const apps = getApps();
                const a = apps.find(x => x.id === +e.target.dataset.id);
                if (a) { a.status = e.target.value; saveApps(apps); fillApplications(); }
            });

            el.querySelector('.app-remove').addEventListener('click', e => {
                const apps = getApps().filter(x => x.id !== +e.target.dataset.id);
                saveApps(apps);
                fillApplications();
                toast('Application removed.', 'success');
            });

            container.appendChild(el);
        });
    }

    // ════════════════════════════════════════════
    // ★ COVER LETTER GENERATOR ★
    // ════════════════════════════════════════════
    document.getElementById('btnGenerateCL').addEventListener('click', () => {
        const company = document.getElementById('clCompany').value.trim();
        const jobTitle = document.getElementById('clJobTitle').value.trim();
        const jobDesc = document.getElementById('clJobDesc').value.trim();
        const tone = document.getElementById('clTone').value;
        const manager = document.getElementById('clManager').value.trim();

        if (!company || !jobTitle) { toast('Enter a company name and job title.', 'error'); return; }
        if (!profile.name) { toast('Upload your CV first to populate your profile.', 'error'); return; }

        // Extract relevant skills from JD
        const jdSkills = jobDesc ? CVParser.extractSkills(jobDesc) : [];
        const matchedSkills = profile.skills.filter(s => jdSkills.map(x => x.toLowerCase()).includes(s.toLowerCase()));
        const topSkills = (matchedSkills.length ? matchedSkills : profile.skills).slice(0, 5);

        // Experience summary
        const latestExp = profile.experience && profile.experience.length ? profile.experience[0] : null;
        const expYears = latestExp && latestExp.dateRange ? (() => {
            const m = latestExp.dateRange.match(/\d{4}/);
            return m ? new Date().getFullYear() - parseInt(m[0]) : '';
        })() : '';

        const greeting = manager ? `Dear ${manager},` : 'Dear Hiring Manager,';
        const name = profile.name;
        const title = profile.title || jobTitle;

        // Generate based on tone
        let letter = '';
        const skillStr = topSkills.join(', ');
        const latestRole = latestExp ? `${latestExp.title} at ${latestExp.company}` : '';

        if (tone === 'enthusiastic') {
            letter = `${greeting}

I am thrilled to apply for the ${jobTitle} position at ${company}! As a passionate ${title} with a strong background in ${skillStr}, I am confident that I can make a meaningful impact on your team.

${latestRole ? `In my most recent role as ${latestRole}, I developed expertise in ${topSkills.slice(0, 3).join(', ')}, which directly aligns with the requirements of this position.` : `My expertise in ${skillStr} makes me an ideal candidate for this role.`}

${jobDesc ? `What excites me most about this opportunity is the chance to work with cutting-edge technologies and contribute to ${company}'s mission. My experience with ${topSkills.slice(0, 2).join(' and ')} positions me perfectly to hit the ground running.` : `I am eager to bring my skills and enthusiasm to ${company} and contribute to your team's success.`}

${profile.education && profile.education.length ? `I hold a ${profile.education[0].degree || 'degree'}, which has provided me with a solid foundation in the theoretical and practical aspects of this field.` : ''}

I would welcome the opportunity to discuss how my background and skills can benefit ${company}. Thank you for considering my application!

Warm regards,
${name}
${profile.email || ''}
${profile.phone || ''}`;
        } else if (tone === 'concise') {
            letter = `${greeting}

I am writing to apply for the ${jobTitle} position at ${company}.

Key qualifications:
${topSkills.map(s => `• ${s}`).join('\n')}
${latestRole ? `• Recent experience: ${latestRole}` : ''}
${profile.education && profile.education.length ? `• Education: ${profile.education[0].degree || ''}` : ''}

${jobDesc ? `My skills in ${topSkills.slice(0, 3).join(', ')} directly address your requirements.` : `I believe my technical expertise makes me a strong candidate.`} I am ready to contribute immediately.

Available for an interview at your convenience.

Best regards,
${name}
${profile.email || ''} | ${profile.phone || ''}`;
        } else {
            // Professional (default)
            letter = `${greeting}

I am writing to express my interest in the ${jobTitle} position at ${company}. With my background as a ${title} and proficiency in ${skillStr}, I believe I would be a valuable addition to your team.

${latestRole ? `Currently serving as ${latestRole}, I have gained hands-on experience in ${topSkills.slice(0, 3).join(', ')}. This experience has prepared me to contribute effectively to your organization from day one.` : `My professional experience has equipped me with strong expertise in ${skillStr}, enabling me to deliver high-quality results in fast-paced environments.`}

${jobDesc ? `After reviewing the job description, I am confident that my skills align well with your requirements. My expertise in ${matchedSkills.length ? matchedSkills.slice(0, 3).join(', ') : topSkills.slice(0, 3).join(', ')} would enable me to make immediate contributions to your projects.` : ''}

${profile.summary ? profile.summary.split('.').slice(0, 2).join('.') + '.' : ''}

${profile.education && profile.education.length ? `My educational background includes a ${profile.education[0].degree || 'degree'}, which has provided me with a comprehensive understanding of the field.` : ''}

I would appreciate the opportunity to discuss how my experience and skills can contribute to ${company}'s goals. I am available for an interview at your earliest convenience.

Thank you for your consideration.

Sincerely,
${name}
${profile.email || ''}
${profile.phone || ''}`;
        }

        // Display
        document.getElementById('clResultCard').style.display = 'block';
        document.getElementById('clOutput').innerHTML = letter.split('\n').map(l => `<p>${l || '&nbsp;'}</p>`).join('');
        toast('✨ Cover letter generated!', 'success');
    });

    document.getElementById('btnCopyCL').addEventListener('click', () => {
        const text = document.getElementById('clOutput').innerText;
        navigator.clipboard.writeText(text).then(() => toast('📋 Copied to clipboard!', 'success'));
    });

    document.getElementById('btnDownloadCL').addEventListener('click', () => {
        const text = document.getElementById('clOutput').innerText;
        const blob = new Blob([text], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `cover-letter-${document.getElementById('clCompany').value.replace(/\s+/g, '-').toLowerCase() || 'draft'}.txt`;
        a.click();
        URL.revokeObjectURL(a.href);
        toast('💾 Downloaded!', 'success');
    });

    // ════════════════════════════════════════════
    // ★ AUTO APPLY ENGINE CONNECTION ★
    // ════════════════════════════════════════════
    const ENGINE_URL = 'http://localhost:3456';
    const WS_URL = 'ws://localhost:3456';
    let ws = null;
    let engineConnected = false;

    function updateConnectionUI(connected) {
        engineConnected = connected;
        const status = document.getElementById('aaConnectionStatus');
        const connectCard = document.getElementById('aaConnectCard');
        const cards = ['aaAccountsCard', 'aaSettingsCard', 'aaControlsCard', 'aaSingleCard', 'aaFeedCard', 'aaStatsRow'];

        if (connected) {
            status.className = 'aa-connection online';
            status.innerHTML = '<span class="aa-dot"></span> Engine Online';
            connectCard.style.display = 'none';
            cards.forEach(id => document.getElementById(id).style.display = '');

            // Pre-fill from profile
            const q = document.getElementById('aaQuery');
            const l = document.getElementById('aaLocation');
            if (!q.value && profile.title) q.value = profile.title;
            if (!l.value && profile.location) l.value = profile.location;
        } else {
            status.className = 'aa-connection offline';
            status.innerHTML = '<span class="aa-dot"></span> Engine Offline';
            connectCard.style.display = '';
            cards.forEach(id => document.getElementById(id).style.display = 'none');
        }
    }

    function connectToEngine() {
        try {
            ws = new WebSocket(WS_URL);

            ws.onopen = () => {
                updateConnectionUI(true);
                toast('🔌 Connected to Auto-Apply engine!', 'success');

                // Send profile to engine
                fetch(`${ENGINE_URL}/api/profile`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(profile),
                }).catch(() => { });
            };

            ws.onclose = () => {
                updateConnectionUI(false);
            };

            ws.onerror = () => {
                updateConnectionUI(false);
            };

            ws.onmessage = (event) => {
                try {
                    const payload = JSON.parse(event.data);
                    handleEngineEvent(payload);
                } catch (e) { /* ignore parse errors */ }
            };
        } catch (err) {
            updateConnectionUI(false);
            toast('Could not connect. Make sure the engine is running.', 'error');
        }
    }

    function handleEngineEvent(payload) {
        const { event, data } = payload;
        const feed = document.getElementById('aaFeed');

        // Clear "waiting" message
        const empty = feed.querySelector('.aa-feed-empty');
        if (empty) empty.remove();

        function addFeedItem(icon, text, type = '') {
            const el = document.createElement('div');
            el.className = `aa-feed-item ${type}`;
            const time = new Date().toLocaleTimeString();
            el.innerHTML = `<span class="aa-feed-time">${time}</span> <span>${icon}</span> <span>${text}</span>`;
            feed.insertBefore(el, feed.firstChild);
            // Keep max 50 items
            while (feed.children.length > 50) feed.lastChild.remove();
        }

        switch (event) {
            case 'connected':
                if (data) {
                    document.getElementById('aaStatApplied').textContent = data.totalApplied || 0;
                    document.getElementById('aaStatFailed').textContent = data.totalFailed || 0;
                    document.getElementById('aaStatSkipped').textContent = data.totalSkipped || 0;
                    document.getElementById('aaStatQueue').textContent = data.queueLength || 0;
                }
                break;

            case 'accounts_detected':
                renderAccounts(data);
                break;

            case 'status':
                addFeedItem('ℹ️', data.message);
                break;

            case 'jobs_found':
                addFeedItem('🔎', `Found ${data.count} jobs on ${data.platform}`, 'info');
                break;

            case 'applying':
                addFeedItem('⏳', `[${data.index}/${data.total}] Applying: <strong>${data.job.title}</strong> at ${data.job.company}`);
                document.getElementById('aaProgress').style.display = 'flex';
                document.getElementById('aaProgressFill').style.width = `${(data.index / data.total) * 100}%`;
                document.getElementById('aaProgressText').textContent = `${data.index} / ${data.total}`;
                break;

            case 'applied':
                addFeedItem('✅', `Applied: <strong>${data.job.title}</strong> at ${data.job.company}`, 'success');
                document.getElementById('aaStatApplied').textContent = data.total;
                break;

            case 'skipped':
                addFeedItem('⏭️', `Skipped: ${data.job.title} (${data.reason})`, 'skip');
                break;

            case 'failed':
                addFeedItem('❌', `Failed: ${data.job.title} — ${data.reason}`, 'error');
                break;

            case 'external':
                addFeedItem('🔗', `External: <a href="${data.url}" target="_blank">${data.job.title}</a>`, 'info');
                break;

            case 'warning':
                addFeedItem('⚠️', data.message, 'warn');
                break;

            case 'error':
                addFeedItem('🚨', data.message, 'error');
                toast(data.message, 'error');
                break;

            case 'started':
                document.getElementById('btnStartApply').style.display = 'none';
                document.getElementById('btnPauseApply').style.display = '';
                document.getElementById('btnStopApply').style.display = '';
                addFeedItem('🚀', 'Auto-apply started!', 'success');
                break;

            case 'paused':
                document.getElementById('btnPauseApply').style.display = 'none';
                document.getElementById('btnResumeApply').style.display = '';
                addFeedItem('⏸️', 'Paused');
                break;

            case 'resumed':
                document.getElementById('btnResumeApply').style.display = 'none';
                document.getElementById('btnPauseApply').style.display = '';
                addFeedItem('▶️', 'Resumed');
                break;

            case 'stopped':
            case 'completed':
                document.getElementById('btnStartApply').style.display = '';
                document.getElementById('btnPauseApply').style.display = 'none';
                document.getElementById('btnResumeApply').style.display = 'none';
                document.getElementById('btnStopApply').style.display = 'none';
                if (event === 'completed') {
                    addFeedItem('🏁', `Completed! Applied to ${data.applied} of ${data.total} jobs.`, 'success');
                    toast(`🏁 Done! Applied to ${data.applied} jobs.`, 'success');
                } else {
                    addFeedItem('🛑', 'Stopped by user');
                }
                break;
        }
    }

    function renderAccounts(accounts) {
        const c = document.getElementById('aaAccounts');
        c.innerHTML = '';
        for (const [key, acc] of Object.entries(accounts)) {
            const el = document.createElement('div');
            el.className = `aa-account ${acc.loggedIn ? 'logged-in' : 'logged-out'}`;
            el.innerHTML = `
                <span class="aa-account-status">${acc.loggedIn ? '✅' : '❌'}</span>
                <span class="aa-account-name">${acc.name}</span>
                <span class="aa-account-label">${acc.loggedIn ? 'Logged in' : '<a href="' + acc.loginUrl + '" target="_blank">Log in →</a>'}</span>
            `;
            c.appendChild(el);
        }
    }

    // Event listeners
    document.getElementById('btnConnectEngine').addEventListener('click', connectToEngine);

    document.getElementById('btnDetectAccounts').addEventListener('click', async () => {
        toast('🔍 Detecting accounts...', 'success');
        try {
            const res = await fetch(`${ENGINE_URL}/api/accounts`);
            const accounts = await res.json();
            renderAccounts(accounts);
        } catch { toast('Engine not reachable', 'error'); }
    });

    document.getElementById('btnStartApply').addEventListener('click', async () => {
        const query = document.getElementById('aaQuery').value.trim();
        const location = document.getElementById('aaLocation').value.trim();
        if (!query) { toast('Enter a job title to search for', 'error'); return; }

        const platforms = [];
        if (document.getElementById('aaPlatLinkedin').checked) platforms.push('linkedin');
        if (document.getElementById('aaPlatIndeed').checked) platforms.push('indeed');

        try {
            await fetch(`${ENGINE_URL}/api/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    profile,
                    settings: {
                        query,
                        location,
                        platforms,
                        maxApplicationsPerSession: parseInt(document.getElementById('aaMaxApps').value) || 25,
                        easyApplyOnly: document.getElementById('aaEasyOnly').checked,
                        skipApplied: document.getElementById('aaSkipApplied').checked,
                    },
                }),
            });
        } catch { toast('Engine not reachable', 'error'); }
    });

    document.getElementById('btnPauseApply').addEventListener('click', () => {
        fetch(`${ENGINE_URL}/api/pause`, { method: 'POST' }).catch(() => { });
    });

    document.getElementById('btnResumeApply').addEventListener('click', () => {
        fetch(`${ENGINE_URL}/api/resume`, { method: 'POST' }).catch(() => { });
    });

    document.getElementById('btnStopApply').addEventListener('click', () => {
        fetch(`${ENGINE_URL}/api/stop`, { method: 'POST' }).catch(() => { });
    });

    document.getElementById('btnApplySingle').addEventListener('click', async () => {
        const url = document.getElementById('aaSingleUrl').value.trim();
        if (!url) { toast('Paste a job URL', 'error'); return; }

        try {
            toast('🎯 Applying...', 'success');
            const res = await fetch(`${ENGINE_URL}/api/apply-url`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, profile }),
            });
            const result = await res.json();
            if (result.success) {
                toast('✅ Application submitted!', 'success');
            } else {
                toast(`Application: ${result.reason}`, 'error');
            }
        } catch { toast('Engine not reachable', 'error'); }
    });

    document.getElementById('btnClearFeed').addEventListener('click', () => {
        document.getElementById('aaFeed').innerHTML = '<div class="aa-feed-empty">Feed cleared.</div>';
    });

    // Try auto-connect on load
    setTimeout(() => {
        fetch(`${ENGINE_URL}/api/status`).then(r => r.json()).then(() => {
            connectToEngine();
        }).catch(() => { /* engine not running, that's fine */ });
    }, 1000);

    // ── Init ─────────────────────────────────
    refreshAll();
    initJobSearch();
    fillApplications();
});
