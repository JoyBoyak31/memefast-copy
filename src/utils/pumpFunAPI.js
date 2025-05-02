// src/utils/pumpFunAPI.js
import axios from 'axios';

// PumpPortal API is one of the most reliable unofficial APIs for Pump.fun
const API_BASE_URL = 'https://pumpportal.fun/api';

// Create axios instance with base configuration
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { 
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

/**
 * Fetch trending tokens from Pump.fun
 * @param {number} limit - Number of tokens to fetch
 * @returns {Promise<Array>} - Array of trending tokens
 */
export const fetchTrendingTokens = async (limit = 10) => {
  try {
    console.log('Fetching trending tokens from Pump.fun...');
    const response = await axiosInstance.get('/tokens/trending', { params: { limit } });
    console.log('Trending tokens response:', response.data);
    return response.data || [];
  } catch (error) {
    console.error('Error fetching trending tokens:', error.response || error.message || error);
    
    // Fallback for testing if API fails
    console.log('Using mock data as fallback');
    return mockTrendingTokens;
  }
};

/**
 * Fetch token details by address
 * @param {string} address - Token mint address
 * @returns {Promise<Object>} - Token details
 */
export const fetchTokenDetails = async (address) => {
  try {
    console.log(`Fetching details for token: ${address}`);
    const response = await axiosInstance.get(`/tokens/${address}`);
    console.log('Token details response:', response.data);
    return response.data || null;
  } catch (error) {
    console.error(`Error fetching token details for ${address}:`, error.response || error.message || error);
    
    // Return mock token if API fails
    const mockToken = mockTrendingTokens.find(token => token.address === address);
    if (mockToken) {
      return {
        ...mockToken,
        bondingCurve: {
          delta: 0.0001,
          fee: 0.01,
          spotPrice: mockToken.price,
          liquidity: mockToken.volume24h / mockToken.price,
          reserveAddress: 'So11111111111111111111111111111111111111112',
          reserveBalance: mockToken.volume24h * 0.2,
          reserveTokenMint: 'So11111111111111111111111111111111111111112'
        },
        metadata: {
          name: mockToken.name,
          symbol: mockToken.symbol,
          description: `Example ${mockToken.name} token`,
          imageUrl: mockToken.image
        }
      };
    }
    return null;
  }
};

/**
 * Fetch recent token creations
 * @param {number} limit - Number of tokens to fetch
 * @returns {Promise<Array>} - Array of recently created tokens
 */
export const fetchRecentTokens = async (limit = 10) => {
  try {
    const response = await axiosInstance.get('/tokens/recent', { params: { limit } });
    return response.data || [];
  } catch (error) {
    console.error('Error fetching recent tokens:', error.response || error.message || error);
    return [];
  }
};

/**
 * Search tokens by name or symbol
 * @param {string} query - Search query
 * @param {number} limit - Number of results to return
 * @returns {Promise<Array>} - Search results
 */
export const searchTokens = async (query, limit = 10) => {
  try {
    const response = await axiosInstance.get('/tokens/search', { params: { q: query, limit } });
    return response.data || [];
  } catch (error) {
    console.error('Error searching tokens:', error.response || error.message || error);
    
    // Filter mock tokens for testing
    if (query) {
      const lcQuery = query.toLowerCase();
      return mockTrendingTokens.filter(token => 
        token.name.toLowerCase().includes(lcQuery) || 
        token.symbol.toLowerCase().includes(lcQuery)
      ).slice(0, limit);
    }
    return [];
  }
};

// Mock data for fallback if API is unavailable
const mockTrendingTokens = [
  {
    address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    name: 'Solana',
    symbol: 'SOL',
    image: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    price: 0.0025,
    volume24h: 15000,
    marketCap: 2500000
  },
  {
    address: '9BWQX5J4iXzjVSKiGThRVjHjdVKKMYNVBfCPxwUaWYLF',
    name: 'Moo Deng',
    symbol: 'DENG',
    image: 'https://example.com/moodeng.png',
    price: 0.00043,
    volume24h: 22000,
    marketCap: 430000
  },
  {
    address: '3nJLGGYRrbfJThDePCvGkSWhYwMYYysPZYLVaFxd2XzA',
    name: 'Peanut',
    symbol: 'PNUT',
    image: 'https://example.com/peanut.png',
    price: 0.00018,
    volume24h: 35000,
    marketCap: 180000
  },
  {
    address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    name: 'Example Token',
    symbol: 'EX',
    price: 0.00015,
    volume24h: 5000,
    marketCap: 150000
  }
];

export default {
  fetchTrendingTokens,
  fetchTokenDetails,
  fetchRecentTokens,
  searchTokens
};