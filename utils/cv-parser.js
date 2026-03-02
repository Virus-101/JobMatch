// ============================================
// JobMatch AI — CV / Resume Parser
// ============================================

const CVParser = {

    // Common tech skills database for matching
    SKILL_DATABASE: [
        // Programming Languages
        'javascript', 'typescript', 'python', 'java', 'c#', 'c++', 'c', 'ruby', 'php', 'swift',
        'kotlin', 'go', 'golang', 'rust', 'scala', 'r', 'matlab', 'perl', 'dart', 'lua',
        'objective-c', 'shell', 'bash', 'powershell', 'sql', 'nosql', 'graphql',
        // Frontend
        'react', 'reactjs', 'react.js', 'angular', 'angularjs', 'vue', 'vuejs', 'vue.js',
        'svelte', 'next.js', 'nextjs', 'nuxt', 'nuxtjs', 'gatsby', 'html', 'html5',
        'css', 'css3', 'sass', 'scss', 'less', 'tailwind', 'tailwindcss', 'bootstrap',
        'material-ui', 'mui', 'chakra', 'styled-components', 'webpack', 'vite', 'babel',
        'jquery', 'redux', 'mobx', 'zustand', 'recoil',
        // Backend
        'node', 'nodejs', 'node.js', 'express', 'expressjs', 'fastify', 'nestjs', 'nest.js',
        'django', 'flask', 'fastapi', 'spring', 'spring boot', 'rails', 'ruby on rails',
        'laravel', 'symfony', 'asp.net', '.net', 'dotnet', 'gin', 'fiber', 'actix',
        // Databases
        'mysql', 'postgresql', 'postgres', 'mongodb', 'redis', 'elasticsearch', 'sqlite',
        'oracle', 'sql server', 'dynamodb', 'cassandra', 'couchdb', 'firebase', 'firestore',
        'supabase', 'prisma', 'sequelize', 'mongoose', 'typeorm',
        // Cloud & DevOps
        'aws', 'amazon web services', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes',
        'k8s', 'terraform', 'ansible', 'jenkins', 'ci/cd', 'github actions', 'gitlab ci',
        'circleci', 'travis ci', 'nginx', 'apache', 'linux', 'unix',
        // Data & AI
        'machine learning', 'deep learning', 'artificial intelligence', 'ai', 'ml',
        'tensorflow', 'pytorch', 'keras', 'scikit-learn', 'pandas', 'numpy', 'scipy',
        'nlp', 'natural language processing', 'computer vision', 'opencv',
        'data science', 'data engineering', 'data analysis', 'big data',
        'hadoop', 'spark', 'kafka', 'airflow', 'tableau', 'power bi',
        // Mobile
        'ios', 'android', 'react native', 'flutter', 'xamarin', 'ionic', 'cordova',
        'swiftui', 'jetpack compose',
        // Tools & Practices
        'git', 'github', 'gitlab', 'bitbucket', 'jira', 'confluence', 'slack',
        'agile', 'scrum', 'kanban', 'tdd', 'bdd', 'ci/cd', 'devops', 'sre',
        'microservices', 'api', 'rest', 'restful', 'grpc', 'websocket', 'oauth',
        // Design
        'figma', 'sketch', 'adobe xd', 'photoshop', 'illustrator', 'ui/ux', 'ux design',
        'ui design', 'wireframing', 'prototyping',
        // Other
        'project management', 'leadership', 'communication', 'problem solving',
        'team management', 'mentoring', 'public speaking', 'technical writing',
        'seo', 'marketing', 'analytics', 'accounting', 'finance', 'sales',
        'customer service', 'operations', 'logistics', 'supply chain',
        'healthcare', 'nursing', 'teaching', 'education', 'research'
    ],

    // Parse raw CV text into structured data
    parse(cvText) {
        if (!cvText || typeof cvText !== 'string') return null;

        const text = cvText.trim();
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
            rawText: text
        };
    },

    // Extract person's name (usually the first prominent line)
    extractName(lines) {
        // Skip lines that look like section headers, emails, phones, URLs
        const skipPatterns = /^(resume|cv|curriculum|vitae|portfolio|contact|summary|objective|experience|education|skills|phone|email|address|http|www\.|linkedin)/i;
        const emailPattern = /[\w.+-]+@[\w-]+\.[\w.]+/;
        const phonePattern = /^[\+\d\s\-\(\)]{7,}/;
        const urlPattern = /^(https?:\/\/|www\.)/i;

        for (let i = 0; i < Math.min(lines.length, 5); i++) {
            const line = lines[i];

            // Skip empty-ish, headers, contact info
            if (line.length < 3 || line.length > 50) continue;
            if (skipPatterns.test(line)) continue;
            if (emailPattern.test(line)) continue;
            if (phonePattern.test(line)) continue;
            if (urlPattern.test(line)) continue;

            // A name is typically 2-4 words, all capitalized or title-cased
            const words = line.split(/\s+/).filter(w => w.length > 0);
            if (words.length >= 2 && words.length <= 5) {
                const looksLikeName = words.every(w =>
                    /^[A-Z][a-zA-Z'-]+$/.test(w) || // Title case
                    /^[A-Z]{2,}$/.test(w) ||          // ALL CAPS
                    /^[a-z]{1,3}$/.test(w)             // small connectors (de, van, etc)
                );
                if (looksLikeName) return line;
            }

            // Fallback: if the first substantial line has mostly alpha characters, treat as name
            if (i === 0 && /^[A-Za-z\s.'-]+$/.test(line) && words.length >= 2) {
                return line;
            }
        }
        return '';
    },

    // Extract job title / professional headline
    extractTitle(lines, fullText) {
        const titlePatterns = [
            /(?:^|\n)\s*(?:title|role|position|headline|current role|current position)\s*[:\-–]\s*(.+)/im,
        ];

        // Check explicit labels first
        for (const pattern of titlePatterns) {
            const match = fullText.match(pattern);
            if (match) return match[1].trim();
        }

        // Common job title keywords
        const titleKeywords = /\b(engineer|developer|designer|manager|analyst|consultant|architect|administrator|specialist|coordinator|director|lead|senior|junior|associate|intern|executive|officer|president|founder|co-founder|scientist|researcher|professor|teacher|nurse|doctor|accountant|lawyer|attorney|chef|technician|operator|assistant|supervisor|head of|vp of|vice president|cto|ceo|cfo|coo|devops|full[- ]?stack|front[- ]?end|back[- ]?end|software|web|mobile|data|product|project|program|ui|ux|qa|test|cloud|system|network|database|security|marketing|sales|business|operations|hr|human resources|financial|creative)\b/i;

        // Look at lines 2-6 (right after the name) for a title-like line
        for (let i = 1; i < Math.min(lines.length, 7); i++) {
            const line = lines[i];

            // Skip lines that are clearly other things
            if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(line)) continue;  // email
            if (/^[\+\d\s\-\(\)]{7,}$/.test(line)) continue;     // phone
            if (/^(https?:\/\/|www\.)/i.test(line)) continue;     // URL
            if (/^(summary|objective|experience|education|skills|about|profile|address|phone|email)/i.test(line)) continue;

            // If the line contains a job title keyword and is short enough, it's likely the title
            if (titleKeywords.test(line) && line.length < 80 && line.length > 5) {
                return line.replace(/^[-–—|•]\s*/, '').trim();
            }
        }

        // Try to get title from the first experience entry
        const expHeaders = /^(experience|work\s*experience|employment|professional\s*experience)/i;
        let foundExpSection = false;
        for (const line of lines) {
            if (expHeaders.test(line)) { foundExpSection = true; continue; }
            if (foundExpSection && line.length > 5 && line.length < 80) {
                if (titleKeywords.test(line)) {
                    // Extract just the title part (before date or company)
                    const cleaned = line.replace(/\s*[-–—|,]\s*\d{4}.*$/i, '')
                        .replace(/\s*[-–—|,]\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec).*/i, '')
                        .trim();
                    if (cleaned.length > 5) return cleaned;
                }
                break;
            }
        }

        return '';
    },

    // Extract location
    extractLocation(text, lines) {
        // Match explicit address/location labels
        const labelPatterns = [
            /(?:location|address|city|based in|residing in)\s*[:\-–]\s*(.+)/im,
        ];
        for (const pattern of labelPatterns) {
            const match = text.match(pattern);
            if (match) return match[1].trim().substring(0, 80);
        }

        // Common location patterns: "City, State" or "City, Country"
        const locationPattern = /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\s*,\s*([A-Z]{2}|[A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\b/;

        // Check first 8 lines (header area of CV usually has location)
        for (let i = 0; i < Math.min(lines.length, 8); i++) {
            const line = lines[i];
            // Skip if line is clearly not a location
            if (/^(summary|objective|experience|education|skills)/i.test(line)) break;

            const match = line.match(locationPattern);
            if (match) {
                return match[0];
            }

            // Also check for standalone city names with country/state context
            const fullLocationMatch = line.match(/\b(\w+(?:\s\w+)*,\s*\w+(?:\s\w+)*(?:,\s*\w+(?:\s\w+)*)?)\b/);
            if (fullLocationMatch && /\b(USA|US|UK|Canada|Australia|Germany|France|India|Remote|New York|San Francisco|London|Berlin|Paris|Toronto|California|Texas|Florida|Washington)\b/i.test(fullLocationMatch[0])) {
                return fullLocationMatch[0];
            }
        }

        return '';
    },

    // Extract languages spoken
    extractLanguages(text, lines) {
        const languages = [];
        let inLangSection = false;
        const langHeaders = /^(languages?|spoken languages?|language skills?)/i;
        const sectionHeaders = /^(experience|education|skills|projects|certifications|awards|interests|references|work|summary|objective)/i;
        const commonLanguages = /\b(english|spanish|french|german|italian|portuguese|chinese|mandarin|cantonese|japanese|korean|arabic|hindi|urdu|bengali|russian|turkish|dutch|swedish|norwegian|danish|finnish|polish|czech|greek|hebrew|thai|vietnamese|indonesian|malay|tagalog|swahili)\b/i;

        for (const line of lines) {
            if (langHeaders.test(line)) { inLangSection = true; continue; }
            if (inLangSection && sectionHeaders.test(line)) break;
            if (inLangSection && line.length > 2) {
                // Extract language names from the line
                const matches = line.match(new RegExp(commonLanguages.source, 'gi'));
                if (matches) {
                    matches.forEach(m => {
                        const normalized = m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
                        if (!languages.includes(normalized)) languages.push(normalized);
                    });
                }
            }
        }

        // Also scan the whole text if no language section found
        if (languages.length === 0) {
            const matches = text.match(new RegExp(commonLanguages.source, 'gi'));
            if (matches) {
                const unique = new Set(matches.map(m => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase()));
                return Array.from(unique);
            }
        }

        return languages;
    },

    // Extract skills from text
    extractSkills(text) {
        const lowerText = text.toLowerCase();
        const found = new Set();

        for (const skill of this.SKILL_DATABASE) {
            // Match whole words/phrases
            const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
            if (regex.test(lowerText)) {
                // Normalize skill name (capitalize first letter)
                const normalized = skill.split(' ').map(w =>
                    w.charAt(0).toUpperCase() + w.slice(1)
                ).join(' ');
                found.add(normalized);
            }
        }

        return Array.from(found);
    },

    // Extract work experience sections
    extractExperience(lines) {
        const experiences = [];
        let inExperienceSection = false;
        let currentExp = null;

        const expHeaders = /^(experience|work\s*experience|employment|work\s*history|professional\s*experience)/i;
        const datePattern = /(\d{4}|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s*\d{4})\s*[-–—to]+\s*(\d{4}|present|current|now|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s*\d{4})/i;
        const sectionHeaders = /^(education|skills|projects|certifications|awards|languages|interests|references|summary|objective|about)/i;

        for (const line of lines) {
            if (expHeaders.test(line)) {
                inExperienceSection = true;
                continue;
            }

            if (inExperienceSection && sectionHeaders.test(line)) {
                if (currentExp) experiences.push(currentExp);
                inExperienceSection = false;
                continue;
            }

            if (inExperienceSection) {
                const dateMatch = line.match(datePattern);
                if (dateMatch) {
                    if (currentExp) experiences.push(currentExp);
                    currentExp = {
                        title: line.replace(datePattern, '').trim().replace(/[-–—|,]+$/, '').trim(),
                        dateRange: dateMatch[0],
                        description: []
                    };
                } else if (currentExp) {
                    if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*') || line.startsWith('–')) {
                        currentExp.description.push(line.replace(/^[•\-*–]\s*/, ''));
                    } else if (line.length > 10) {
                        // Might be company name or continuation
                        if (!currentExp.company) {
                            currentExp.company = line;
                        } else {
                            currentExp.description.push(line);
                        }
                    }
                }
            }
        }

        if (currentExp) experiences.push(currentExp);
        return experiences;
    },

    // Extract education
    extractEducation(lines) {
        const education = [];
        let inEduSection = false;
        let currentEdu = null;

        const eduHeaders = /^(education|academic|qualifications|degrees)/i;
        const degreePattern = /(bachelor|master|ph\.?d|mba|b\.?s\.?c?|m\.?s\.?c?|b\.?a\.?|m\.?a\.?|associate|diploma|certificate|degree)/i;
        const sectionHeaders = /^(experience|skills|projects|certifications|awards|languages|interests|references|work)/i;

        for (const line of lines) {
            if (eduHeaders.test(line)) {
                inEduSection = true;
                continue;
            }

            if (inEduSection && sectionHeaders.test(line)) {
                if (currentEdu) education.push(currentEdu);
                inEduSection = false;
                continue;
            }

            if (inEduSection) {
                if (degreePattern.test(line)) {
                    if (currentEdu) education.push(currentEdu);
                    currentEdu = {
                        degree: line,
                        details: []
                    };
                } else if (currentEdu && line.length > 5) {
                    currentEdu.details.push(line);
                }
            }
        }

        if (currentEdu) education.push(currentEdu);
        return education;
    },

    // Extract contact info
    extractContact(text) {
        const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
        const phoneMatch = text.match(/[\+]?[\d\s\-\(\)]{7,15}/);
        const linkedinMatch = text.match(/linkedin\.com\/in\/[\w-]+/i);

        return {
            email: emailMatch ? emailMatch[0] : '',
            phone: phoneMatch ? phoneMatch[0].trim() : '',
            linkedin: linkedinMatch ? linkedinMatch[0] : ''
        };
    },

    // Extract summary/objective
    extractSummary(lines) {
        let inSummary = false;
        const summaryLines = [];
        const summaryHeaders = /^(summary|objective|about\s*me|profile|professional\s*summary)/i;
        const sectionHeaders = /^(experience|education|skills|projects|certifications)/i;

        for (const line of lines) {
            if (summaryHeaders.test(line)) {
                inSummary = true;
                continue;
            }
            if (inSummary && sectionHeaders.test(line)) {
                break;
            }
            if (inSummary && line.length > 10) {
                summaryLines.push(line);
            }
        }

        return summaryLines.join(' ').substring(0, 500);
    },

    // Calculate years of experience from parsed data
    calculateYearsOfExperience(experiences) {
        let totalMonths = 0;
        const currentYear = new Date().getFullYear();

        for (const exp of experiences) {
            const years = exp.dateRange.match(/\d{4}/g);
            if (years && years.length >= 1) {
                const start = parseInt(years[0]);
                const end = /present|current|now/i.test(exp.dateRange) ? currentYear : (years[1] ? parseInt(years[1]) : start + 1);
                totalMonths += (end - start) * 12;
            }
        }

        return Math.round(totalMonths / 12 * 10) / 10;
    }
};

if (typeof window !== 'undefined') {
    window.CVParser = CVParser;
}
