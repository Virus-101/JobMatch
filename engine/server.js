// ============================================
// JobMatch AI — Auto-Apply Server
// Express API + WebSocket for real-time updates
// Dashboard connects here to control the engine
// ============================================

const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const fs = require('fs');

const engine = require('./apply-engine');
const browserManager = require('./browser');

const app = express();

// ── Security: the engine drives YOUR logged-in Chrome and can submit job
// applications, so the API must only be reachable from the local dashboard.
// 1) Bind to loopback only (see server.listen below) — no LAN/remote access.
// 2) Restrict CORS to localhost/127.0.0.1 origins (never a wildcard).
// 3) Guard state-changing routes against cross-site requests (CSRF): a
//    malicious page you visit could otherwise POST to /api/start. We reject
//    any request whose Origin/Referer isn't local.
const isLocalOrigin = (origin) => {
    if (!origin) return true; // non-browser tools (curl, the engine itself)
    try {
        const { hostname } = new URL(origin);
        return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
    } catch {
        return false;
    }
};

app.use(cors({
    origin: (origin, cb) => cb(null, isLocalOrigin(origin)),
}));
app.use(express.json());

// Reject cross-site state-changing requests (CSRF protection).
app.use((req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    const source = req.headers.origin || req.headers.referer;
    if (source && !isLocalOrigin(source)) {
        return res.status(403).json({ error: 'Cross-site requests are not allowed' });
    }
    next();
});

// Serve the dashboard
app.use(express.static(path.join(__dirname, '..', 'docs')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ── WebSocket: Real-time updates to dashboard ──
const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('[WS] Dashboard connected');

    // Send current status on connect
    ws.send(JSON.stringify({ event: 'connected', data: engine.getStatus() }));

    ws.on('close', () => clients.delete(ws));
});

function broadcast(payload) {
    const msg = JSON.stringify(payload);
    for (const ws of clients) {
        if (ws.readyState === 1) ws.send(msg);
    }
}

// Forward all engine events to WebSocket clients
engine.onUpdate((payload) => {
    broadcast(payload);
    console.log(`[Engine] ${payload.event}:`, JSON.stringify(payload.data).slice(0, 120));
});

// ── REST API ────────────────────────────────────

// GET /api/status — Engine status
app.get('/api/status', (req, res) => {
    res.json(engine.getStatus());
});

// POST /api/profile — Load profile data
app.post('/api/profile', (req, res) => {
    engine.loadProfile(req.body);
    res.json({ success: true, name: req.body.name });
});

// POST /api/configure — Update settings
app.post('/api/configure', (req, res) => {
    engine.configure(req.body);
    res.json({ success: true, settings: engine.settings });
});

// POST /api/start — Start auto-apply
app.post('/api/start', async (req, res) => {
    if (req.body.settings) engine.configure(req.body.settings);
    if (req.body.profile) engine.loadProfile(req.body.profile);

    res.json({ success: true, message: 'Auto-apply started' });

    // Run in background (non-blocking)
    engine.start().catch(err => {
        broadcast({ event: 'error', data: { message: err.message } });
    });
});

// POST /api/pause
app.post('/api/pause', (req, res) => {
    engine.pause();
    res.json({ success: true });
});

// POST /api/resume
app.post('/api/resume', (req, res) => {
    engine.resume();
    res.json({ success: true });
});

// POST /api/stop
app.post('/api/stop', async (req, res) => {
    await engine.stop();
    res.json({ success: true });
});

// POST /api/apply-url — Apply to a single URL
app.post('/api/apply-url', async (req, res) => {
    const { url, profile } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });

    try {
        const result = await engine.applyToUrl(url, profile);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/history — Application history
app.get('/api/history', (req, res) => {
    res.json(engine.getHistory());
});

// DELETE /api/history — Clear history
app.delete('/api/history', (req, res) => {
    engine.clearHistory();
    res.json({ success: true });
});

// GET /api/accounts — Check logged-in accounts
app.get('/api/accounts', async (req, res) => {
    try {
        await browserManager.launch();
        const accounts = await browserManager.detectAccounts();
        res.json(accounts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/close — Close browser
app.post('/api/close', async (req, res) => {
    await browserManager.close();
    res.json({ success: true });
});

// ── Start server ────────────────────────────────
const PORT = process.env.PORT || 3456;

server.listen(PORT, '127.0.0.1', () => {
    console.log('');
    console.log('╔═══════════════════════════════════════════╗');
    console.log('║    🚀 JobMatch AI — Auto-Apply Engine     ║');
    console.log('╠═══════════════════════════════════════════╣');
    console.log(`║  Dashboard:  http://localhost:${PORT}         ║`);
    console.log(`║  API:        http://localhost:${PORT}/api     ║`);
    console.log('║                                           ║');
    console.log('║  The engine connects to YOUR Chrome       ║');
    console.log('║  profile, so all your existing logins     ║');
    console.log('║  (LinkedIn, Indeed, etc.) are available.   ║');
    console.log('╚═══════════════════════════════════════════╝');
    console.log('');
});
