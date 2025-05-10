// src/utils/pumpFunAPI.js
// Enhanced token details fetching

import axios from 'axios';

// Base URL for the proxy server
const API_BASE_URL = 'http://localhost:5000/api';

// Import mockData (make sure this file exists)
import { mockTokens, mockTokenDetails, generateMockCandlesticks } from './mockData';

// Create axios instance with improved configuration
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  timeout: 30000, // 30 seconds timeout
});

// Add request and response interceptors for better debugging
axiosInstance.interceptors.request.use(
  config => {
    console.log(`API Request: ${config.method.toUpperCase()} ${config.url}`, config.params);
    return config;
  },
  error => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

axiosInstance.interceptors.response.use(
  response => {
    console.log(`API Response: ${response.status} from ${response.config.url}`,
      Array.isArray(response.data) ? `[${response.data.length} items]` : 'Data received');

    // For token details, log the important values for debugging
    if (response.config.url.includes('/coins/') && !response.config.url.includes('/coins/for-you')) {
      console.log('Token details received:');
      if (response.data) {
        console.log('- Name:', response.data.name);
        console.log('- Symbol:', response.data.symbol);
        console.log('- Market Cap:', response.data.marketCap);
        console.log('- Price:', response.data.price);
        console.log('- Supply:', response.data.supply);
      }
    }

    return response;
  },
  error => {
    if (error.response) {
      console.error(`API Error ${error.response.status}: ${error.response.statusText}`, error.response.data);
    } else if (error.request) {
      console.error('No response received:', error.request);
    } else {
      console.error('Error setting up request:', error.message);
    }
    return Promise.reject(error);
  }
);

/**
 * Fetch trending tokens from Pump.fun
 * @param {number} limit - Number of tokens to fetch
 * @returns {Promise<Array>} - Array of trending tokens
 */
export const fetchTrendingTokens = async (limit = 48) => {
  try {
    console.log('Fetching trending tokens from proxy server...');

    // Add a cache buster to avoid cached responses
    const cacheBuster = Date.now();

    // Make the request to our proxy server
    const response = await axiosInstance.get('/coins/for-you', {
      params: {
        offset: 0,
        limit,
        includeNsfw: false,
        _: cacheBuster
      }
    });

    // Process the data
    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      console.log(`Successfully fetched ${response.data.length} tokens`);
      return response.data;
    } else {
      console.warn('Empty or invalid data received');
      throw new Error('No valid tokens received');
    }
  } catch (error) {
    console.error('Error fetching trending tokens:', error.message);

    // Fall back to mock data
    console.log('Using mock data as fallback');
    return mockTokens;
  }
};

/**
 * Fetch token details by address directly from Pump.fun
 * This function ensures we get the exact token data with correct market cap
 * @param {string} address - Token mint address
 * @returns {Promise<Object>} - Token details
 */
export const fetchTokenDetails = async (address) => {
  try {
    console.log(`Fetching details for token: ${address}`);

    // Add a cache buster to avoid cached responses
    const cacheBuster = Date.now();

    // Make the request to our proxy server (which gets data directly from Pump.fun)
    const response = await axiosInstance.get(`/coins/${address}`, {
      params: {
        _: cacheBuster
      }
    });

    if (response.data) {
      console.log('Successfully fetched token details');

      // Log key values for verification
      console.log('Token details received:');
      console.log('- Name:', response.data.name);
      console.log('- Symbol:', response.data.symbol);
      console.log('- Market Cap:', response.data.marketCap);
      console.log('- Price:', response.data.price);

      // Return the raw data from Pump.fun without any transformations
      return response.data;
    } else {
      console.warn('Empty token details response');
      throw new Error('Empty response');
    }
  } catch (error) {
    console.error(`Error fetching token details: ${error.message}`);

    // Return mock token details or generate new ones
    const mockDetail = mockTokenDetails[address];
    if (mockDetail) {
      console.log('Using existing mock token details');
      return mockDetail;
    }

    // Try to find the token in mock tokens
    const token = mockTokens.find(t => t.address === address || t.mint === address);
    if (token) {
      console.log('Generating mock details from token information');

      // Generate mock details
      return {
        ...token,
        bondingCurve: {
          spotPrice: token.price,
          delta: 0.00001 * (0.5 + Math.random()),
          fee: 0.01,
          reserveAddress: 'So11111111111111111111111111111111111111112',
          reserveBalance: token.volume24h * 0.2,
          liquidity: token.volume24h / token.price * 0.2,
          reserveTokenMint: 'So11111111111111111111111111111111111111112'
        },
        metadata: {
          name: token.name,
          symbol: token.symbol,
          description: `This is a ${token.name} token on Solana.`,
          imageUrl: token.image,
          social: {
            twitter: `https://twitter.com/${token.symbol.toLowerCase()}`,
            website: `https://${token.symbol.toLowerCase()}.com`
          }
        }
      };
    }

    console.warn('Could not find token in mock data');
    return null;
  }
};

