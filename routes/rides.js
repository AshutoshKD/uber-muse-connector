const express = require('express');
const router = express.Router();
const axios = require('axios');
const { uberClient, isSandbox } = require('../utils/uberClient');

// Helper: get user OAuth client if Bearer token is provided
const getUserClient = (req) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return null;
  return axios.create({
    baseURL: process.env.UBER_API_BASE_URL || 'https://api.uber.com/v1.2',
    headers: { Authorization: `Bearer ${token}` },
    timeout: 10000,
  });
};

// In-memory ride store for sandbox mode
const sandboxRides = new Map();

/**
 * POST /rides/request
 * Request an Uber ride
 *
 * Body:
 *   product_id    (required) — from /estimates/products
 *   start_lat     (required) — pickup latitude
 *   start_lng     (required) — pickup longitude
 *   end_lat       (required) — dropoff latitude
 *   end_lng       (required) — dropoff longitude
 *   start_address (optional) — human readable pickup
 *   end_address   (optional) — human readable dropoff
 *   surge_confirm (optional) — set true to confirm surge pricing
 *
 * Muse calls this when user says:
 *   "Book me an UberX from Times Square to JFK airport"
 */
router.post('/request', async (req, res) => {
  const {
    product_id = 'mock_uberx_001',
    start_lat, start_lng,
    end_lat, end_lng,
    start_address, end_address,
    surge_confirm = false,
  } = req.body;

  if (!start_lat || !start_lng || !end_lat || !end_lng) {
    return res.status(400).json({
      success: false,
      error: 'Required: start_lat, start_lng, end_lat, end_lng',
    });
  }

  if (isSandbox()) {
    const rideId = `ride_${Date.now()}`;
    const ride = {
      request_id: rideId,
      product_id,
      status: 'processing',
      driver: {
        name: 'Rajesh Kumar',
        rating: 4.9,
        picture_url: null,
        phone_number: '+1 (555) 000-0000',
      },
      vehicle: {
        make: 'Toyota',
        model: 'Camry',
        license_plate: 'ABC 1234',
        picture_url: null,
      },
      pickup: { latitude: start_lat, longitude: start_lng, address: start_address || 'Pickup Location' },
      destination: { latitude: end_lat, longitude: end_lng, address: end_address || 'Dropoff Location' },
      eta: 4,
      surge_multiplier: 1.0,
      booked_at: new Date().toISOString(),
    };
    sandboxRides.set(rideId, ride);
    return res.json({
      success: true,
      mode: 'sandbox',
      message: `✅ UberX booked! Driver Rajesh is 4 mins away. Vehicle: Toyota Camry (ABC 1234)`,
      ride,
    });
  }

  // Use user's OAuth token (required for real ride booking)
  const userClient = getUserClient(req);
  if (!userClient) {
    return res.status(401).json({
      error: 'User Uber account not connected',
      message: 'User must authenticate with Uber first to book real rides',
      how_to_connect: 'Call GET /auth/login to get the OAuth URL, redirect the user, then pass their access_token as: Authorization: Bearer <token>',
    });
  }

  try {
    const response = await userClient.post('/requests', {
      product_id,
      start_latitude: parseFloat(start_lat),
      start_longitude: parseFloat(start_lng),
      end_latitude: parseFloat(end_lat),
      end_longitude: parseFloat(end_lng),
      surge_confirmation_id: surge_confirm || undefined,
    });
    return res.json({
      success: true,
      message: `✅ Ride booked! Your driver is on the way.`,
      ride: response.data,
    });
  } catch (err) {
    // Handle surge pricing — ask user to confirm
    if (err.response?.status === 409) {
      return res.status(409).json({
        success: false,
        surge: true,
        surge_multiplier: err.response.data?.meta?.surge_multiplier,
        surge_confirmation_id: err.response.data?.meta?.surge_confirmation_id,
        message: `⚡ Surge pricing active (${err.response.data?.meta?.surge_multiplier}x). Reply "confirm surge" to proceed.`,
      });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /rides/current
 * Track your current active Uber ride
 *
 * Muse calls this when user says:
 *   "Where is my Uber right now?"
 *   "How far away is my driver?"
 */
router.get('/current', async (req, res) => {
  if (isSandbox()) {
    const lastRide = [...sandboxRides.values()].pop();
    if (!lastRide) {
      return res.json({ success: true, mode: 'sandbox', active_ride: null, message: 'No active ride' });
    }
    return res.json({
      success: true,
      mode: 'sandbox',
      active_ride: { ...lastRide, status: 'accepted', eta: 2 },
      message: '🚗 Driver Rajesh is 2 mins away — Toyota Camry (ABC 1234)',
    });
  }

  try {
    const response = await uberClient.get('/requests/current');
    const ride = response.data;
    return res.json({
      success: true,
      active_ride: ride,
      message: ride
        ? `🚗 Your driver is ${ride.eta} mins away`
        : 'No active ride',
    });
  } catch (err) {
    if (err.response?.status === 404) {
      return res.json({ success: true, active_ride: null, message: 'No active ride' });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /rides/cancel
 * Cancel the current Uber ride
 *
 * Muse calls this when user says:
 *   "Cancel my Uber"
 */
router.delete('/cancel', async (req, res) => {
  if (isSandbox()) {
    const lastRide = [...sandboxRides.values()].pop();
    if (lastRide) lastRide.status = 'cancelled';
    return res.json({
      success: true,
      mode: 'sandbox',
      message: '✅ Your Uber has been cancelled.',
    });
  }

  try {
    await uberClient.delete('/requests/current');
    return res.json({ success: true, message: '✅ Your Uber has been cancelled.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /rides/history
 * Get past Uber rides
 *
 * Muse calls this when user says:
 *   "Show me my recent Uber rides"
 *   "How much did I spend on Uber last month?"
 */
router.get('/history', async (req, res) => {
  const { limit = 5 } = req.query;

  if (isSandbox()) {
    return res.json({
      success: true,
      mode: 'sandbox',
      rides: [
        { request_id: 'hist_001', status: 'completed', start_city: { display_name: 'New York' }, distance: 5.2, duration: 18, fare: { value: 14.50, currency_code: 'USD' } },
        { request_id: 'hist_002', status: 'completed', start_city: { display_name: 'New York' }, distance: 2.1, duration: 9, fare: { value: 8.75, currency_code: 'USD' } },
      ],
    });
  }

  try {
    const response = await uberClient.get('/history', { params: { limit } });
    return res.json({ success: true, rides: response.data.history || [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
