// src/components/token/TokenDetails.jsx
import React from 'react';
import CopyTokenButton from './CopyTokenButton';
import '../styles/tokens.css';

const TokenDetails = ({ token, details, loading }) => {
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

  // Shorten address for display
  const shortenAddress = (address) => {
    if (!address) return 'N/A';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (loading) {
    return (
      <div className="token-details-loading">
        <div className="loading-spinner"></div>
        <p>Loading token details...</p>
      </div>
    );
  }

  // Get bonding curve data if available
  const bondingCurve = details?.bondingCurve || {};
  const metadata = details?.metadata || {};

  return (
    <div className="token-details">
      <div className="token-details-header">
        <div className="token-logo-large">
          {token.image ? (
            <img src={token.image || metadata.imageUrl} alt={token.name} />
          ) : (
            <div className="token-logo-placeholder-large">
              {token.symbol?.charAt(0) || '?'}
            </div>
          )}
        </div>
        
        <div className="token-info">
          <h2 className="token-name">{token.name || metadata.name || 'Unknown Token'}</h2>
          <div className="token-symbol-container">
            <span className="token-symbol-large">{token.symbol || metadata.symbol || '???'}</span>
            <span className="token-address" title={token.address}>
              Address: {shortenAddress(token.address)}
            </span>
          </div>
          <div className="token-price-large">
            ${formatPrice(token.price || bondingCurve.spotPrice)}
          </div>
        </div>
      </div>
      
      <div className="token-details-body">
        <div className="token-stats-grid">
          <div className="token-stat-card">
            <h4>Market Cap</h4>
            <div className="token-stat-value">${formatNumber(token.marketCap)}</div>
          </div>
          
          <div className="token-stat-card">
            <h4>24h Volume</h4>
            <div className="token-stat-value">${formatNumber(token.volume24h)}</div>
          </div>
          
          {bondingCurve.liquidity && (
            <div className="token-stat-card">
              <h4>Liquidity</h4>
              <div className="token-stat-value">${formatNumber(bondingCurve.liquidity)}</div>
            </div>
          )}
          
          {bondingCurve.delta && (
            <div className="token-stat-card">
              <h4>Bonding Curve Delta</h4>
              <div className="token-stat-value">{formatNumber(bondingCurve.delta, 6)}</div>
            </div>
          )}
          
          {bondingCurve.fee && (
            <div className="token-stat-card">
              <h4>Fee</h4>
              <div className="token-stat-value">{(bondingCurve.fee * 100).toFixed(2)}%</div>
            </div>
          )}
        </div>
        
        {metadata.description && (
          <div className="token-description">
            <h3>Description</h3>
            <p>{metadata.description}</p>
          </div>
        )}
        
        <div className="token-copy-section">
          <h3>Copy This Token</h3>
          <p>Create your own version of this token with similar parameters.</p>
          <CopyTokenButton 
            token={details || token} 
            onSuccess={(address) => console.log('Token copied successfully:', address)} 
          />
        </div>
      </div>
    </div>
  );
};

export default TokenDetails;