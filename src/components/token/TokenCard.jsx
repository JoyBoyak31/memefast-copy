// src/components/token/TokenCard.jsx
import React from 'react';
import '../styles/tokens.css';

const TokenCard = ({ token, onClick }) => {
  // Format number with commas and limit decimal places
  const formatNumber = (number, decimals = 2) => {
    if (number === undefined || number === null) return 'N/A';
    return number.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  // Format price with more decimal places
  const formatPrice = (price) => {
    if (price === undefined || price === null) return 'N/A';
    
    // For very small prices, show more decimal places
    if (price < 0.0001) {
      return price.toExponential(4);
    }
    
    return price.toLocaleString(undefined, {
      minimumFractionDigits: 6,
      maximumFractionDigits: 6
    });
  };

  return (
    <div className="token-card" onClick={onClick}>
      <div className="token-card-header">
        <div className="token-logo">
          {token.image ? (
            <img src={token.image} alt={token.name} />
          ) : (
            <div className="token-logo-placeholder">
              {token.symbol?.charAt(0) || '?'}
            </div>
          )}
        </div>
        <div className="token-name-container">
          <h3 className="token-name">{token.name || 'Unknown Token'}</h3>
          <span className="token-symbol">{token.symbol || '???'}</span>
        </div>
      </div>
      
      <div className="token-card-body">
        <div className="token-stat">
          <span className="token-stat-label">Price</span>
          <span className="token-price">${formatPrice(token.price)}</span>
        </div>
        
        <div className="token-stat">
          <span className="token-stat-label">24h Volume</span>
          <span className="token-volume">${formatNumber(token.volume24h)}</span>
        </div>
        
        {token.marketCap && (
          <div className="token-stat">
            <span className="token-stat-label">Market Cap</span>
            <span className="token-market-cap">${formatNumber(token.marketCap)}</span>
          </div>
        )}
      </div>
      
      <div className="token-card-footer">
        <button className="view-details-button">View Details</button>
      </div>
    </div>
  );
};

export default TokenCard;