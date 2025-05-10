// unified-server.js - Combined REST API and WebSocket server
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const WebSocket = require('ws');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
    port: process.env.PORT || 10000, // Use the PORT env variable Render provides
    pumpFunBaseUrl: 'https://frontend-api-v3.pump.fun',
    wsUrls: [
        'wss://pumpportal.fun/api/data',
        'wss://pump.fun/ws',
        'wss://api.pump.fun/ws',
        'wss://socket.pump.fun/websocket',
        'wss://live.pump.fun/websocket'
    ],
    reconnectDelay: 5000,
    simulationDelay: 1500, // 1.5 seconds
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

// Create Express app
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
let currentWsUrlIndex = 0;

/**
 * Creates a client configured to properly access Pump.fun's API with debugging
 */
const createPumpFunClient = () => {
    return axios.create({
        baseURL: config.pumpFunBaseUrl,
        headers: {
            'User-Agent': config.userAgent,
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

// Connect to Pump.fun WebSocket (and other WebSocket functions)
// ... [Include your existing WebSocket code here]

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
app.get('/api/admin/force-fetch', async (req, res) => {
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
            url: isConnectedToPump ? config.wsUrls[currentWsUrlIndex] : 'none',
            watchedTokensCount: watchedTokens.size,
            clientsCount: clients.size
        }
    });
});

// Add a root route to serve basic HTML
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Memefast API Server</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                    line-height: 1.6;
                }
                h1 {
                    color: #3b82f6;
                }
                .endpoint {
                    background-color: #f3f4f6;
                    padding: 10px;
                    border-radius: 4px;
                    margin-bottom: 10px;
                }
                .method {
                    font-weight: bold;
                    color: #059669;
                }
                a {
                    color: #3b82f6;
                    text-decoration: none;
                }
                a:hover {
                    text-decoration: underline;
                }
            </style>
        </head>
        <body>
            <h1>Memefast API Server</h1>
            <p>This server provides access to Pump.fun token data. It's intended to be used as an API endpoint for the Memefast token explorer.</p>
            
            <h2>Available Endpoints:</h2>
            <div class="endpoint">
                <span class="method">GET</span> <a href="/api/coins/for-you">/api/coins/for-you</a> - Get trending tokens
            </div>
            <div class="endpoint">
                <span class="method">GET</span> <a href="/api/coins/search?q=solana">/api/coins/search?q=solana</a> - Search tokens
            </div>
            <div class="endpoint">
                <span class="method">GET</span> <a href="/api/coins/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU">/api/coins/:tokenAddress</a> - Get token details
            </div>
            <div class="endpoint">
                <span class="method">GET</span> <a href="/health">/health</a> - Server health check
            </div>
            
            <h2>Server Status:</h2>
            <p>The server is running on port: ${config.port}</p>
            <p>WebSocket connection: ${isConnectedToPump ? 'Connected' : 'Disconnected'}</p>
            <p>Cached tokens: ${mockTokens.length}</p>
        </body>
        </html>
    `);
});

// Start the server
server.listen(config.port, '0.0.0.0', () => {
    console.log(`Server running on port ${config.port}`);
    console.log(`REST API endpoint: http://localhost:${config.port}/api/`);
    console.log(`Health check: http://localhost:${config.port}/health`);
    console.log('Starting WebSocket connection...');
    
    // Add WebSocket functions here if needed
    
    // Fetch initial token data
    fetchTrendingTokens().then(() => {
        console.log('Initial token data fetched');
    }).catch(err => {
        console.error('Error fetching initial token data:', err);
    });
});
