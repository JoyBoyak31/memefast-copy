// server/ssr-pump-proxy.js
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');
const WebSocket = require('ws');

const app = express();
const port = process.env.PORT || 3002;

// Enable CORS
app.use(cors());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Create a map to store WebSocket connections for each client
const clientSockets = new Map();

// Setup WebSocket server for real-time updates
const wss = new WebSocket.Server({ noServer: true });

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  const clientId = req.url.split('/').pop(); // Extract client ID from URL
  
  console.log(`WebSocket connected for client: ${clientId}`);
  
  // Store the WebSocket connection for this client
  clientSockets.set(clientId, ws);
  
  // Handle messages from the client
  ws.on('message', (message) => {
    console.log(`Received message from client ${clientId}: ${message}`);
    
    // Parse the message
    try {
      const parsedMessage = JSON.parse(message);
      
      if (parsedMessage.type === 'watchToken') {
        // Handle token watch request
        const tokenAddress = parsedMessage.tokenAddress;
        // Here you would set up watching this token with Pump.fun's WebSocket
        console.log(`Client ${clientId} is now watching token: ${tokenAddress}`);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  });
  
  // Handle WebSocket close
  ws.on('close', () => {
    console.log(`WebSocket closed for client: ${clientId}`);
    clientSockets.delete(clientId);
  });
});

// Connect to Pump.fun's WebSocket for real-time updates
let pumpWebSocket = null;

function connectToPumpFunWebSocket() {
  // Try to connect to Pump.fun's WebSocket
  try {
    pumpWebSocket = new WebSocket('wss://pumpportal.fun/api/data');
    
    pumpWebSocket.on('open', () => {
      console.log('Connected to Pump.fun WebSocket');
      
      // Subscribe to new token events
      pumpWebSocket.send(JSON.stringify({
        method: "subscribeNewToken"
      }));
    });
    
    pumpWebSocket.on('message', (data) => {
      // Forward message to all connected clients
      const message = data.toString();
      console.log('Received message from Pump.fun:', message.substring(0, 100) + '...');
      
      clientSockets.forEach((ws, clientId) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    });
    
    pumpWebSocket.on('close', () => {
      console.log('Disconnected from Pump.fun WebSocket');
      setTimeout(connectToPumpFunWebSocket, 5000); // Reconnect after 5 seconds
    });
    
    pumpWebSocket.on('error', (error) => {
      console.error('Pump.fun WebSocket error:', error);
    });
  } catch (error) {
    console.error('Error connecting to Pump.fun WebSocket:', error);
    setTimeout(connectToPumpFunWebSocket, 5000); // Try again after 5 seconds
  }
}

// Connect to Pump.fun's WebSocket
connectToPumpFunWebSocket();

// Helper function to transform Pump.fun HTML for embedding
async function transformPumpFunHtml(html, targetPath) {
  try {
    // Load HTML into cheerio
    const $ = cheerio.load(html);
    
    // Remove Pump.fun header, footer, nav, etc.
    $('header, nav, footer, .navbar, .footer').remove();
    
    // Fix all URLs to point to our proxy
    $('[href], [src]').each((index, element) => {
      const el = $(element);
      
      // Fix href attributes
      if (el.attr('href')) {
        let href = el.attr('href');
        if (href.startsWith('/')) {
          // Convert relative URLs to absolute with our proxy
          el.attr('href', `/pump-proxy${href}`);
        } else if (href.startsWith('https://pump.fun')) {
          // Convert Pump.fun URLs to our proxy
          el.attr('href', `/pump-proxy${href.substring('https://pump.fun'.length)}`);
        }
      }
      
      // Fix src attributes
      if (el.attr('src')) {
        let src = el.attr('src');
        if (src.startsWith('/')) {
          // Convert relative URLs to absolute with our proxy
          el.attr('src', `/pump-proxy${src}`);
        } else if (src.startsWith('https://pump.fun')) {
          // Convert Pump.fun URLs to our proxy
          el.attr('src', `/pump-proxy${src.substring('https://pump.fun'.length)}`);
        }
      }
    });
    
    // Add our custom styling
    $('head').append(`
      <style>
        /* Custom styles to integrate with your site */
        body { 
          margin: 0; 
          padding: 0; 
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
        }
        /* Adjust the main content area */
        main, .main-content, .container { 
          padding: 0 !important; 
          margin: 0 !important; 
          width: 100% !important; 
        }
        /* Additional custom styles */
        .token-card {
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          margin-bottom: 16px;
        }
      </style>
    `);
    
    // Add our WebSocket connection script
    $('body').append(`
      <script>
        // Connect to our WebSocket proxy
        const clientId = Math.random().toString(36).substring(2, 15);
        const ws = new WebSocket('ws://' + window.location.host + '/ws/' + clientId);
        
        ws.onopen = function() {
          console.log('Connected to WebSocket proxy');
        };
        
        ws.onmessage = function(event) {
          const message = JSON.parse(event.data);
          console.log('Received message:', message);
          
          // Process WebSocket messages and update the UI
          if (message.type === 'tokenUpdate') {
            updateTokenData(message.token);
          } else if (message.type === 'tradeUpdate') {
            updateTokenTrade(message.trade);
          } else if (message.type === 'newToken') {
            addNewToken(message.token);
          }
        };
        
        ws.onclose = function() {
          console.log('Disconnected from WebSocket proxy');
          // Try to reconnect after a delay
          setTimeout(function() {
            console.log('Reconnecting...');
            // Reload page to reconnect
            window.location.reload();
          }, 5000);
        };
        
        // Function to watch a specific token
        function watchToken(tokenAddress) {
          console.log('Watching token:', tokenAddress);
          ws.send(JSON.stringify({
            type: 'watchToken',
            tokenAddress: tokenAddress
          }));
        }
        
        // Functions to update the UI with new data
        function updateTokenData(token) {
          // Find and update the token card
          const tokenElement = document.querySelector('[data-token-address="' + token.mint + '"]');
          if (tokenElement) {
            // Update price, market cap, etc.
            console.log('Updating token:', token.name);
          }
        }
        
        function updateTokenTrade(trade) {
          // Find and update the token card
          const tokenElement = document.querySelector('[data-token-address="' + trade.mint + '"]');
          if (tokenElement) {
            // Update based on trade data
            console.log('Updating trade for token:', trade.mint);
          }
        }
        
        function addNewToken(token) {
          console.log('New token created:', token.name);
          // Add the new token to the list
          // This would require manipulating the DOM to insert a new token card
        }
        
        // Watch all currently displayed tokens
        document.addEventListener('DOMContentLoaded', function() {
          // Find all token cards and watch them
          const tokenCards = document.querySelectorAll('[data-token-address]');
          tokenCards.forEach(function(card) {
            const tokenAddress = card.getAttribute('data-token-address');
            if (tokenAddress) {
              watchToken(tokenAddress);
            }
          });
        });
      </script>
    `);
    
    // Return the transformed HTML
    return $.html();
  } catch (error) {
    console.error('Error transforming HTML:', error);
    throw error;
  }
}

// Proxy API endpoint to fetch tokens
app.get('/api/coins/:endpoint', async (req, res) => {
  try {
    const { endpoint } = req.params;
    const queryParams = req.query;
    
    // Build the Pump.fun API URL
    let url = `https://frontend-api-v3.pump.fun/coins/${endpoint}`;
    
    // Add query parameters if present
    if (Object.keys(queryParams).length > 0) {
      const queryString = new URLSearchParams(queryParams).toString();
      url += `?${queryString}`;
    }
    
    console.log(`Proxying API request to: ${url}`);
    
    // Fetch from Pump.fun API
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Origin': 'https://pump.fun',
        'Referer': 'https://pump.fun/'
      }
    });
    
    // Return the response
    res.json(response.data);
  } catch (error) {
    console.error('Error proxying API request:', error);
    res.status(500).json({ error: 'Failed to fetch from Pump.fun API' });
  }
});

