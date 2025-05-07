// direct-pump-proxy.js with enhanced debugging and background refresh
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const WebSocket = require('ws');

// Create Express server
const app = express();

// Create HTTP server
const server = http.createServer(app);

// Create Socket.io server with CORS support
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for development
    methods: ['GET', 'POST']
  }
});

// Enable CORS for all requests
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Add detailed request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Mock data directory - create if doesn't exist
const MOCK_DATA_DIR = path.join(__dirname, 'mock-data');
if (!fs.existsSync(MOCK_DATA_DIR)) {
  fs.mkdirSync(MOCK_DATA_DIR, { recursive: true });
}

// Load mock tokens or use defaults
let mockTokens = [];
try {
  const mockDataPath = path.join(MOCK_DATA_DIR, 'trending-tokens.json');
  if (fs.existsSync(mockDataPath)) {
    mockTokens = JSON.parse(fs.readFileSync(mockDataPath, 'utf8'));
    console.log(`Loaded ${mockTokens.length} mock tokens from file`);
  } else {
    // Default mock tokens if file doesn't exist (simplified for brevity)
    mockTokens = [
      {
        mint: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        name: 'Solana',
        symbol: 'SOL',
        image: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
        price: 143.76,
        volume24h: 1245789,
        marketCap: 61530284800,
        supply: 435300000
      }
    ];
    // Save default tokens to file
    fs.writeFileSync(mockDataPath, JSON.stringify(mockTokens, null, 2));
  }
} catch (err) {
  console.error('Error loading mock data:', err);
}

// WebSocket state management
let pumpWebSocket = null;
let reconnectTimer = null;
let isConnectedToPump = false;
const watchedTokens = new Set();
const clients = new Map();

/**
 * Creates a client configured to properly access Pump.fun's API with debugging
 */
const createPumpFunClient = () => {
  return axios.create({
    baseURL: 'https://frontend-api-v3.pump.fun',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Origin': 'https://pump.fun',
      'Referer': 'https://pump.fun/',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    },
    timeout: 30000
  });
};

/**
 * Transform token data from Pump.fun API to the format expected by the frontend
 */
const transformTokenData = (token) => {
  if (!token) return null;

  // Calculate price from bonding curve if available
  let price = null;
  if (token.bonding_curve && token.bonding_curve.spot_price) {
    price = token.bonding_curve.spot_price;
  } else if (token.virtual_sol_reserves && token.virtual_token_reserves && 
             token.virtual_token_reserves > 0) {
    price = token.virtual_sol_reserves / token.virtual_token_reserves;
  }

  // Extract market cap from the appropriate field
  const marketCap = token.usd_market_cap || token.market_cap;

  return {
    ...token,  // Keep all original fields
    
    // Add the mapped fields expected by the frontend
    image: token.image_uri || token.image,
    marketCap: marketCap,
    price: price,
    supply: token.total_supply,
    
    // Add extra fields for debugging
    _originalMarketCap: token.market_cap,
    _originalUsdMarketCap: token.usd_market_cap,
    _originalImageUri: token.image_uri,
    _calculatedPrice: price
  };
};

/**
 * Fetch data directly from Pump.fun's API with enhanced debugging
 */
