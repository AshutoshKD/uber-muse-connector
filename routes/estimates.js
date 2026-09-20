const express = require('express');
const router = express.Router();
const { uberClient, isSandbox, MOCK_PRODUCTS, MOCK_ESTIMATES } = require('../utils/uberClient');

/**
 * GET /estimates/price
 * Get price estimates between two locations
 *
 * Query params:
 *   start_lat, start_lng  — pickup coordinates
 *   end_lat, end_lng      — dropoff coordinates
 *
 * Muse calls this when user says:
 *   "How much will an Uber cost from Times Square to JFK?"
 */
router.get('/price', async (req, res) => {
  const { start_lat, start_lng, end_lat, end_lng } = req.query;

  if (!start_lat || !start_lng || !end_lat || !end_lng) {
    return res.status(400).json({
      success: false,
      error: 'Required: start_lat, start_lng, end_lat, end_lng',
    });
  }

  if (isSandbox()) {
    return res.json({
      success: true,
      mode: 'sandbox',
      prices: MOCK_ESTIMATES.prices,
      summary: 'UberX: $12-15 | UberXL: $18-22 | Uber Black: $35-42',
    });
  }

  try {
    const response = await uberClient.get('/estimates/price', {
      params: { start_latitude: start_lat, start_longitude: start_lng,
                end_latitude: end_lat, end_longitude: end_lng },
    });
    const prices = response.data.prices || [];
    return res.json({
      success: true,
      prices,
      summary: prices.map(p => `${p.display_name}: ${p.estimate}`).join(' | '),
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /estimates/time
 * Get ETA for available Uber products at a location
 *
 * Muse calls this when user says:
 *   "How long until an Uber arrives at my location?"
 */
router.get('/time', async (req, res) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ success: false, error: 'Required: lat, lng' });
  }

  if (isSandbox()) {
    return res.json({
      success: true,
      mode: 'sandbox',
      times: MOCK_ESTIMATES.times,
      summary: 'UberX: 3 mins | UberXL: 5 mins | Uber Black: 8 mins',
    });
  }

  try {
    const response = await uberClient.get('/estimates/time', {
      params: { start_latitude: lat, start_longitude: lng },
    });
    const times = response.data.times || [];
    return res.json({
      success: true,
      times,
      summary: times.map(t => `${t.display_name}: ${Math.round(t.estimate / 60)} mins`).join(' | '),
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /estimates/products
 * List all Uber ride types available at a location
 *
 * Muse calls this when user says:
 *   "What types of Uber can I book?"
 */
router.get('/products', async (req, res) => {
  const { lat, lng } = req.query;

  if (isSandbox()) {
    return res.json({ success: true, mode: 'sandbox', products: MOCK_PRODUCTS });
  }

  try {
    const response = await uberClient.get('/products', {
      params: { latitude: lat || 40.7128, longitude: lng || -74.0060 },
    });
    return res.json({ success: true, products: response.data.products || [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
