// src/utils/websocketService.js
/**
 * WebSocket service for real-time updates from Pump.fun via local proxy
 * Optimized for market cap updates with reduced refresh timers
 * Focuses on low-latency market data without token refresh
 */
import { io } from 'socket.io-client';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.listeners = {
      tokenUpdate: [],
      tradeUpdate: [],
      connectionStatus: [],
      newToken: []
    };
    this.watchedTokens = new Set();
    
    // Configure socket.io URL
    this.socketUrl = 'http://localhost:5001'; // Use the dedicated WebSocket proxy port
    
    // Update frequency configuration - reduced for better performance
    this.updateFrequency = 1500; // 1.5 seconds between updates for faster market cap changes
  }

  /**
   * Connect to the WebSocket server
   */
  connect() {
    if (this.socket) {
      this.disconnect();
    }

    console.log('Connecting to WebSocket proxy server...');
    this.notifyConnectionStatusListeners('connecting');

    // Create Socket.IO connection with configuration
    this.socket = io(this.socketUrl, {
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    // Set up event handlers
    this.socket.on('connect', this.handleOpen.bind(this));
    this.socket.on('disconnect', this.handleClose.bind(this));
    this.socket.on('connect_error', this.handleError.bind(this));
    
    // Listen for Pump.fun messages relayed through our proxy
    this.socket.on('pumpMessage', this.handlePumpMessage.bind(this));
    
    // Listen for connection status updates from the proxy
    this.socket.on('connectionStatus', this.handleConnectionStatus.bind(this));
  }

  /**
   * Handle socket connection open event
   */
  handleOpen() {
    console.log('Connected to WebSocket proxy server');
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.notifyConnectionStatusListeners('connected');

    // Resubscribe to any previously watched tokens
    this.resubscribeToTokens();
  }

  /**
   * Handle proxy server connection status updates
   */
  handleConnectionStatus(data) {
    console.log('Pump.fun connection status:', data.status);
    
    // If we have a URL in the status, log it
    if (data.url) {
      console.log('Using WebSocket URL:', data.url);
    }
    
    // Forward the pump.fun status to our listeners
    this.notifyConnectionStatusListeners(data.status);
  }

  /**
   * Handle incoming messages from Pump.fun (via proxy)
   */
  handlePumpMessage(message) {
    try {
      console.log('WebSocket message received:', 
                 message.type || 'unknown type', 
                 message.mint || message.trade?.mint || '');
      
      // Process different message types
      if (message.type === 'tradeUpdate' || (message.trade && message.txType)) {
        this.notifyTradeUpdateListeners(message);
      } else if (message.type === 'tokenUpdate' || (message.token && message.token.mint)) {
        this.notifyTokenUpdateListeners(message);
      } else if (message.type === 'newToken' || message.token?.created_timestamp) {
        // New token was created
        console.log('New token created:', message.token?.name || 'Unknown Token');
        this.notifyNewTokenListeners(message);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  /**
   * Handle socket connection close event
   */
  handleClose() {
    console.log('Disconnected from WebSocket proxy server');
    this.isConnected = false;
    this.notifyConnectionStatusListeners('disconnected');
  }

  /**
   * Handle socket error events
   */
  handleError(error) {
    console.error('WebSocket error:', error);
    this.notifyConnectionStatusListeners('error');
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.isConnected = false;
    this.notifyConnectionStatusListeners('disconnected');
  }

  /**
   * Watch a specific token for updates
   */
  watchToken(tokenAddress) {
    if (!tokenAddress) return;
    
    // Add to our set of watched tokens
    this.watchedTokens.add(tokenAddress);

    // If we're already connected, subscribe immediately
    if (this.isConnected && this.socket) {
      this.socket.emit('watchToken', tokenAddress);
      console.log(`Watching token: ${tokenAddress}`);
    }
  }

  /**
   * Stop watching a token
   */
  unwatchToken(tokenAddress) {
    if (!tokenAddress) return;

    // Remove from our set of watched tokens
    this.watchedTokens.delete(tokenAddress);

    // If we're connected, unsubscribe
    if (this.isConnected && this.socket) {
      this.socket.emit('unwatchToken', tokenAddress);
      console.log(`Unwatching token: ${tokenAddress}`);
    }
  }

  /**
   * Resubscribe to all watched tokens
   */
  resubscribeToTokens() {
    if (!this.isConnected || !this.socket || this.watchedTokens.size === 0) return;

    // Resubscribe to each token
    for (const tokenAddress of this.watchedTokens) {
      this.socket.emit('watchToken', tokenAddress);
    }
    
    console.log(`Resubscribed to ${this.watchedTokens.size} tokens`);
  }

  /**
   * Manual reconnection method
   */
  reconnect() {
    console.log('Manually reconnecting...');
    
    if (this.socket) {
      // Tell the proxy server to reconnect to Pump.fun
      this.socket.emit('reconnect');
    } else {
      // If we don't have a socket, create a new connection
      this.connect();
    }
  }

  /**
   * Add a listener for token updates
   */
  addTokenUpdateListener(callback) {
    if (typeof callback === 'function') {
      this.listeners.tokenUpdate.push(callback);
    }
  }

  /**
   * Remove a token update listener
   */
  removeTokenUpdateListener(callback) {
    this.listeners.tokenUpdate = this.listeners.tokenUpdate.filter(cb => cb !== callback);
  }

  /**
   * Add a listener for trade updates
   */
  addTradeUpdateListener(callback) {
    if (typeof callback === 'function') {
      this.listeners.tradeUpdate.push(callback);
    }
  }

  /**
   * Remove a trade update listener
   */
  removeTradeUpdateListener(callback) {
    this.listeners.tradeUpdate = this.listeners.tradeUpdate.filter(cb => cb !== callback);
  }

  /**
   * Add a listener for new token events
   */
  addNewTokenListener(callback) {
    if (typeof callback === 'function') {
      this.listeners.newToken.push(callback);
    }
  }

  /**
   * Remove a new token listener
   */
  removeNewTokenListener(callback) {
    this.listeners.newToken = this.listeners.newToken.filter(cb => cb !== callback);
  }

  /**
   * Add a listener for connection status updates
   */
  addConnectionStatusListener(callback) {
    if (typeof callback === 'function') {
      this.listeners.connectionStatus.push(callback);
    }
  }

  /**
   * Remove a connection status listener
   */
  removeConnectionStatusListener(callback) {
    this.listeners.connectionStatus = this.listeners.connectionStatus.filter(cb => cb !== callback);
  }

  /**
   * Notify all token update listeners
   */
  notifyTokenUpdateListeners(data) {
    this.listeners.tokenUpdate.forEach(callback => {
      try {
        callback(data.token || data);
      } catch (error) {
        console.error('Error in token update listener:', error);
      }
    });
  }

  /**
   * Notify all trade update listeners
   */
  notifyTradeUpdateListeners(data) {
    this.listeners.tradeUpdate.forEach(callback => {
      try {
        callback(data.trade || data);
      } catch (error) {
        console.error('Error in trade update listener:', error);
      }
    });
  }

  /**
   * Notify all new token listeners
   */
  notifyNewTokenListeners(data) {
    this.listeners.newToken.forEach(callback => {
      try {
        callback(data.token || data);
      } catch (error) {
        console.error('Error in new token listener:', error);
      }
    });
  }

  /**
   * Notify all connection status listeners
   */
  notifyConnectionStatusListeners(status) {
    this.listeners.connectionStatus.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('Error in connection status listener:', error);
      }
    });
  }
}

// Create a singleton instance
const websocketService = new WebSocketService();

export default websocketService;