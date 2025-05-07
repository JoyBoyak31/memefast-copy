// proxy-server.js
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

// Create Express server
const app = express();

// Enable CORS for all requests
app.use(cors());

// Proxy endpoints
app.use('/api', createProxyMiddleware({
  target: 'https://frontend-api-v3.pump.fun',
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/' // Remove the /api prefix when forwarding the request
  },
  onProxyRes: function(proxyRes, req, res) {
    // Add CORS headers to the proxied response
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    proxyRes.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept';
  }
}));

// Default port for the proxy server
const PORT = process.env.PORT || 5000;

// Start the server
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
  console.log(`Use http://localhost:${PORT}/api/ to access the Pump.fun API`);
  console.log('Example: http://localhost:5000/api/coins/for-you?offset=0&limit=48&includeNsfw=false');
});