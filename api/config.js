// api/config.js - expose only non-secret public config to frontend
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const appId = process.env.APP_ID || '';
  const configId = process.env.CONFIG_ID || '1889600718898450';
  const graphVersion = process.env.GRAPH_VERSION || 'v20.0';
  return res.status(200).json({
    appId,
    configId,
    graphVersion,
    version: 'definitive-clean-verification-pending'
  });
};