// Proxy routes to fetch and transform Pump.fun HTML
app.get('/pump-proxy/*', async (req, res) => {
  try {
    // Extract the target path
    const targetPath = req.path.replace('/pump-proxy', '');
    
    // Build the Pump.fun URL
    const url = `https://pump.fun${targetPath}`;
    
    console.log(`Proxying request to: ${url}`);
    
    // Fetch from Pump.fun
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    
    // Transform the HTML
    const transformedHtml = await transformPumpFunHtml(response.data, targetPath);
    
    // Send the transformed HTML
    res.send(transformedHtml);
  } catch (error) {
    console.error('Error proxying request:', error);
    res.status(500).send(`
      <html>
        <head>
          <title>Error</title>
          <style>
            body {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              text-align: center;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
            }
            h1 { color: #b91c1c; }
            .error-message {
              background-color: #fee2e2;
              padding: 20px;
              border-radius: 8px;
              margin-top: 20px;
            }
            button {
              background-color: #3b82f6;
              color: white;
              border: none;
              border-radius: 6px;
              padding: 8px 16px;
              font-size: 14px;
              cursor: pointer;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <h1>Error Loading Pump.fun Content</h1>
          <p>Sorry, we couldn't load the requested content from Pump.fun.</p>
          <div class="error-message">
            <strong>Error:</strong> ${error.message}
          </div>
          <button onclick="window.location.reload()">Try Again</button>
        </body>
      </html>
    `);
  }
});

// Main page that embeds the proxied Pump.fun trending page
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Pump.fun Integration</title>
        <style>
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f9fafb;
          }
          .container {
            max-width: 1200px;
            margin: 0 auto;
          }
          header {
            margin-bottom: 20px;
            text-align: center;
          }
          h1 {
            color: #111827;
          }
          .pump-fun-embed {
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            background-color: white;
          }
          iframe {
            width: 100%;
            height: 800px;
            border: none;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <header>
            <h1>Trending Tokens</h1>
            <p>Live token data from Pump.fun</p>
          </header>
          
          <div class="pump-fun-embed">
            <iframe src="/pump-proxy/coins/for-you" frameborder="0"></iframe>
          </div>
        </div>
      </body>
    </html>
  `);
});

// Attach WebSocket server to HTTP server
const server = app.listen(port, () => {
  console.log(`Server-side rendering proxy running on port ${port}`);
  console.log(`Access the proxy at: http://localhost:${port}`);
});

// Handle upgrade requests for WebSockets
server.on('upgrade', (request, socket, head) => {
  // Extract the path from the URL
  const pathname = request.url;
  
  // Check if this is a WebSocket request to our endpoint
  if (pathname.startsWith('/ws/')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    // Not a WebSocket request for us, close the connection
    socket.destroy();
  }
});