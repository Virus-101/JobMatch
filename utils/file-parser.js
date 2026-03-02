// ============================================
// JobMatch AI — File Parser (PDF & DOCX)
// Extracts text from uploaded CV files
// ============================================

const FileParser = {

    // Supported file types
    SUPPORTED_TYPES: {
        'application/pdf': 'pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
        'text/plain': 'txt',
        'text/rtf': 'txt',
    },

    SUPPORTED_EXTENSIONS: ['.pdf', '.docx', '.doc', '.txt', '.rtf'],

    // Check if a file is supported
    isSupported(file) {
        const ext = '.' + file.name.split('.').pop().toLowerCase();
        return this.SUPPORTED_EXTENSIONS.includes(ext) || !!this.SUPPORTED_TYPES[file.type];
    },

    // Get file type
    getType(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'pdf') return 'pdf';
        if (ext === 'docx') return 'docx';
        if (ext === 'doc') return 'doc';
        if (ext === 'txt' || ext === 'rtf') return 'txt';
        return this.SUPPORTED_TYPES[file.type] || null;
    },

    // Main entry: extract text from any supported file
    async extractText(file) {
        const type = this.getType(file);

        if (!type) {
            throw new Error(`Unsupported file type: ${file.name}. Please use PDF, DOCX, or TXT.`);
        }

        switch (type) {
            case 'pdf':
                return await this.extractFromPDF(file);
            case 'docx':
                return await this.extractFromDOCX(file);
            case 'doc':
                return await this.extractFromDOC(file);
            case 'txt':
                return await this.extractFromText(file);
            default:
                throw new Error(`Cannot process ${type} files.`);
        }
    },

    // ── PDF Extraction using pdf.js ──────────
    async extractFromPDF(file) {
        const arrayBuffer = await file.arrayBuffer();

        // pdf.js is loaded as ES module via importScripts workaround
        // We use the global pdfjsLib set up by the loader
        if (typeof pdfjsLib === 'undefined') {
            throw new Error('PDF library not loaded. Please try again.');
        }

        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const textParts = [];

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
                .map(item => item.str)
                .join(' ');
            textParts.push(pageText);
        }

        return textParts.join('\n\n');
    },

    // ── DOCX Extraction using mammoth.js ─────
    async extractFromDOCX(file) {
        const arrayBuffer = await file.arrayBuffer();

        if (typeof mammoth === 'undefined') {
            throw new Error('DOCX library not loaded. Please try again.');
        }

        const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
        return result.value || '';
    },

    // ── DOC (legacy format) - basic extraction ─
    async extractFromDOC(file) {
        // .doc files are binary and hard to parse without a full library
        // We'll try to extract readable text from the binary
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let text = '';

        // Try to find readable ASCII text in the binary
        let currentWord = '';
        for (let i = 0; i < bytes.length; i++) {
            const byte = bytes[i];
            // Printable ASCII range
            if (byte >= 32 && byte <= 126) {
                currentWord += String.fromCharCode(byte);
            } else if (byte === 10 || byte === 13) {
                if (currentWord.length > 0) {
                    text += currentWord + '\n';
                    currentWord = '';
                }
            } else {
                if (currentWord.length > 2) {
                    text += currentWord + ' ';
                }
                currentWord = '';
            }
        }
        if (currentWord.length > 2) {
            text += currentWord;
        }

        // Clean up - remove very short "words" that are likely artifacts
        const lines = text.split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 3)
            .filter(l => {
                // Filter out lines that are mostly non-alpha characters
                const alphaCount = (l.match(/[a-zA-Z]/g) || []).length;
                return alphaCount > l.length * 0.4;
            });

        if (lines.length < 3) {
            throw new Error('Could not extract enough text from .doc file. Please save as .docx or .pdf and try again.');
        }

        return lines.join('\n');
    },

    // ── Plain text extraction ────────────────
    async extractFromText(file) {
        return await file.text();
    },

    // Format file size for display
    formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    },

    // Validate file before processing
    validate(file) {
        const errors = [];

        // Max 10MB
        if (file.size > 10 * 1024 * 1024) {
            errors.push('File is too large (max 10MB).');
        }

        if (!this.isSupported(file)) {
            errors.push(`Unsupported file type. Please use: ${this.SUPPORTED_EXTENSIONS.join(', ')}`);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
};

if (typeof window !== 'undefined') {
    window.FileParser = FileParser;
}
