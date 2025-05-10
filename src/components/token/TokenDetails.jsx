// src/components/token/TokenDetails.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CopyTokenButton from './CopyTokenButton';
import TokenPriceChart from './TokenPriceChart';

const TokenDetails = () => {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { tokenAddress } = useParams();
  const navigate = useNavigate();

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

  // Format percent changes
  const formatPercent = (percent) => {
    if (percent === undefined || percent === null) return 'N/A';
    
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
  };

  // Determine CSS class for price change
  const getPriceChangeClass = (percent) => {
    if (percent === undefined || percent === null) return '';
    return percent >= 0 ? 'price-up' : 'price-down';
  };

  // Shorten address for display
  const shortenAddress = (address) => {
    if (!address) return 'N/A';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Fetch token details when component mounts
  useEffect(() => {
    const fetchTokenDetails = async () => {
      if (!tokenAddress) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Updated API URL to use the unified server
        const apiUrl = 'http://localhost:5000';
        const response = await fetch(`${apiUrl}/api/coins/${tokenAddress}`);
        
        if (!response.ok) {
          throw new Error(`API returned status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Fetched token details:', data);
        setToken(data);
      } catch (err) {
        console.error('Error fetching token details:', err);
        setError('Failed to load token details. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchTokenDetails();
  }, [tokenAddress]);

  // Loading state
  if (loading) {
    return (
      <div className="token-details-loading">
        <div className="loading-spinner"></div>
        <p>Loading token details...</p>
        
        <style jsx>{`
          .token-details-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px;
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
      <div className="token-details-error">
        <h3>Error</h3>
        <p>{error}</p>
        <button onClick={() => navigate('/')} className="back-button">
          &larr; Back to Token List
        </button>
        
        <style jsx>{`
          .token-details-error {
            padding: 40px;
            text-align: center;
            max-width: 600px;
            margin: 0 auto;
          }
          
          .back-button {
            background: none;
            border: none;
            color: #3b82f6;
            padding: 8px 16px;
            font-weight: 500;
            cursor: pointer;
            margin-top: 16px;
          }
        `}</style>
      </div>
    );
  }

  // If token data isn't loaded yet
  if (!token) {
    return null;
  }

  // Get bonding curve data if available
  const bondingCurve = token.bondingCurve || {};
  const metadata = token.metadata || {};
  const social = metadata.social || {};

  return (
    <div className="token-details-container">
      <button onClick={() => navigate('/')} className="back-button">
        &larr; Back to Token List
      </button>
      
      <div className="token-details">
        <div className="token-details-header">
          <div className="token-logo-large">
            {token.image ? (
              <img 
                src={token.image || metadata.imageUrl} 
                alt={token.name} 
                onError={(e) => {
                  // Fallback to a default image
                  e.target.src = 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png';
                }}
              />
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
              <span className="token-address" title={token.address || token.mint}>
                Address: {shortenAddress(token.address || token.mint)}
              </span>
            </div>
            <div className="token-price-large">
              ${formatPrice(token.price || bondingCurve.spotPrice)}
              
              {token.priceChange24h !== undefined && (
                <span className={`token-price-change ${getPriceChangeClass(token.priceChange24h)}`}>
                  {formatPercent(token.priceChange24h)}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="token-details-body">
          {/* Price Chart */}
          <div className="token-chart-container">
            <h3>Price Chart</h3>
            <TokenPriceChart tokenAddress={token.address || token.mint} />
          </div>
          
          {/* Token Stats */}
          <div className="token-stats-section">
            <h3>Token Statistics</h3>
            <div className="token-stats-grid">
              <div className="token-stat-card">
                <h4>Market Cap</h4>
                <div className="token-stat-value">${formatNumber(token.marketCap)}</div>
              </div>
              
              <div className="token-stat-card">
                <h4>24h Volume</h4>
                <div className="token-stat-value">${formatNumber(token.volume24h)}</div>
                
                {token.volumeChange24h !== undefined && (
                  <div className={`token-stat-change ${getPriceChangeClass(token.volumeChange24h)}`}>
                    {formatPercent(token.volumeChange24h)}
                  </div>
                )}
              </div>
              
              {token.supply !== undefined && (
                <div className="token-stat-card">
                  <h4>Supply</h4>
                  <div className="token-stat-value">{formatNumber(token.supply)}</div>
                </div>
              )}
              
              {token.holders !== undefined && (
                <div className="token-stat-card">
                  <h4>Holders</h4>
                  <div className="token-stat-value">{formatNumber(token.holders)}</div>
                </div>
              )}
              
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
          </div>
          
          {/* Token Description */}
          {metadata.description && (
            <div className="token-description">
              <h3>Description</h3>
              <p>{metadata.description}</p>
            </div>
          )}
          
          {/* Social Links */}
          {social && Object.keys(social).length > 0 && (
            <div className="token-social-links">
              <h3>Social Links</h3>
              <div className="social-links-grid">
                {social.twitter && (
                  <a 
                    href={social.twitter} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="social-link twitter"
                  >
                    Twitter
                  </a>
                )}
                {social.website && (
                  <a 
                    href={social.website}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="social-link website"
                  >
                    Website
                  </a>
                )}
                {social.telegram && (
                  <a 
                    href={social.telegram}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="social-link telegram"
                  >
                    Telegram
                  </a>
                )}
                {social.discord && (
                  <a 
                    href={social.discord}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="social-link discord"
                  >
                    Discord
                  </a>
                )}
              </div>
            </div>
          )}
          
          {/* Copy Token Section */}
          <div className="token-copy-section">
            <h3>Copy This Token</h3>
            <p>Create your own version of this token with similar parameters.</p>
            <CopyTokenButton 
              token={token} 
              onSuccess={(address) => console.log('Token copied successfully:', address)} 
            />
          </div>
        </div>

        <style jsx>{`
          .token-details-container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 24px;
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
          
          .token-details {
            background: #fff;
            border-radius: 16px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
            overflow: hidden;
          }
          
          .token-details-header {
            display: flex;
            align-items: center;
            padding: 24px;
            border-bottom: 1px solid #e5e7eb;
            background: #f9fafb;
          }
          
          .token-logo-large {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            overflow: hidden;
            margin-right: 24px;
            background: #f3f4f6;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
          }
          
          .token-logo-large img {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
          
          .token-logo-placeholder-large {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            font-weight: bold;
            color: #6b7280;
            background: #e5e7eb;
          }
          
          .token-info {
            flex: 1;
          }
          
          .token-name {
            margin: 0 0 8px 0;
            font-size: 28px;
            font-weight: 700;
            color: #111827;
          }
          
          .token-symbol-container {
            display: flex;
            align-items: center;
            margin-bottom: 8px;
          }
          
          .token-symbol-large {
            font-size: 18px;
            font-weight: 600;
            color: #6b7280;
            margin-right: 16px;
          }
          
          .token-address {
            font-size: 14px;
            color: #9ca3af;
          }
          
          .token-price-large {
            font-size: 24px;
            font-weight: 700;
            color: #111827;
            display: flex;
            align-items: center;
          }
          
          .token-price-change {
            font-size: 16px;
            font-weight: 600;
            margin-left: 12px;
          }
          
          .price-up {
            color: #10b981;
          }
          
          .price-down {
            color: #ef4444;
          }
          
          .token-details-body {
            padding: 24px;
            display: flex;
            flex-direction: column;
            gap: 32px;
          }
          
          .token-chart-container {
            width: 100%;
          }
          
          h3 {
            margin: 0 0 16px 0;
            font-size: 20px;
            font-weight: 600;
            color: #111827;
          }
          
          .token-stats-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
          }
          
          @media (min-width: 768px) {
            .token-stats-grid {
              grid-template-columns: repeat(3, 1fr);
            }
          }
          
          .token-stat-card {
            background: #f9fafb;
            border-radius: 8px;
            padding: 16px;
          }
          
          h4 {
            margin: 0 0 8px 0;
            font-size: 14px;
            font-weight: 500;
            color: #6b7280;
          }
          
          .token-stat-value {
            font-size: 18px;
            font-weight: 600;
            color: #111827;
          }
          
          .token-stat-change {
            font-size: 14px;
            font-weight: 500;
            margin-top: 4px;
          }
          
          .token-description {
            background: #f9fafb;
            border-radius: 8px;
            padding: 16px;
          }
          
          .token-description p {
            margin: 0;
            color: #4b5563;
            line-height: 1.5;
          }
          
          .social-links-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
          }
          
          .social-link {
            display: inline-flex;
            align-items: center;
            background: #f3f4f6;
            border-radius: 20px;
            padding: 8px 16px;
            color: #4b5563;
            text-decoration: none;
            font-weight: 500;
            transition: background-color 0.2s;
          }
          
          .social-link:hover {
            background: #e5e7eb;
          }
          
          .social-link.twitter {
            background: #e0f2fe;
            color: #0369a1;
          }
          
          .social-link.twitter:hover {
            background: #bae6fd;
          }
          
          .social-link.website {
            background: #f0fdf4;
            color: #166534;
          }
          
          .social-link.website:hover {
            background: #dcfce7;
          }
          
          .social-link.telegram {
            background: #eff6ff;
            color: #1e40af;
          }
          
          .social-link.telegram:hover {
            background: #dbeafe;
          }
          
          .social-link.discord {
            background: #f5f3ff;
            color: #5b21b6;
          }
          
          .social-link.discord:hover {
            background: #ede9fe;
          }
          
          .token-copy-section {
            background: #f9fafb;
            border-radius: 8px;
            padding: 16px;
          }
          
          .token-copy-section p {
            margin: 0 0 16px 0;
            color: #4b5563;
          }
        `}</style>
      </div>
    </div>
  );
};

export default TokenDetails;