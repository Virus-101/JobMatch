// ============================================
// JobMatch AI — PDF.js Loader
// Loads pdf.js in a Chrome Extension context
// ============================================

(async function () {
    try {
        const pdfModule = await import(chrome.runtime.getURL('libs/pdf.min.mjs'));
        window.pdfjsLib = pdfModule;

        // Set worker source
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('libs/pdf.worker.min.mjs');

        console.log('[JobMatch AI] PDF.js loaded successfully');
    } catch (e) {
        console.warn('[JobMatch AI] PDF.js could not be loaded:', e.message);
        // Fallback: PDF upload will show an error message
    }
})();