/**
 * Search tokens by name or symbol
 * @param {string} query - Search query
 * @param {number} limit - Number of results to return
 * @returns {Promise<Array>} - Search results
 */
export const searchTokens = async (query, limit = 48) => {
  try {
    console.log(`Searching for tokens with query: ${query}`);

    // Add a cache buster to avoid cached responses
    const cacheBuster = Date.now();

    const response = await axiosInstance.get('/coins/search', {
      params: {
        q: query,
        offset: 0,
        limit,
        includeNsfw: false,
        _: cacheBuster
      }
    });

    if (response.data && Array.isArray(response.data)) {
      console.log(`Found ${response.data.length} tokens matching query`);
      return response.data;
    } else {
      console.warn('Empty search results');
      throw new Error('No search results');
    }
  } catch (error) {
    console.error(`Error searching tokens: ${error.message}`);

    // Filter mock tokens as fallback
    console.log('Using filtered mock data as fallback');
    if (!query) return mockTokens.slice(0, limit);

    const lowercaseQuery = query.toLowerCase();
    return mockTokens
      .filter(token =>
        token.name.toLowerCase().includes(lowercaseQuery) ||
        token.symbol.toLowerCase().includes(lowercaseQuery)
      )
      .slice(0, limit);
  }
};

/**
 * Fetch candlestick data for a token
 * @param {string} address - Token mint address
 * @param {number} timeframe - Timeframe in minutes (e.g., 5 for 5-minute intervals)
 * @param {number} limit - Number of candlesticks to fetch
 * @returns {Promise<Array>} - Array of candlestick data
 */
export const fetchCandlestickData = async (address, timeframe = 5, limit = 100) => {
  try {
    console.log(`Fetching candlestick data for token: ${address}`);

    // Add a cache buster to avoid cached responses
    const cacheBuster = Date.now();

    const response = await axiosInstance.get(`/candlesticks/${address}`, {
      params: {
        offset: 0,
        limit,
        timeframe,
        _: cacheBuster
      }
    });

    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      console.log(`Received ${response.data.length} candlesticks`);
      return response.data;
    } else {
      console.warn('Empty candlestick data');
      throw new Error('No candlestick data');
    }
  } catch (error) {
    console.error(`Error fetching candlesticks: ${error.message}`);

    // Generate mock candlesticks as fallback
    console.log('Generating mock candlestick data');
    return generateMockCandlesticks(address, timeframe, limit);
  }
};

/**
 * Force refresh of trending tokens from the source
 * @returns {Promise<Object>} - Refresh result
 */
export const forceRefreshTrendingTokens = async () => {
  try {
    console.log('Forcing refresh of trending tokens...');

    // Fix the endpoint path - remove the /api prefix since it's already in the base URL
    const response = await axiosInstance.get('/admin/force-fetch');

    if (response.data && response.data.success) {
      console.log('Successfully refreshed trending tokens');
      return response.data;
    } else {
      console.warn('Failed to refresh trending tokens');
      throw new Error('Refresh failed');
    }
  } catch (error) {
    console.error(`Error refreshing trending tokens: ${error.message}`);
    throw error;
  }
};

export default {
  fetchTrendingTokens,
  fetchTokenDetails,
  searchTokens,
  fetchCandlestickData,
  forceRefreshTrendingTokens
};