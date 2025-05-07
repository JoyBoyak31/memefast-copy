// updated-websocket-proxy.js - Try multiple WebSocket URLs
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const WebSocket = require('ws');
const cors = require('cors');
const axios = require('axios');

// Create Express app
const app = express();
app.use(cors());

// Create HTTP server
const server = http.createServer(app);

// Create Socket.io server with CORS support
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for development
    methods: ['GET', 'POST']
  }
});

// Store connected clients and watched tokens
const clients = new Map();
let pumpWebSocket = null;
let reconnectTimer = null;
let isConnectedToPump = false;
const watchedTokens = new Set();

// List of potential WebSocket URLs to try
const WS_URLS = [
  'wss://pumpportal.fun/api/data',  // From your logs, this connected briefly
  'wss://pump.fun/ws',             // The URL we tried before
  'wss://api.pump.fun/ws',         // Another possibility
  'wss://socket.pump.fun/websocket', // Another guess
  'wss://live.pump.fun/websocket'  // Another guess
];

let currentWsUrlIndex = 0;

// Fetch WebSocket URL from Pump.fun website
async function discoverWebSocketUrl() {
  try {
    console.log('Attempting to discover WebSocket URL from Pump.fun website...');
    
    // Fetch the main page HTML
    const response = await axios.get('https://pump.fun/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    // Look for WebSocket related URLs in the HTML or JS
    const html = response.data;
    
    // Various patterns to search for
    const patterns = [
      /wss?:\/\/[^"']+?\/ws/g,         // Simple WebSocket URL
      /wss?:\/\/[^"']+?\/websocket/g,  // Alternate WebSocket URL format
      /wss?:\/\/[^"']+?\/socket\.io/g, // Socket.IO style WebSocket URL
      /wss?:\/\/[^"']+?\/api\/data/g   // The format from your logs
    ];
    
    let discoveredUrls = [];
    
    // Try to find WebSocket URLs in the HTML
    for (const pattern of patterns) {
      const matches = html.match(pattern);
      if (matches) {
        discoveredUrls = [...discoveredUrls, ...matches];
      }
    }
    
    if (discoveredUrls.length > 0) {
      console.log('Discovered potential WebSocket URLs:', discoveredUrls);
      // Add discovered URLs to the beginning of our list to try them first
      WS_URLS.unshift(...discoveredUrls.filter(url => !WS_URLS.includes(url)));
    } else {
      console.log('No WebSocket URLs discovered from website');
    }
  } catch (error) {
    console.error('Error discovering WebSocket URL:', error.message);
  }
}

// Connect to Pump.fun WebSocket using a URL from our list
async function connectToPumpFun() {
  if (pumpWebSocket) {
    pumpWebSocket.close();
    pumpWebSocket = null;
  }

  clearTimeout(reconnectTimer);
  
  // Try to discover WebSocket URL first
  await discoverWebSocketUrl();
  
  // Get the next URL to try from our list
  const wsUrl = WS_URLS[currentWsUrlIndex];
  console.log(`Connecting to Pump.fun WebSocket (Attempt ${currentWsUrlIndex + 1}/${WS_URLS.length}): ${wsUrl}`);

  try {
    // Try connection to current URL
    pumpWebSocket = new WebSocket(wsUrl);
    
    pumpWebSocket.on('open', () => {
      console.log(`Connected successfully to ${wsUrl}`);
      isConnectedToPump = true;
      
      // Reset URL index since we found a working one
      currentWsUrlIndex = WS_URLS.indexOf(wsUrl);
      
      // Notify all clients about successful connection
      io.emit('connectionStatus', { status: 'connected', url: wsUrl });
      
      // Try to subscribe to token creation events
      console.log('Sending subscription request...');
      try {
        // Try different subscription message formats
        const subscriptions = [
          { method: "subscribeNewToken" },
          { action: "subscribe", channel: "newToken" },
          { type: "subscribe", event: "token_created" },
          { subscribe: "token_updates" }
        ];
        
        // Send all subscription formats - one might work
        for (const sub of subscriptions) {
          pumpWebSocket.send(JSON.stringify(sub));
        }
        
        // Resubscribe to all watched tokens with different formats
        if (watchedTokens.size > 0) {
          const tokensArray = Array.from(watchedTokens);
          const tokenSubscriptions = [
            { method: "subscribeTokenTrade", keys: tokensArray },
            { action: "subscribe", tokens: tokensArray },
            { type: "subscribe", event: "token_trade", tokens: tokensArray },
            { subscribe: "token_trades", tokens: tokensArray }
          ];
          
          for (const sub of tokenSubscriptions) {
            pumpWebSocket.send(JSON.stringify(sub));
          }
          
          console.log(`Attempted to resubscribe to ${tokensArray.length} tokens`);
        }
      } catch (err) {
        console.error('Error sending subscription:', err);
      }
    });
    
    pumpWebSocket.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('Message from Pump.fun:', JSON.stringify(message).substring(0, 100) + '...');
        
        // Forward message to all connected clients
        io.emit('pumpMessage', message);
        
        // Also log subscription success messages
        if (message.message && message.message.includes('subscribed')) {
          console.log('Subscription confirmed:', message.message);
        }
      } catch (error) {
        console.error('Error parsing message from Pump.fun:', error);
      }
    });
    
    pumpWebSocket.on('close', (code, reason) => {
      console.log(`Disconnected from ${wsUrl}: ${code} ${reason || 'No reason provided'}`);
      isConnectedToPump = false;
      
      // Notify all clients about disconnection
      io.emit('connectionStatus', { status: 'disconnected', code, reason });
      
      // Try the next URL in our list
      currentWsUrlIndex = (currentWsUrlIndex + 1) % WS_URLS.length;
      
      // Attempt to reconnect after a delay
      reconnectTimer = setTimeout(() => {
        console.log('Attempting to reconnect with next URL...');
        connectToPumpFun();
      }, 5000);
    });
    
    pumpWebSocket.on('error', (error) => {
      console.error(`WebSocket error for ${wsUrl}:`, error.message);
      // Error is followed by a close event, so we'll handle reconnection there
    });
  } catch (error) {
    console.error('Error initializing WebSocket:', error.message);
    
    // Try the next URL immediately
    currentWsUrlIndex = (currentWsUrlIndex + 1) % WS_URLS.length;
    
    // And retry soon
    reconnectTimer = setTimeout(() => {
      console.log('Immediately trying next URL...');
      connectToPumpFun();
    }, 1000);
  }
}

// Simulate market update events for testing when not connected to real WebSocket
function startSimulatedUpdates() {
  if (isConnectedToPump) return; // Don't simulate if connected to real source
  
  console.log('Starting simulated market updates for testing...');
  
  // Generate sample data to simulate updates
  const tokenAddresses = Array.from(watchedTokens);
  if (tokenAddresses.length === 0) return;
  
  // Send a simulated update every few seconds
  setInterval(() => {
    // Pick a random token to update
    const tokenIndex = Math.floor(Math.random() * tokenAddresses.length);
    const tokenAddress = tokenAddresses[tokenIndex];
    
    // Create a simulated trade update
    const simulatedTradeUpdate = {
      type: 'tradeUpdate',
      trade: {
        mint: tokenAddress,
        tokenAmount: Math.random() * 1000000,
        txType: Math.random() > 0.5 ? 'buy' : 'sell',
        market_cap: Math.random() * 10000000,
        usd_market_cap: Math.random() * 10000000,
        virtual_sol_reserves: Math.random() * 1000,
        virtual_token_reserves: Math.random() * 1000000000
      }
    };
    
    console.log('Sending simulated update for token:', tokenAddress);
    io.emit('pumpMessage', simulatedTradeUpdate);
  }, 5000); // Every 5 seconds
}

// Begin Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  clients.set(socket.id, { socket, watchedTokens: new Set() });
  
  // Send current connection status to the new client
  socket.emit('connectionStatus', { 
    status: isConnectedToPump ? 'connected' : 'disconnected' 
  });
  
  // Handle client requesting to watch a token
  socket.on('watchToken', (tokenAddress) => {
    console.log(`Client ${socket.id} wants to watch token: ${tokenAddress}`);
    
    // Track which tokens this client is watching
    const clientData = clients.get(socket.id);
    if (clientData) {
      clientData.watchedTokens.add(tokenAddress);
    }
    
    // Add to global watched tokens
    watchedTokens.add(tokenAddress);
    
    // Subscribe to token if connected to Pump.fun
    if (isConnectedToPump && pumpWebSocket) {
      try {
        // Try different subscription formats
        const subscriptions = [
          { method: "subscribeTokenTrade", keys: [tokenAddress] },
          { action: "subscribe", tokens: [tokenAddress] },
          { type: "subscribe", event: "token_trade", tokens: [tokenAddress] },
          { subscribe: "token_trades", tokens: [tokenAddress] }
        ];
        
        for (const sub of subscriptions) {
          pumpWebSocket.send(JSON.stringify(sub));
        }
        
        console.log(`Attempted to subscribe to token: ${tokenAddress}`);
      } catch (error) {
        console.error(`Error subscribing to token ${tokenAddress}:`, error);
      }
    }
  });
  
  // Handle client requesting to unwatch a token
  socket.on('unwatchToken', (tokenAddress) => {
    console.log(`Client ${socket.id} no longer watching token: ${tokenAddress}`);
    
    // Remove from this client's watched tokens
    const clientData = clients.get(socket.id);
    if (clientData) {
      clientData.watchedTokens.delete(tokenAddress);
    }
    
    // Check if any other clients are still watching this token
    let isStillWatched = false;
    for (const [id, data] of clients.entries()) {
      if (id !== socket.id && data.watchedTokens.has(tokenAddress)) {
        isStillWatched = true;
        break;
      }
    }
    
    // If no one is watching, unsubscribe globally
    if (!isStillWatched) {
      watchedTokens.delete(tokenAddress);
      
      if (isConnectedToPump && pumpWebSocket) {
        try {
          pumpWebSocket.send(JSON.stringify({
            method: "unsubscribeTokenTrade",
            keys: [tokenAddress]
          }));
          console.log(`Unsubscribed from token: ${tokenAddress}`);
        } catch (error) {
          console.error(`Error unsubscribing from token ${tokenAddress}:`, error);
        }
      }
    }
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Get this client's watched tokens before removing
    const clientData = clients.get(socket.id);
    if (clientData) {
      // Check each token to see if others are still watching
      for (const tokenAddress of clientData.watchedTokens) {
        let isStillWatched = false;
        for (const [id, data] of clients.entries()) {
          if (id !== socket.id && data.watchedTokens.has(tokenAddress)) {
            isStillWatched = true;
            break;
          }
        }
        
        // If no one is watching, unsubscribe globally
        if (!isStillWatched) {
          watchedTokens.delete(tokenAddress);
          
          if (isConnectedToPump && pumpWebSocket) {
            try {
              pumpWebSocket.send(JSON.stringify({
                method: "unsubscribeTokenTrade",
                keys: [tokenAddress]
              }));
              console.log(`Unsubscribed from token: ${tokenAddress}`);
            } catch (error) {
              console.error(`Error unsubscribing from token ${tokenAddress}:`, error);
            }
          }
        }
      }
    }
    
    // Remove client from tracking
    clients.delete(socket.id);
  });
  
  // Handle manual reconnect request
  socket.on('reconnect', () => {
    console.log('Manual reconnect requested by client:', socket.id);
    connectToPumpFun();
  });
});

// Add a health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    websocket: {
      connected: isConnectedToPump,
      url: isConnectedToPump ? WS_URLS[currentWsUrlIndex] : 'none',
      watchedTokensCount: watchedTokens.size,
      clientsCount: clients.size
    }
  });
});

// Start the server
const PORT = process.env.PORT || 5001; // Use a different port from your REST server
server.listen(PORT, () => {
  console.log(`WebSocket proxy server running on port ${PORT}`);
  console.log(`Socket.IO endpoint: ws://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  
  // Connect to Pump.fun WebSocket
  connectToPumpFun();
  
  // Start simulated updates if unable to connect to real WebSocket after a delay
  setTimeout(() => {
    if (!isConnectedToPump) {
      startSimulatedUpdates();
    }
  }, 30000); // Wait 30 seconds before starting simulations
});