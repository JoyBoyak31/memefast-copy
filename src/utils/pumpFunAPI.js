// src/utils/pumpFunAPI.js
import axios from 'axios';

// Base URL for PumpPortal API (unofficial Pump.fun API)
const API_BASE_URL = 'https://api.pump.fun/api';

/**
 * Fetch trending tokens from Pump.fun
 * @param {number} limit - Number of tokens to fetch
 * @returns {Promise<Array>} - Array of token data
 */
export const fetchTrendingTokens = async (limit = 20) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/tokens/trending`, {
      params: { limit }
    });
    return response.data.data || [];
  } catch (error) {
    console.error('Error fetching trending tokens:', error);
    throw new Error('Failed to fetch trending tokens');
  }
};

/**
 * Fetch token details by address
 * @param {string} address - Token address
 * @returns {Promise<Object>} - Token details
 */
export const fetchTokenDetails = async (address) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/tokens/${address}`);
    return response.data.data || null;
  } catch (error) {
    console.error(`Error fetching token details for ${address}:`, error);
    throw new Error('Failed to fetch token details');
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
    const response = await axios.get(`${API_BASE_URL}/tokens/search`, {
      params: { q: query, limit }
    });
    return response.data.data || [];
  } catch (error) {
    console.error('Error searching tokens:', error);
    throw new Error('Failed to search tokens');
  }
};

export default {
  fetchTrendingTokens,
  fetchTokenDetails,
  searchTokens
};