const fetchFromPumpFun = async (endpoint, params = {}) => {
  const client = createPumpFunClient();
  
  // Add a cache buster to ensure fresh data
  params._nocache = Date.now();
  
  try {
    console.log(`Fetching from Pump.fun: ${endpoint}`, params);
    const response = await client.get(endpoint, { params });
    
    if (response.data) {
      console.log(`Successfully received data from Pump.fun: ${endpoint}`);
      
      // Enhanced debugging - log the structure of the response
      console.log('Response structure:', Object.keys(response.data));
      
      // If it's an object with specific properties, log them for debugging
      if (typeof response.data === 'object' && !Array.isArray(response.data)) {
        console.log('Data preview:');
        if (response.data.name) console.log('- Name:', response.data.name);
        if (response.data.symbol) console.log('- Symbol:', response.data.symbol);
        if (response.data.price) console.log('- Price:', response.data.price);
        if (response.data.marketCap) console.log('- Market Cap:', response.data.marketCap);
        if (response.data.supply) console.log('- Supply:', response.data.supply);
        if (response.data.volume24h) console.log('- 24h Volume:', response.data.volume24h);
      }
      
      // If it's an array, log the length and first item structure
      if (Array.isArray(response.data) && response.data.length > 0) {
        console.log(`Received array with ${response.data.length} items`);
        console.log('First item structure:', Object.keys(response.data[0]));
        console.log('First item preview:', {
          name: response.data[0].name,
          symbol: response.data[0].symbol,
          price: response.data[0].price,
          marketCap: response.data[0].marketCap
        });
      }
      
      return response.data;
    }
    
    throw new Error('Empty response data');
  } catch (error) {
    console.error(`Error fetching from Pump.fun: ${error.message}`);
    
    // Enhanced error logging
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response data:`, error.response.data);
      console.error(`Response headers:`, error.response.headers);
    } else if (error.request) {
      console.error('No response received from request');
      console.error('Request details:', error.request);
    }
    
    throw error;
  }
};

/**
 * Fetch trending tokens directly from Pump.fun with enhanced debugging
 */
const fetchTrendingTokens = async (limit = 100) => {
  try {
    // Fetch trending tokens directly from Pump.fun
    const data = await fetchFromPumpFun('/coins/for-you', {
      offset: 0,
      limit,
      includeNsfw: false
    });
    
    if (data && Array.isArray(data)) {
      console.log(`Successfully fetched ${data.length} trending tokens`);
      
      // Enhanced debugging - log some sample data
      if (data.length > 0) {
        const sample = data[0];
        console.log('Sample token fields:', Object.keys(sample));
        console.log('Sample token data:');
        console.log('- Name:', sample.name);
        console.log('- Symbol:', sample.symbol);
        console.log('- Market Cap:', sample.marketCap);
        console.log('- Price:', sample.price);
        console.log('- Supply:', sample.supply);
        console.log('- Volume 24h:', sample.volume24h);
      }
      
      // Transform the data
      const transformedTokens = data.map(transformTokenData);
      
      // Save the data for fallback use
      fs.writeFileSync(
        path.join(MOCK_DATA_DIR, 'trending-tokens.json'),
        JSON.stringify(transformedTokens, null, 2)
      );
      
      return transformedTokens;
    }
    
    throw new Error('Invalid data format received from Pump.fun API');
  } catch (error) {
    console.error(`Error fetching trending tokens: ${error.message}`);
    
    // Try to load cached data as fallback
    try {
      const cachedData = JSON.parse(
        fs.readFileSync(path.join(MOCK_DATA_DIR, 'trending-tokens.json'), 'utf8')
      );
      
      console.log(`Using cached data with ${cachedData.length} tokens`);
      return cachedData;
    } catch (cacheError) {
      console.error(`Error loading cached data: ${cacheError.message}`);
      return [];
    }
  }
};

/**
 * Fetch token details directly from Pump.fun with enhanced debugging
 */
const fetchTokenDetails = async (tokenAddress) => {
  try {
    console.log(`Fetching details for token: ${tokenAddress} directly from Pump.fun`);
    
    // Make the direct request to Pump.fun's token details endpoint
    const data = await fetchFromPumpFun(`/coins/${tokenAddress}`);
    
    if (data) {
      console.log(`Successfully fetched details for token: ${tokenAddress}`);
      
      // Enhanced debugging - log the detailed token data
      console.log('Token details fields:', Object.keys(data));
      console.log('Token details:');
      console.log('- Name:', data.name);
      console.log('- Symbol:', data.symbol);
      console.log('- Market Cap:', data.marketCap);
      console.log('- Price:', data.price);
      console.log('- Supply:', data.supply);
      console.log('- Volume 24h:', data.volume24h);
      
      // Transform the data
      const transformedToken = transformTokenData(data);
      
      // Save to cache for future use
      const cacheFile = path.join(MOCK_DATA_DIR, `token-${tokenAddress}.json`);
      fs.writeFileSync(cacheFile, JSON.stringify(transformedToken, null, 2));
      
      return transformedToken;
    }
    
    throw new Error('Empty response from Pump.fun');
  } catch (error) {
    console.error(`Error fetching token details from Pump.fun: ${error.message}`);
    
    // Try to use cached data if available
    try {
      const cacheFile = path.join(MOCK_DATA_DIR, `token-${tokenAddress}.json`);
      if (fs.existsSync(cacheFile)) {
        const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        console.log(`Using cached data for token: ${tokenAddress}`);
        return cachedData;
      }
    } catch (cacheError) {
      console.error(`Error loading cached token data: ${cacheError.message}`);
    }
    
    // If all else fails, try to find in trending tokens
    try {
      const trendingFile = path.join(MOCK_DATA_DIR, 'trending-tokens.json');
      if (fs.existsSync(trendingFile)) {
        const trendingTokens = JSON.parse(fs.readFileSync(trendingFile, 'utf8'));
        const token = trendingTokens.find(t => t.mint === tokenAddress);
        if (token) {
          console.log(`Found token in trending data: ${tokenAddress}`);
          return token;
        }
      }
    } catch (trendingError) {
      console.error(`Error searching in trending tokens: ${trendingError.message}`);
    }
    
    return null;
  }
};

/**
 * Generate candlestick data for a token
 */
const generateCandlestickData = (tokenAddress, timeframe = 5, limit = 100) => {
  // Try to find token in our data to get base price
  const token = mockTokens.find(t => t.mint === tokenAddress);
  if (!token) {
    console.warn(`Token not found for candlestick generation: ${tokenAddress}`);
    return [];
  }

  console.log(`Generating candlestick data for token: ${token.name} (${token.symbol})`);

  const basePrice = token.price || 0.0001;
  const now = Date.now();
  const candlesticks = [];
  
  // Create realistic price movements with some trends
  let currentPrice = basePrice;
  for (let i = limit - 1; i >= 0; i--) {
    const time = now - (i * timeframe * 60 * 1000);
    
    // Add some randomness with mild trends
    const trend = Math.sin(i / 10) * 0.001 * basePrice;
    const random = (Math.random() - 0.5) * 0.002 * basePrice;
    
    // Price change from previous candle 
    currentPrice = Math.max(0.000001, currentPrice + trend + random);
    
    const open = currentPrice;
    const close = currentPrice * (1 + (Math.random() * 0.02 - 0.01));
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    
    candlesticks.push({
      time,
      open,
      high,
      low,
      close,
      volume: token.volume24h ? token.volume24h * (timeframe / 1440) * (1 + Math.random()) : 1000 * (1 + Math.random())
    });
  }
  
  return candlesticks;
};

// List of potential WebSocket URLs to try
const WS_URLS = [
  'wss://pumpportal.fun/api/data',  // From your logs, this connected briefly
  'wss://pump.fun/ws',              // The URL we tried before
  'wss://api.pump.fun/ws',          // Another possibility
  'wss://socket.pump.fun/websocket', // Another guess
  'wss://live.pump.fun/websocket'   // Another guess
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

// Connect to Pump.fun WebSocket
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

// Socket.io connection handling
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

/**
 * Periodically refresh token data in the background
 * Uses a staggered approach to avoid overwhelming the Pump.fun API
 */
function startBackgroundRefresh() {
  // Configuration
  const GLOBAL_REFRESH_INTERVAL = 60000; // Refresh all tokens every 60 seconds
  const BATCH_SIZE = 5; // Process 5 tokens at a time
  const BATCH_INTERVAL = 3000; // Wait 3 seconds between batches
  
  console.log(`Setting up background token refresh every ${GLOBAL_REFRESH_INTERVAL/1000} seconds`);
  
  // Tracking variables
  let allTokens = [];
  let currentBatchIndex = 0;
  let isProcessingBatch = false;
  let lastRefreshTime = null;
  
  // Function to fetch all trending tokens
  const refreshAllTokens = async () => {
    try {
      console.log('Background refresh: Fetching fresh token list...');
      
      // Update the complete list of tokens
      const tokens = await fetchTrendingTokens(100);
      
      if (tokens && tokens.length > 0) {
        allTokens = tokens;
        lastRefreshTime = new Date();
        console.log(`Background refresh: Updated token list with ${tokens.length} tokens`);
        return true;
      }
    } catch (error) {
      console.error('Error in global token refresh:', error);
    }
    return false;
  };
  
  // Function to process the next batch of tokens
  const processNextBatch = async () => {
    // Don't start a new batch if we're already processing
    if (isProcessingBatch || allTokens.length === 0) return;
    
    isProcessingBatch = true;
    
    // Calculate the end index for this batch
    const startIndex = currentBatchIndex;
    const endIndex = Math.min(startIndex + BATCH_SIZE, allTokens.length);
    const currentBatch = allTokens.slice(startIndex, endIndex);
    
    console.log(`Background refresh: Processing tokens ${startIndex} to ${endIndex-1}`);
    
    // Process each token in the batch
    for (const token of currentBatch) {
      try {
        const tokenAddress = token.mint || token.address;
        if (tokenAddress) {
          console.log(`Background refresh: Updating token ${tokenAddress}`);
          await fetchTokenDetails(tokenAddress);
        }
      } catch (error) {
        console.error(`Error refreshing token details:`, error.message);
      }
    }
    
    // Update the index for the next batch
    currentBatchIndex = endIndex >= allTokens.length ? 0 : endIndex;
    
    // Mark batch processing as complete
    isProcessingBatch = false;
  };
  
  // Set up timers
  
  // 1. Global refresh timer - refreshes the full token list periodically
  setInterval(async () => {
    await refreshAllTokens();
  }, GLOBAL_REFRESH_INTERVAL);
  
  // 2. Batch processing timer - processes token details in small batches
  setInterval(() => {
    processNextBatch();
  }, BATCH_INTERVAL);
  
  // Initial refresh
  refreshAllTokens();
}

// API Routes

// Trending tokens endpoint
app.get('/api/coins/for-you', async (req, res) => {
  const offset = parseInt(req.query.offset) || 0;
  const limit = parseInt(req.query.limit) || 48;
  
  console.log(`Processing trending tokens request: offset=${offset}, limit=${limit}`);
  
  try {
    const tokens = await fetchTrendingTokens(Math.max(limit + offset, 100));
    const paginatedTokens = tokens.slice(offset, offset + limit);
    res.json(paginatedTokens);
  } catch (error) {
    console.error(`Error in trending tokens endpoint: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch trending tokens' });
  }
});

