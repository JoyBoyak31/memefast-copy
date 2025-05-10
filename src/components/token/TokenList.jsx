// src/components/token/TokenList.jsx - Simplified version for React Router
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchTrendingTokens,
  searchTokens,
  forceRefreshTrendingTokens
} from '../../utils/pumpFunAPI';
import LiveTokenCard from './TokenCard';
import TokenSearchBar from './TokenSearchBar';
import RefreshButton from './RefreshButton';
import websocketService from '../../utils/websocketService';

const TokenList = () => {
  // Add navigate from React Router
  const navigate = useNavigate();

  // State management
  const [tokens, setTokens] = useState([]);
  const [filteredTokens, setFilteredTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshStatus, setRefreshStatus] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [newTokenCount, setNewTokenCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pagination and layout
  const [currentPage, setCurrentPage] = useState(1);
  const [tokensPerPage, setTokensPerPage] = useState(12);
  const [layoutMode, setLayoutMode] = useState('grid'); // 'grid' or 'list'

  // Function to load trending tokens - wrapped with useCallback to use in dependencies
  const loadTrendingTokens = useCallback(async (showLoadingState = true) => {
    try {
      if (showLoadingState) {
        setLoading(true);
      } else {
        setIsRefreshing(true); // Show a lighter-weight refresh indicator
      }

      setError(null);

      console.log('Fetching trending tokens...');
      const trendingTokens = await fetchTrendingTokens(48); // Fetch more tokens for pagination

      console.log(`Received ${trendingTokens.length} trending tokens`);
      setTokens(trendingTokens);

      // Only update filtered tokens if not currently searching
      if (!searchQuery) {
        setFilteredTokens(trendingTokens);
      }

      setCurrentPage(1); // Reset to first page
      setRefreshStatus({
        type: 'success',
        message: `${showLoadingState ? 'Tokens loaded' : 'Tokens refreshed'} successfully`
      });
      setNewTokenCount(0); // Reset new token count after refresh
    } catch (err) {
      console.error('Error loading trending tokens:', err);
      setError('Failed to load trending tokens. Please try again later.');
      setRefreshStatus({ type: 'error', message: `Error: ${err.message}` });
    } finally {
      if (showLoadingState) {
        setLoading(false);
      } else {
        setIsRefreshing(false);
      }
      setLastRefreshed(new Date());

      // Auto-clear refresh status after 3 seconds
      setTimeout(() => {
        setRefreshStatus(null);
      }, 3000);
    }
  }, [searchQuery]);

  // Set up WebSocket connection when component mounts
  useEffect(() => {
    // Handle WebSocket connection status changes
    const handleConnectionStatus = (status) => {
      setConnectionStatus(status);

      if (status === 'connected') {
        setRefreshStatus({
          type: 'success',
          message: 'Connected to live updates'
        });
      } else if (status === 'disconnected') {
        setRefreshStatus({
          type: 'warning',
          message: 'Disconnected from live updates'
        });
      } else if (status === 'error') {
        setRefreshStatus({
          type: 'error',
          message: 'Error connecting to live updates'
        });
      }

      // Auto-clear refresh status after 3 seconds
      setTimeout(() => {
        setRefreshStatus(null);
      }, 3000);
    };

    // Listen for token creation events
    const handleNewToken = (data) => {
      if (data.token) {
        // Add new token to our list if it's not already there
        setTokens(prevTokens => {
          // Check if token already exists
          if (prevTokens.some(t => t.mint === data.token.mint)) {
            return prevTokens;
          }

          // Add new token to beginning of list
          const updatedTokens = [data.token, ...prevTokens];

          // If searching, also update filtered tokens
          if (searchQuery) {
            const lowercaseQuery = searchQuery.toLowerCase();
            if (
              data.token.name.toLowerCase().includes(lowercaseQuery) ||
              data.token.symbol.toLowerCase().includes(lowercaseQuery)
            ) {
              setFilteredTokens(prev => [data.token, ...prev]);
            }
          } else {
            setFilteredTokens(updatedTokens);
          }

          // Increment new token count
          setNewTokenCount(prev => prev + 1);

          // Show notification
          setRefreshStatus({
            type: 'info',
            message: `New token created: ${data.token.name} (${data.token.symbol})`
          });

          return updatedTokens;
        });
      }
    };

    // Add listeners
    websocketService.addConnectionStatusListener(handleConnectionStatus);
    websocketService.addNewTokenListener(handleNewToken);

    // Connect to WebSocket
    websocketService.connect();

    // Cleanup when component unmounts
    return () => {
      websocketService.removeConnectionStatusListener(handleConnectionStatus);
      websocketService.removeNewTokenListener(handleNewToken);
      websocketService.disconnect();
    };
  }, [searchQuery]);

  // Fetch trending tokens on component mount
  useEffect(() => {
    loadTrendingTokens();
  }, [loadTrendingTokens]);

  // Navigate to token details page when a token is selected
  const handleSelectToken = (token) => {
    console.log('Selected token:', token);
    navigate(`/token/${token.mint || token.address}`);
  };

  // Handle manual refresh
  const handleRefresh = async () => {
    try {
      setRefreshStatus({ type: 'info', message: 'Refreshing tokens...' });
      setIsRefreshing(true);

      // Force refresh from API
      const result = await forceRefreshTrendingTokens();

      if (result.success) {
        // Reload tokens after successful force refresh
        await loadTrendingTokens(false);
        setRefreshStatus({
          type: 'success',
          message: `Refreshed ${result.source === 'direct' ? 'directly from Pump.fun' : 'via proxy'}`
        });
      } else {
        setRefreshStatus({
          type: 'warning',
          message: 'Refresh attempted, using cached data'
        });
      }
    } catch (error) {
      console.error('Error during refresh:', error);
      setRefreshStatus({ type: 'error', message: `Error: ${error.message}` });

      // Try to load from cache anyway
      loadTrendingTokens(false);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle WebSocket reconnection
  const handleReconnectWebSocket = () => {
    setRefreshStatus({ type: 'info', message: 'Reconnecting to WebSocket...' });
    websocketService.reconnect();
  };

  // Handle search
  const handleSearch = async (query) => {
    setSearchQuery(query);

    if (!query) {
      setIsSearching(false);
      setFilteredTokens(tokens);
      setCurrentPage(1); // Reset to first page when clearing search
      return;
    }

    setIsSearching(true);

    try {
      console.log(`Searching for tokens with query: ${query}`);
      const results = await searchTokens(query);
      console.log(`Search returned ${results.length} results`);

      setFilteredTokens(results);
    } catch (err) {
      console.error('Error searching tokens:', err);

      // Fallback to client-side filtering if API search fails
      console.log('Falling back to client-side filtering');
      const filtered = tokens.filter(token =>
        token.name.toLowerCase().includes(query.toLowerCase()) ||
        token.symbol.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredTokens(filtered);
    } finally {
      setIsSearching(false);
      setCurrentPage(1); // Reset to first page when search completes
    }
  };

  // Toggle layout mode between grid and list
  const toggleLayoutMode = () => {
    setLayoutMode(layoutMode === 'grid' ? 'list' : 'grid');
  };

  // Handle pagination
  const totalPages = Math.ceil(filteredTokens.length / tokensPerPage);

  const goToPage = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);

    // Scroll to top when changing pages
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Get current page tokens
  const indexOfLastToken = currentPage * tokensPerPage;
  const indexOfFirstToken = indexOfLastToken - tokensPerPage;
  const currentTokens = filteredTokens.slice(indexOfFirstToken, indexOfLastToken);

  // Pagination component
  const Pagination = () => {
    if (totalPages <= 1) return null;

    return (
      <div className="pagination">
        <button
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
          className="pagination-button"
        >
          Previous
        </button>

        <div className="pagination-info">
          Page {currentPage} of {totalPages}
        </div>

        <button
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="pagination-button"
        >
          Next
        </button>
      </div>
    );
  };

  // Format date for display
  const formatRefreshTime = (date) => {
    if (!date) return 'Never';

    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="token-list-loading">
        <div className="loading-spinner"></div>
        <p>Loading trending tokens from Pump.fun...</p>

        <style jsx>{`
          .token-list-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 100px 20px;
            text-align: center;
          }
          
          .loading-spinner {
            border: 4px solid rgba(0, 0, 0, 0.1);
            border-left-color: #3b82f6;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin-bottom: 16px;
          }
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="token-list-error">
        <h3>Error Loading Tokens</h3>
        <p>{error}</p>
        <button onClick={() => loadTrendingTokens()} className="retry-button">
          Try Again
        </button>

        <style jsx>{`
          .token-list-error {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 60px 20px;
            text-align: center;
            background: #fee2e2;
            border-radius: 8px;
            margin: 20px;
          }
          
          h3 {
            color: #b91c1c;
            margin-bottom: 12px;
          }
          
          p {
            color: #7f1d1d;
            margin-bottom: 16px;
          }
          
          .retry-button {
            background: #b91c1c;
            color: white;
            border: none;
            border-radius: 6px;
            padding: 8px 16px;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s;
          }
          
          .retry-button:hover {
            background: #991b1b;
          }
        `}</style>
      </div>
    );
  }

  // Simplified return statement - just the token list view
  return (
    <div className="token-list-container">
      <div className="token-list-header">
        <div className="title-section">
          <h2>Trending Tokens on Pump.fun</h2>
          {newTokenCount > 0 && (
            <span className="new-token-badge">
              {newTokenCount} new {newTokenCount === 1 ? 'token' : 'tokens'}
            </span>
          )}
        </div>

        <div className="token-list-actions">
          <RefreshButton onRefresh={handleRefresh} />

          <div className={`connection-status ${connectionStatus}`}>
            <span className="status-dot"></span>
            <span className="status-text">
              {connectionStatus === 'connected' ? 'Live Updates' :
                connectionStatus === 'connecting' ? 'Connecting...' :
                  'Updates Offline'}
            </span>
            {connectionStatus !== 'connected' && (
              <button
                className="reconnect-button"
                onClick={handleReconnectWebSocket}
              >
                Reconnect
              </button>
            )}
          </div>

          <button
            className="layout-toggle-button"
            onClick={toggleLayoutMode}
            title={layoutMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
          >
            {layoutMode === 'grid' ? '📋 List' : '📊 Grid'}
          </button>
        </div>
      </div>

      {refreshStatus && (
        <div className={`refresh-status ${refreshStatus.type}`}>
          {refreshStatus.message}
        </div>
      )}

      <div className="refresh-controls">
        <div className="refresh-info">
          <div className="last-refreshed">
            Last refreshed: {formatRefreshTime(lastRefreshed)}
          </div>
          {connectionStatus === 'connected' && (
            <div className="auto-update-info">
              Live market cap updates enabled
            </div>
          )}
        </div>
      </div>

      <TokenSearchBar onSearch={handleSearch} />

      {isRefreshing && (
        <div className="refreshing-indicator">
          <div className="loading-spinner-small"></div>
          <span>Refreshing tokens...</span>
        </div>
      )}

      {isSearching ? (
        <div className="token-list-searching">
          <div className="loading-spinner"></div>
          <p>Searching tokens...</p>
        </div>
      ) : (
        <>
          {filteredTokens.length === 0 ? (
            <div className="no-tokens-message">
              {searchQuery ?
                <p>No tokens found matching "{searchQuery}"</p> :
                <p>No trending tokens found. Try refreshing the data.</p>
              }
            </div>
          ) : (
            <>
              <div className={`token-${layoutMode}`}>
                {currentTokens.map((token) => (
                  <LiveTokenCard
                    key={token.mint || token.address}
                    token={token}
                    onClick={() => handleSelectToken(token)}
                    layout={layoutMode}
                  />
                ))}
              </div>

              <Pagination />
            </>
          )}
        </>
      )}

      <style jsx>{`
        .token-list-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px;
        }
        
        .token-list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          flex-wrap: wrap;
          gap: 16px;
        }
        
        .title-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        h2 {
          margin: 0;
          font-size: 28px;
          color: #111827;
        }
        
        .new-token-badge {
          background-color: #ef4444;
          color: white;
          font-size: 12px;
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 20px;
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.7; }
          100% { opacity: 1; }
        }
        
        .token-list-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .connection-status {
          display: flex;
          align-items: center;
          font-size: 12px;
          padding: 4px 10px;
          border-radius: 12px;
          white-space: nowrap;
        }
        
        .connection-status.connected {
          background-color: #d1fae5;
          color: #065f46;
        }
        
        .connection-status.connecting {
          background-color: #fef3c7;
          color: #92400e;
        }
        
        .connection-status.disconnected,
        .connection-status.error {
          background-color: #fee2e2;
          color: #b91c1c;
        }
        
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-right: 6px;
        }
        
        .connected .status-dot {
          background-color: #10b981;
        }
        
        .connecting .status-dot {
          background-color: #f59e0b;
          animation: pulse 1.5s infinite;
        }
        
        .disconnected .status-dot,
        .error .status-dot {
          background-color: #ef4444;
        }
        
        .reconnect-button {
          margin-left: 8px;
          padding: 2px 6px;
          font-size: 11px;
          background-color: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .reconnect-button:hover {
          background-color: #f3f4f6;
        }
        
        .layout-toggle-button {
          background-color: #f3f4f6;
          color: #4b5563;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 8px 16px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .layout-toggle-button:hover {
          background-color: #e5e7eb;
        }
        
        .refresh-status {
          margin: 8px 0 16px;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 14px;
        }
        
        .refresh-status.success {
          background-color: #d1fae5;
          color: #065f46;
          border: 1px solid #a7f3d0;
        }
        
        .refresh-status.error {
          background-color: #fee2e2;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }
        
        .refresh-status.info {
          background-color: #e0f2fe;
          color: #0369a1;
          border: 1px solid #bae6fd;
        }
        
        .refresh-status.warning {
          background-color: #fff7ed;
          color: #c2410c;
          border: 1px solid #fed7aa;
        }
        
        .refresh-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 16px 0;
          padding: 8px 16px;
          background-color: #f9fafb;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }
        
        .auto-refresh-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .auto-refresh-toggle label {
          display: flex;
          align-items: center;
          cursor: pointer;
          gap: 6px;
        }
        
        .refresh-interval-select {
          padding: 4px 8px;
          border-radius: 4px;
          border: 1px solid #d1d5db;
          background-color: white;
        }
        
        .refresh-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .last-refreshed {
          font-size: 14px;
          color: #6b7280;
        }
        
        .auto-refresh-active {
          background-color: #10b981;
          color: white;
          font-size: 12px;
          padding: 2px 6px;
          border-radius: 4px;
        }
        
        .auto-update-info {
          font-size: 14px;
          color: #065f46;
          display: flex;
          align-items: center;
        }
        
        .auto-update-info:before {
          content: '';
          display: inline-block;
          width: 6px;
          height: 6px;
          background-color: #10b981;
          border-radius: 50%;
          margin-right: 6px;
          animation: pulse 2s infinite;
        }
        
        .refreshing-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin: 12px 0;
          color: #6b7280;
          font-size: 14px;
        }
        
        .loading-spinner-small {
          border: 2px solid rgba(0, 0, 0, 0.1);
          border-left-color: #3b82f6;
          border-radius: 50%;
          width: 16px;
          height: 16px;
          animation: spin 1s linear infinite;
        }
        
        .token-list-searching {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 40px 0;
        }
        
        .token-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 24px;
          margin-top: 24px;
        }
        
        .token-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-top: 24px;
        }
        
        .no-tokens-message {
          text-align: center;
          padding: 60px 0;
          color: #6b7280;
        }
        
        .back-button {
          background: none;
          border: none;
          color: #3b82f6;
          font-weight: 500;
          padding: 0;
          margin-bottom: 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          transition: color 0.2s;
        }
        
        .back-button:hover {
          color: #2563eb;
        }
        
        .pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 32px;
          gap: 16px;
        }
        
        .pagination-button {
          background-color: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 8px 16px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .pagination-button:disabled {
          background-color: #e5e7eb;
          color: #9ca3af;
          cursor: not-allowed;
        }
        
        .pagination-button:not(:disabled):hover {
          background-color: #2563eb;
        }
        
        .pagination-info {
          font-size: 14px;
          color: #4b5563;
        }
        
        @media (max-width: 768px) {
          .token-list-header {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .token-list-actions {
            width: 100%;
            justify-content: space-between;
          }
          
          .token-grid {
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          }
          
          .refresh-controls,
          .refresh-info {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }
        }
        
        .loading-spinner {
          border: 4px solid rgba(0, 0, 0, 0.1);
          border-left-color: #3b82f6;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div >
  );
};

export default TokenList;