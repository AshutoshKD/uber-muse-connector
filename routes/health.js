const express = require('express');
const router = express.Router();
const { isSandbox } = require('../utils/uberClient');

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    connector: 'Uber for Muse',
    version: '1.0.0',
    environment: isSandbox() ? 'sandbox' : 'production',
    capabilities: [
      'get_ride_products',
      'get_price_estimate',
      'get_time_estimate',
      'request_ride',
      'track_ride',
      'cancel_ride',
      'get_ride_history',
    ],
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
