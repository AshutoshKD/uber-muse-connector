const axios = require('axios');
require('dotenv').config();

const BASE_URL = process.env.UBER_API_BASE_URL || 'https://api.uber.com/v1.2';

// Pre-configured Axios client for Uber API
const uberClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Authorization': `Token ${process.env.UBER_SERVER_TOKEN}`,
    'Content-Type': 'application/json',
    'Accept-Language': 'en_US',
  },
});

const isSandbox = () =>
  process.env.UBER_ENV !== 'production' ||
  !process.env.UBER_SERVER_TOKEN ||
  process.env.UBER_SERVER_TOKEN === 'your_uber_server_token_here';

// Mock data for sandbox mode
const MOCK_PRODUCTS = [
  {
    product_id: 'mock_uberx_001',
    display_name: 'UberX',
    description: 'Affordable, everyday rides',
    capacity: 4,
    image: 'https://d1a3f4spazzrp4.cloudfront.net/car-types/mono/mono-uberx.png',
    upfront_fare_enabled: true,
  },
  {
    product_id: 'mock_uberxl_002',
    display_name: 'UberXL',
    description: 'Affordable rides for groups up to 6',
    capacity: 6,
    image: 'https://d1a3f4spazzrp4.cloudfront.net/car-types/mono/mono-uberxl.png',
    upfront_fare_enabled: true,
  },
  {
    product_id: 'mock_black_003',
    display_name: 'Uber Black',
    description: 'Premium rides with professional drivers',
    capacity: 4,
    image: 'https://d1a3f4spazzrp4.cloudfront.net/car-types/mono/mono-black.png',
    upfront_fare_enabled: true,
  },
];

const MOCK_ESTIMATES = {
  prices: [
    {
      product_id: 'mock_uberx_001',
      display_name: 'UberX',
      estimate: '$12-15',
      low_estimate: 12,
      high_estimate: 15,
      currency_code: 'USD',
      duration: 900,   // seconds
      distance: 5.2,   // miles
      surge_multiplier: 1.0,
    },
    {
      product_id: 'mock_uberxl_002',
      display_name: 'UberXL',
      estimate: '$18-22',
      low_estimate: 18,
      high_estimate: 22,
      currency_code: 'USD',
      duration: 900,
      distance: 5.2,
      surge_multiplier: 1.0,
    },
    {
      product_id: 'mock_black_003',
      display_name: 'Uber Black',
      estimate: '$35-42',
      low_estimate: 35,
      high_estimate: 42,
      currency_code: 'USD',
      duration: 900,
      distance: 5.2,
      surge_multiplier: 1.2,
    },
  ],
  times: [
    { product_id: 'mock_uberx_001', display_name: 'UberX', estimate: 3 },
    { product_id: 'mock_uberxl_002', display_name: 'UberXL', estimate: 5 },
    { product_id: 'mock_black_003', display_name: 'Uber Black', estimate: 8 },
  ],
};

module.exports = { uberClient, isSandbox, MOCK_PRODUCTS, MOCK_ESTIMATES };
