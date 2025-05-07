// server/pump-proxy.js - A proxy server that forwards requests to Pump.fun
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();

// Enable CORS for all routes
app.use(cors());

// Set up proxy middleware options
const options = {
  target: 'https://pump.fun', // Target host
  changeOrigin: true, // Needed for virtual hosted sites
  pathRewrite: {
    '^/pump-proxy': '', // Remove the path prefix when forwarding
  },
  onProxyRes: function(proxyRes, req, res) {
    // Modify response headers to allow embedding
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    proxyRes.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept';
    
    // Remove headers that might prevent embedding
    delete proxyRes.headers['x-frame-options'];
    delete proxyRes.headers['content-security-policy'];
    
    // Log successful proxy request
    console.log(`Proxied: ${req.method} ${req.path} -> ${proxyRes.statusCode}`);
  },
  onError: function(err, req, res) {
    console.error('Proxy error:', err);
    res.status(500).send('Proxy error: ' + err.message);
  },
  // Additional configuration for WebSocket support
  ws: true,
  secure: false, // Don't verify SSL certs (for development)
  headers: {
    // Spoof headers to look like a regular browser request
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Referer': 'https://pump.fun/'
  }
};

// Create the proxy middleware
const pumpFunProxy = createProxyMiddleware(options);

// Use the proxy for all routes starting with /pump-proxy
app.use('/pump-proxy', pumpFunProxy);

// Static assets
app.use(express.static('public'));

// Simple health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Pump.fun proxy server is running' });
});

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Pump.fun proxy server running on port ${PORT}`);
  console.log(`Access Pump.fun content at: http://localhost:${PORT}/pump-proxy/coins/for-you`);
});