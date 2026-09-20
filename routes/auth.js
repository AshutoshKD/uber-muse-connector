const router = require('express').Router();
const axios = require('axios');

const CLIENT_ID = process.env.UBER_CLIENT_ID;
const CLIENT_SECRET = process.env.UBER_CLIENT_SECRET;
const REDIRECT_URI = process.env.UBER_REDIRECT_URI || 'https://uber-muse-connector.vercel.app/auth/callback';

const UBER_AUTH_URL = 'https://login.uber.com/oauth/v2/authorize';
const UBER_TOKEN_URL = 'https://login.uber.com/oauth/v2/token';

// Scopes needed for ride booking on behalf of user
const SCOPES = ['profile', 'history', 'request', 'request_receipt'].join(' ');

// In-memory token store (maps state → token for short-lived sessions)
// In production: use Redis or a database
const tokenStore = {};

// ── Step 1: Redirect user to Uber login ──────────────────────────
// GET /auth/login?user_id=optional_user_id
router.get('/login', (req, res) => {
  const state = require('crypto').randomBytes(16).toString('hex');
  const userId = req.query.user_id || 'default';

  // Store state → userId mapping briefly
  tokenStore[state] = { userId, pending: true, created: Date.now() };

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: SCOPES,
    state,
    redirect_uri: REDIRECT_URI,
  });

  const authUrl = `${UBER_AUTH_URL}?${params.toString()}`;

  res.json({
    message: 'Redirect the user to this URL to connect their Uber account',
    auth_url: authUrl,
    state,
    scopes: SCOPES.split(' '),
    redirect_uri: REDIRECT_URI,
  });
});

// ── Step 2: Uber redirects back here with auth code ──────────────
// GET /auth/callback?code=xxx&state=yyy
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.status(400).json({ error: `Uber OAuth error: ${error}` });
  }

  if (!code || !state) {
    return res.status(400).json({ error: 'Missing code or state parameter' });
  }

  if (!tokenStore[state]) {
    return res.status(400).json({ error: 'Invalid or expired state parameter' });
  }

  try {
    // Exchange auth code for access token
    const response = await axios.post(UBER_TOKEN_URL,
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
        code,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token, expires_in, scope } = response.data;
    const userId = tokenStore[state]?.userId || 'default';

    // Store the token
    tokenStore[userId] = {
      access_token,
      refresh_token,
      expires_at: Date.now() + (expires_in * 1000),
      scope,
      connected_at: new Date().toISOString(),
    };

    // Clean up state
    delete tokenStore[state];

    res.json({
      success: true,
      message: 'Uber account connected successfully!',
      user_id: userId,
      access_token, // Return to Muse to store and pass back on requests
      scope: scope.split(' '),
      expires_in,
      note: 'Pass the access_token as Authorization: Bearer <token> header on ride requests',
    });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to exchange code for token',
      details: err.response?.data || err.message,
    });
  }
});

// ── Step 3: Check connection status ──────────────────────────────
// GET /auth/status
router.get('/status', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return res.json({
      connected: false,
      message: 'No Uber access token provided',
      how_to_connect: 'GET /auth/login to get the Uber OAuth URL',
    });
  }

  res.json({
    connected: true,
    message: 'Uber account is connected',
    note: 'Token provided — ride booking is available',
  });
});

// ── Token refresh ─────────────────────────────────────────────────
// POST /auth/refresh
router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ error: 'Missing refresh_token in body' });
  }

  try {
    const response = await axios.post(UBER_TOKEN_URL,
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    res.json({
      success: true,
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_in: response.data.expires_in,
    });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to refresh token',
      details: err.response?.data || err.message,
    });
  }
});

module.exports = router;
module.exports.tokenStore = tokenStore;
