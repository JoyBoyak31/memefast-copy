// src/components/token/TokenCard.jsx - Optimized for market cap updates
import React, { useState, useEffect, useRef } from 'react';
import websocketService from '../../utils/websocketService';

const LiveTokenCard = ({ token, onClick, layout = 'grid' }) => {
  // Local state to manage token data that will update in real-time
  const [tokenData, setTokenData] = useState(token);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [flashAnimation, setFlashAnimation] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [updateCount, setUpdateCount] = useState(0); // Track number of updates

  // Refs to track previous values for visual feedback
  const prevMarketCapRef = useRef(token.marketCap || token.usd_market_cap);
  const prevPriceRef = useRef(token.price);

  // Setup WebSocket subscription when the component mounts
  useEffect(() => {
    if (!token || !token.mint) return;

    const handleTokenUpdate = (data) => {
      // Check if this update is for our token
      if (data.mint === token.mint) {
        console.log('📊 Token update received:', token.name, data);

        // Update the token data with the new information
        setTokenData(prevData => {
          const updatedData = {
            ...prevData,
            ...data,
            // Calculate price from bonding curve or reserves if available
            price: calculatePrice(data) || prevData.price,
            // Extract market cap from the appropriate field
            marketCap: data.usd_market_cap || data.market_cap || prevData.marketCap
          };

          // Check if market cap or price has changed
          if (prevMarketCapRef.current !== updatedData.marketCap ||
            prevPriceRef.current !== updatedData.price) {
            // Trigger flash animation for visual feedback
            setFlashAnimation(true);

            // Update refs
            prevMarketCapRef.current = updatedData.marketCap;
            prevPriceRef.current = updatedData.price;

            // Increment update counter
            setUpdateCount(prev => prev + 1);
          }

          return updatedData;
        });

        // Update the timestamp
        setLastUpdate(new Date());
        setIsLive(true);
      }
    };

    const handleTradeUpdate = (data) => {
      // Both real trade updates and simulated ones might come through here
      // Check if this trade is for our token
      if (data.mint === token.mint) {
        console.log('💰 Trade update received:', token.name, data);

        setTokenData(prevData => {
          const updatedData = { ...prevData };

          // Update market cap if present
          if (data.market_cap || data.usd_market_cap) {
            updatedData.marketCap = data.usd_market_cap || data.market_cap;
            prevMarketCapRef.current = updatedData.marketCap;
            setFlashAnimation(true);
          }

          // Update reserves and calculate new price if available
          if (data.virtual_sol_reserves !== undefined &&
            data.virtual_token_reserves !== undefined) {
            updatedData.virtual_sol_reserves = data.virtual_sol_reserves;
            updatedData.virtual_token_reserves = data.virtual_token_reserves;

            // Calculate new price
            const newPrice = calculatePrice(updatedData);
            if (newPrice && newPrice !== prevData.price) {
              updatedData.price = newPrice;
              prevPriceRef.current = newPrice;
              setFlashAnimation(true);
            }
          }

          // Increment update counter
          setUpdateCount(prev => prev + 1);

          return updatedData;
        });

        // Update the timestamp
        setLastUpdate(new Date());
        setIsLive(true);
      }
    };

    // Add listeners for updates
    websocketService.addTokenUpdateListener(handleTokenUpdate);
    websocketService.addTradeUpdateListener(handleTradeUpdate);

    // Start watching this token
    websocketService.watchToken(token.mint);

    // Connect if not already connected
    if (!websocketService.isConnected) {
      websocketService.connect();
    }

    // Log that we're watching this token
    console.log(`🔍 Now watching token: ${token.name} (${token.mint})`);

    // Cleanup on unmount
    return () => {
      websocketService.removeTokenUpdateListener(handleTokenUpdate);
      websocketService.removeTradeUpdateListener(handleTradeUpdate);
      websocketService.unwatchToken(token.mint);
      console.log(`⏹️ Stopped watching token: ${token.name}`);
    };
  }, [token]);

  // Add this useEffect hook for single token refresh (keep this one)
  useEffect(() => {
    if (!token || !token.mint) return;

    // Function to refresh token data from REST API
    const refreshTokenData = async () => {
      try {
        // Import your fetchTokenDetails function from your API service 
        // or use inline fetch if you prefer
        const response = await fetch(`http://localhost:5000/api/coins/${token.mint}`);
        const updatedToken = await response.json();

        if (updatedToken) {
          console.log('📊 Refreshed token data:', token.name);

          // Update the token data with the new information
          setTokenData(prevData => {
            const newData = { ...prevData, ...updatedToken };

            // Check if market cap or price has changed
            const newMarketCap = updatedToken.marketCap || updatedToken.usd_market_cap || updatedToken.market_cap;
            const newPrice = updatedToken.price || calculatePrice(updatedToken);

            if (prevMarketCapRef.current !== newMarketCap ||
              prevPriceRef.current !== newPrice) {
              // Trigger flash animation for visual feedback
              setFlashAnimation(true);

              // Update refs
              prevMarketCapRef.current = newMarketCap;
              prevPriceRef.current = newPrice;

              // Update the timestamp
              setLastUpdate(new Date());
            }

            return newData;
          });
        }
      } catch (error) {
        console.error('Error refreshing token data:', error);
      }
    };

    // Reduced refresh timer from 15 seconds to 5 seconds
    const intervalId = setInterval(refreshTokenData, 5000);

    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, [token.mint]);

  // Reset flash animation after it plays
  useEffect(() => {
    if (flashAnimation) {
      const timer = setTimeout(() => {
        setFlashAnimation(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [flashAnimation]);

  // Calculate price from bonding curve if available
  const calculatePrice = (tokenData) => {
    if (!tokenData) return null;

    // Try to get price from bonding curve
    if (tokenData.bonding_curve && tokenData.bonding_curve.spot_price) {
      return tokenData.bonding_curve.spot_price;
    }

    // Try to calculate from reserves
    if (tokenData.virtual_sol_reserves &&
      tokenData.virtual_token_reserves &&
      tokenData.virtual_token_reserves > 0) {
      return tokenData.virtual_sol_reserves / tokenData.virtual_token_reserves;
    }

    return null;
  };

  // Format number with commas and limit decimal places
  const formatNumber = (number, decimals = 2) => {
    // If number is undefined, null, or NaN, return N/A
    if (number === undefined || number === null || isNaN(number)) {
      return 'N/A';
    }

    // If number is 0, just return 0
    if (number === 0) {
      return '0';
    }

    // Check if it's a non-finite number
    if (!isFinite(number)) {
      return 'N/A';
    }

    // For very large numbers, use K, M, B, T abbreviations
    if (number >= 1e12) return (number / 1e12).toFixed(decimals) + 'T';
    if (number >= 1e9) return (number / 1e9).toFixed(decimals) + 'B';
    if (number >= 1e6) return (number / 1e6).toFixed(decimals) + 'M';
    if (number >= 1e3) return (number / 1e3).toFixed(decimals) + 'K';

    // For regular numbers
    return number.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  // Format price with appropriate decimal places based on size
  const formatPrice = (price) => {
    // Check if price is invalid
    if (price === undefined || price === null || isNaN(price)) {
      return 'N/A';
    }

    // Check if price is 0
    if (price === 0) {
      return '$0.00';
    }

    // Check if price is non-finite
    if (!isFinite(price)) {
      return 'N/A';
    }

    // For very small prices, show scientific notation
    if (price < 0.00001) {
      return '$' + price.toExponential(2);
    }

    // For small prices, show more decimal places
    if (price < 0.01) {
      return '$' + price.toLocaleString(undefined, {
        minimumFractionDigits: 6,
        maximumFractionDigits: 6
      });
    }

    // For larger prices, show fewer decimal places
    return '$' + price.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    });
  };

  // Make sure we have a token with data
  if (!tokenData) return null;

  // Get price and market cap
  const price = tokenData.price || calculatePrice(tokenData);
  const marketCap = tokenData.marketCap || tokenData.usd_market_cap || tokenData.market_cap;
  const imageUrl = tokenData.image_uri || tokenData.image || tokenData.logo;
  const supply = tokenData.total_supply || tokenData.supply;

  // Use grid or list layout based on prop
  return (
    <div
      className={`token-card ${layout}-layout ${lastUpdate ? 'updated' : ''} ${flashAnimation ? 'highlight-animation' : ''}`}
      onClick={onClick}
    >
      {lastUpdate && (
        <div className="live-update-indicator">
          <span className="pulse"></span>
          <span className="update-time">
            Updated {lastUpdate.toLocaleTimeString()}
            {updateCount > 0 && <span className="update-count">{updateCount}</span>}
            {isLive && <span className="live-badge">LIVE</span>}
          </span>
        </div>
      )}

      <div className="token-card-header">
        <div className="token-logo">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={tokenData.name || 'Token'}
              onError={(e) => {
                // Fallback to a placeholder with token symbol
                e.target.style.display = 'none';
                e.target.parentNode.classList.add('token-logo-placeholder');
                e.target.parentNode.textContent = (tokenData.symbol || '?').charAt(0) || '?';
              }}
            />
          ) : (
            <div className="token-logo-placeholder">
              {(tokenData.symbol || '?').charAt(0) || '?'}
            </div>
          )}
        </div>
        <div className="token-name-container">
          <h3 className="token-name">{tokenData.name || 'Unknown Token'}</h3>
          <span className="token-symbol">{tokenData.symbol || '???'}</span>
        </div>

        {/* Keep the refresh button for individual token refresh */}
        <button
          className="refresh-token-button"
          onClick={(e) => {
            e.stopPropagation(); // Prevent card click

            // Call your refresh function
            const refreshTokenData = async () => {
              try {
                const response = await fetch(`http://localhost:5000/api/coins/${token.mint}`);
                const updatedToken = await response.json();

                if (updatedToken) {
                  setTokenData(prev => ({ ...prev, ...updatedToken }));
                  setFlashAnimation(true);
                  setLastUpdate(new Date());
                  console.log('Manual refresh completed for:', token.name);
                }
              } catch (error) {
                console.error('Error refreshing token:', error);
              }
            };

            refreshTokenData();
          }}
          title="Refresh token data"
        >
          🔄
        </button>
      </div>

      <div className="token-card-body">
        <div className="token-stat">
          <span className="token-stat-label">Price</span>
          <span className="token-price">{formatPrice(price)}</span>
        </div>

        <div className="token-stat">
          <span className="token-stat-label">24h Change</span>
          <span className="token-price-change">
            N/A
          </span>
        </div>

        <div className="token-stat">
          <span className="token-stat-label">24h Volume</span>
          <span className="token-volume">N/A</span>
        </div>

        <div className="token-stat">
          <span className="token-stat-label">Market Cap</span>
          <span className="token-market-cap">${formatNumber(marketCap || 0)}</span>
        </div>

        <div className="token-stat">
          <span className="token-stat-label">Supply</span>
          <span className="token-supply">{formatNumber(supply || 0, 0)}</span>
        </div>
      </div>

      <div className="token-card-footer">
        <button className="view-details-button">Copy Token</button>
      </div>

      {/* CSS for the token card */}
      <style jsx>{`
        .token-card {
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          padding: 16px;
          transition: transform 0.2s, box-shadow 0.2s, background-color 0.3s;
          cursor: pointer;
          margin-bottom: 16px;
          position: relative;
          overflow: hidden;
        }
        
        .token-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
        }
        
        .refresh-token-button {
          background: none;
          border: none;
          font-size: 16px;
          padding: 4px;
          margin-left: 8px;
          cursor: pointer;
          opacity: 0.5;
          transition: opacity 0.2s;
          border-radius: 50%;
        }

        .refresh-token-button:hover {
          opacity: 1;
          background-color: #f3f4f6;
        }
        
        .token-card.updated {
          animation: highlight 2s ease-out;
        }
        
        .token-card.highlight-animation {
          animation: highlight 2s ease-out;
        }
        
        @keyframes highlight {
          0% { background-color: rgba(59, 130, 246, 0.2); }
          100% { background-color: #fff; }
        }
        
        .live-update-indicator {
          position: absolute;
          top: 8px;
          right: 8px;
          display: flex;
          align-items: center;
          font-size: 10px;
          color: #3b82f6;
        }
        
        .pulse {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: #3b82f6;
          margin-right: 4px;
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.4; }
          100% { opacity: 1; }
        }
        
        .update-time {
          opacity: 0.7;
          font-size: 10px;
          display: flex;
          align-items: center;
        }
        
        .update-count {
          background-color: #3b82f6;
          color: white;
          border-radius: 50%;
          width: 16px;
          height: 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          margin-left: 4px;
          font-weight: bold;
        }
        
        .live-badge {
          margin-left: 4px;
          background-color: #ef4444;
          color: white;
          font-size: 8px;
          padding: 2px 4px;
          border-radius: 4px;
          font-weight: bold;
        }
        
        .token-card.grid-layout {
          display: flex;
          flex-direction: column;
        }
        
        .token-card.list-layout {
          display: grid;
          grid-template-columns: auto 1fr auto;
          grid-template-areas: 
            "header body footer";
          align-items: center;
          gap: 16px;
        }
        
        .token-card.list-layout .token-card-header {
          grid-area: header;
          margin-bottom: 0;
        }
        
        .token-card.list-layout .token-card-body {
          grid-area: body;
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 0;
        }
        
        .token-card.list-layout .token-card-footer {
          grid-area: footer;
        }
        
        .token-card-header {
          display: flex;
          align-items: center;
          margin-bottom: 12px;
          position: relative;
        }
        
        .force-update-button {
          position: absolute;
          top: -5px;
          right: -5px;
          background: none;
          border: none;
          font-size: 16px;
          cursor: pointer;
          opacity: 0.5;
          transition: opacity 0.2s;
          padding: 5px;
        }
        
        .force-update-button:hover {
          opacity: 1;
        }
        
        .token-logo {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          overflow: hidden;
          margin-right: 12px;
          background: #f3f4f6;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        
        .token-logo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          position: absolute;
          top: 0;
          left: 0;
        }
        
        .token-logo-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 20px;
          color: #6b7280;
          background: #e5e7eb;
        }
        
        .token-name-container {
          flex: 1;
          min-width: 0; /* Allow text truncation */
        }
        
        .token-name {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #111827;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .token-symbol {
          font-size: 14px;
          color: #6b7280;
        }
        
        .token-card-body {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 16px;
        }
        
        .token-stat {
          display: flex;
          flex-direction: column;
        }
        
        .token-stat-label {
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 2px;
        }
        
        .token-price, .token-volume, .token-market-cap, .token-supply, .token-holders {
          font-weight: 600;
          color: #111827;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .token-price-change {
          font-weight: 600;
        }
        
        .price-up {
          color: #10b981;
        }
        
        .price-down {
          color: #ef4444;
        }
        
        .token-card-footer {
          display: flex;
          justify-content: center;
        }
        
        .view-details-button {
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 8px 16px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .view-details-button:hover {
          background: #2563eb;
        }
        
        @media (max-width: 768px) {
          .token-card.list-layout {
            grid-template-columns: 1fr;
            grid-template-areas: 
              "header"
              "body"
              "footer";
          }
          
          .token-card-body {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default LiveTokenCard;