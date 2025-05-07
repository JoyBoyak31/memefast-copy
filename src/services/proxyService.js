// src/services/corsProxyService.js

/**
 * A service to help with CORS issues when making requests to external APIs
 * from a browser environment. This is especially useful during development.
 */

/**
 * List of available public CORS proxies
 * @type {string[]}
 */
const PUBLIC_CORS_PROXIES = [
    'https://corsproxy.io/?',
    'https://cors-anywhere.herokuapp.com/',
    'https://api.allorigins.win/raw?url=',
    'https://cors-proxy.htmldriven.com/?url='
  ];
  
  /**
   * Creates a proxied URL to bypass CORS restrictions
   * @param {string} url - The URL to proxy
   * @returns {string} - The proxied URL
   */
  export const createProxiedUrl = (url) => {
    // Use the first proxy by default
    const proxyUrl = PUBLIC_CORS_PROXIES[0];
    return `${proxyUrl}${encodeURIComponent(url)}`;
  };
  
  /**
   * Makes a fetch request through a CORS proxy
   * @param {string} url - The URL to fetch
   * @param {Object} options - Fetch options
   * @returns {Promise<Response>} - The fetch response
   */
  export const fetchWithProxy = async (url, options = {}) => {
    // Try each proxy in order until one works
    for (const proxy of PUBLIC_CORS_PROXIES) {
      try {
        const proxiedUrl = `${proxy}${encodeURIComponent(url)}`;
        console.log(`Attempting fetch with proxy: ${proxy}`);
        
        const response = await fetch(proxiedUrl, options);
        
        if (response.ok) {
          console.log(`Successfully fetched with proxy: ${proxy}`);
          return response;
        }
      } catch (error) {
        console.warn(`Proxy ${proxy} failed: ${error.message}`);
        // Continue to the next proxy
      }
    }
    
    // If all proxies fail, throw an error
    throw new Error('All CORS proxies failed');
  };
  
  /**
   * Fetches JSON data through a CORS proxy
   * @param {string} url - The URL to fetch
   * @param {Object} options - Fetch options
   * @returns {Promise<any>} - The parsed JSON data
   */
  export const fetchJsonWithProxy = async (url, options = {}) => {
    const response = await fetchWithProxy(url, options);
    return await response.json();
  };
  
  export default {
    createProxiedUrl,
    fetchWithProxy,
    fetchJsonWithProxy
  };