// Token details endpoint
app.get('/api/coins/:tokenAddress', async (req, res) => {
  const { tokenAddress } = req.params;
  
  console.log(`Processing token details request: ${tokenAddress}`);
  
  try {
    // Fetch token details directly from Pump.fun
    const tokenDetails = await fetchTokenDetails(tokenAddress);
    
    if (tokenDetails) {
      // Return the transformed token
      res.json(tokenDetails);
    } else {
      res.status(404).json({ error: 'Token not found' });
    }
  } catch (error) {
    console.error(`Error in token details endpoint: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch token details' });
  }
});

// Search tokens endpoint
app.get('/api/coins/search', async (req, res) => {
  const query = req.query.q || '';
  const limit = parseInt(req.query.limit) || 48;
  
  console.log(`Processing search request: query=${query}, limit=${limit}`);
  
  try {
    // For now, we'll do a client-side search on our trending tokens
    const tokens = await fetchTrendingTokens(100);
    
    if (!query) {
      // Return all tokens if query is empty
      return res.json(tokens.slice(0, limit));
    }
    
    const lowercaseQuery = query.toLowerCase();
    const results = tokens.filter(token => 
      token.name?.toLowerCase().includes(lowercaseQuery) || 
      token.symbol?.toLowerCase().includes(lowercaseQuery)
    ).slice(0, limit);
    
    res.json(results);
  } catch (error) {
    console.error(`Error in search endpoint: ${error.message}`);
    res.status(500).json({ error: 'Failed to search tokens' });
  }
});

// Candlestick data endpoint for token price charts
app.get('/api/candlesticks/:tokenAddress', (req, res) => {
  const { tokenAddress } = req.params;
  const timeframe = parseInt(req.query.timeframe) || 5;
  const limit = parseInt(req.query.limit) || 100;
  
  console.log(`Processing candlesticks request: tokenAddress=${tokenAddress}, timeframe=${timeframe}, limit=${limit}`);
  
  try {
    // Generate candlestick data
    const candlesticks = generateCandlestickData(tokenAddress, timeframe, limit);
    
    if (candlesticks.length > 0) {
      res.json(candlesticks);
    } else {
      res.status(404).json({ 
        error: 'Failed to generate candlestick data',
        message: 'Could not find token information to base candlesticks on'
      });
    }
  } catch (error) {
    console.error(`Error processing candlesticks request: ${error.message}`);
    res.status(500).json({ 
      error: 'Failed to generate candlestick data',
      message: error.message
    });
  }
});

// Force refresh of cached data
app.get('/admin/force-fetch', async (req, res) => {
  try {
    console.log('Forcing refresh of token data from Pump.fun...');
    
    const tokens = await fetchTrendingTokens(100);
    
    if (tokens && tokens.length > 0) {
      res.json({
        success: true,
        message: `Successfully refreshed ${tokens.length} tokens from Pump.fun`,
        count: tokens.length,
        source: 'direct'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to refresh tokens from Pump.fun'
      });
    }
  } catch (error) {
    console.error(`Error in force refresh: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Error: ${error.message}`
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Direct Pump.fun API proxy is running',
    mockTokensCount: mockTokens.length,
    websocket: {
      connected: isConnectedToPump,
      url: isConnectedToPump ? WS_URLS[currentWsUrlIndex] : 'none',
      watchedTokensCount: watchedTokens.size,
      clientsCount: clients.size
    }
  });
});

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Direct Pump.fun API proxy running on port ${PORT}`);
  console.log(`REST API endpoint: http://localhost:${PORT}/api/`);
  console.log(`Socket.IO endpoint: ws://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  
  // Connect to Pump.fun WebSocket
  connectToPumpFun();
  
  // Start background refresh after 5 seconds
  setTimeout(() => {
    startBackgroundRefresh();
    
    // Start simulated updates if WebSocket connection fails
    if (!isConnectedToPump) {
      setTimeout(() => {
        if (!isConnectedToPump) {
          startSimulatedUpdates();
        }
      }, 30000); // Wait 30 seconds before starting simulations
    }
  }, 5000);
});