require('dotenv').config();

const authenticateConnector = (req, res, next) => {
  const incomingKey = req.headers['x-connector-key'];
  if (!incomingKey) {
    return res.status(401).json({ success: false, error: 'Missing x-connector-key header' });
  }
  if (incomingKey !== process.env.CONNECTOR_SECRET_KEY) {
    return res.status(403).json({ success: false, error: 'Invalid connector key' });
  }
  next();
};

module.exports = { authenticateConnector };
