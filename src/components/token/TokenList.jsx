// src/components/token/TokenList.jsx
import React, { useState, useEffect } from 'react';
import { fetchTrendingTokens, fetchTokenDetails } from '../../utils/pumpFunAPI';
import TokenCard from './TokenCard';
import TokenDetails from './TokenDetails';
import '../styles/tokens.css';

const TokenList = () => {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedToken, setSelectedToken] = useState(null);
  const [selectedTokenDetails, setSelectedTokenDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Fetch trending tokens on component mount
  useEffect(() => {
    const loadTrendingTokens = async () => {
      try {
        setLoading(true);
        setError(null);
        const trendingTokens = await fetchTrendingTokens(12);
        setTokens(Array.isArray(trendingTokens) ? trendingTokens : []);
      } catch (err) {
        console.error('Error loading trending tokens:', err);
        setError('Failed to load trending tokens. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadTrendingTokens();
  }, []);

  // Fetch token details when a token is selected
  useEffect(() => {
    if (!selectedToken) {
      setSelectedTokenDetails(null);
      return;
    }

    const loadTokenDetails = async () => {
      try {
        setDetailsLoading(true);
        const details = await fetchTokenDetails(selectedToken.address);
        setSelectedTokenDetails(details);
      } catch (err) {
        console.error('Error loading token details:', err);
      } finally {
        setDetailsLoading(false);
      }
    };

    loadTokenDetails();
  }, [selectedToken]);

  // Handle token selection
  const handleSelectToken = (token) => {
    setSelectedToken(token);
  };

  // Clear selected token
  const handleClearSelection = () => {
    setSelectedToken(null);
    setSelectedTokenDetails(null);
  };

  if (loading) {
    return (
      <div className="token-list-loading">
        <div className="loading-spinner"></div>
        <p>Loading trending tokens from Pump.fun...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="token-list-error">
        <h3>Error</h3>
        <p>{error}</p>
        <button onClick={() => window.location.reload()} className="retry-button">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="token-list-container">
      {!selectedToken ? (
        <>
          <h2>Trending Tokens on Pump.fun</h2>
          <div className="token-grid">
            {tokens.length === 0 ? (
              <p>No trending tokens found.</p>
            ) : (
              tokens.map((token) => (
                <TokenCard
                  key={token.address}
                  token={token}
                  onClick={() => handleSelectToken(token)}
                />
              ))
            )}
          </div>
        </>
      ) : (
        <div className="token-details-container">
          <button onClick={handleClearSelection} className="back-button">
            &larr; Back to Trending Tokens
          </button>
          <TokenDetails 
            token={selectedToken} 
            details={selectedTokenDetails}
            loading={detailsLoading} 
          />
        </div>
      )}
    </div>
  );
};

export default TokenList;