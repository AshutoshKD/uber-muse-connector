require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { authenticateConnector } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { success: false, error: 'Too many requests, please try again later.' },
}));

// ── Public Routes ─────────────────────────────────────────────────
app.get('/', (req, res) => res.json({
  connector: 'Uber for Muse',
  description: 'Book Uber rides via Meta Muse natural language',
  version: '1.0.0',
  author: 'Ashutosh Dubey',
}));

app.get('/privacy', (req, res) => res.send(`
  <html><head><title>Privacy Policy — Uber for Muse</title></head>
  <body style="font-family:sans-serif;max-width:800px;margin:40px auto;padding:0 20px">
    <h1>Privacy Policy</h1><p><strong>Last updated:</strong> September 2026</p>
    <h2>Data we collect</h2>
    <p>This connector uses pickup/dropoff location coordinates to request Uber rides on your behalf. We do not store location data on our servers. All ride requests are processed directly through Uber's API.</p>
    <h2>Uber's Privacy Policy</h2>
    <p>All rides are processed by Uber. See <a href="https://www.uber.com/legal/en/document/?name=privacy-policy">Uber's Privacy Policy</a>.</p>
    <h2>Contact</h2><p>ashutosh.db.mail@gmail.com</p>
  </body></html>
`));

app.get('/terms', (req, res) => res.send(`
  <html><head><title>Terms — Uber for Muse</title></head>
  <body style="font-family:sans-serif;max-width:800px;margin:40px auto;padding:0 20px">
    <h1>Terms of Service</h1><p><strong>Last updated:</strong> September 2026</p>
    <p>By using this connector you agree to use it for legitimate ride booking purposes through Uber's platform. All rides are subject to <a href="https://www.uber.com/legal">Uber's Terms of Service</a>. Surge pricing confirmations require explicit user approval.</p>
  </body></html>
`));

app.use('/health', require('./routes/health'));

// ── OAuth Routes (public — user connects their Uber account) ──────
app.use('/auth', require('./routes/auth'));

// ── Protected Routes ──────────────────────────────────────────────
app.use('/estimates', authenticateConnector, require('./routes/estimates'));
app.use('/rides', authenticateConnector, require('./routes/rides'));

app.use((req, res) => res.status(404).json({ success: false, error: `Route ${req.path} not found` }));
app.use((err, req, res, next) => res.status(500).json({ success: false, error: 'Internal server error' }));

// Export for Vercel serverless
module.exports = app;

// Also listen locally when not on Vercel
if (process.env.NODE_ENV !== 'production' || process.env.IS_LOCAL) {
  app.listen(PORT, () => {
    const { isSandbox } = require('./utils/uberClient');
    console.log(`\n✅ Uber Muse Connector running on port ${PORT}`);
    console.log(`📍 Environment: ${isSandbox() ? 'SANDBOX (mock data)' : 'PRODUCTION'}`);
    console.log(`🔗 Health: http://localhost:${PORT}/health`);
    if (isSandbox()) console.log(`\n⚠️  Sandbox mode — add real Uber keys to .env to go live\n`);
  });
}
