// src/components/TokenCopy.jsx
import React, { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { createToken } from '../utils/solana';
import { fetchTrendingTokens, fetchTokenDetails } from '../utils/pumpFunAPI';

function TokenCopy() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [fetchingTokens, setFetchingTokens] = useState(false);

  // Fetch trending tokens when component mounts
  useEffect(() => {
    const loadTrendingTokens = async () => {
      try {
        setFetchingTokens(true);
        const trendingTokens = await fetchTrendingTokens(10);
        setTokens(trendingTokens);
      } catch (error) {
        console.error('Error loading trending tokens:', error);
      } finally {
        setFetchingTokens(false);
      }
    };

    loadTrendingTokens();
  }, []);

  // Handle token selection
  const handleSelectToken = async (token) => {
    try {
      setLoading(true);
      // Fetch detailed token information
      const tokenDetails = await fetchTokenDetails(token.mintAddress);
      setSelectedToken(tokenDetails);
    } catch (error) {
      console.error('Error fetching token details:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle token copy
  const handleCopyToken = async () => {
    if (!publicKey || !signTransaction || !selectedToken) {
      alert('Please connect your wallet and select a token first!');
      return;
    }

    try {
      setLoading(true);
      setResult(null);

      // Call the token creation function with the selected token's parameters
      const tokenAddress = await createToken(
        connection,
        publicKey,
        signTransaction,
        selectedToken.name,
        selectedToken.symbol,
        selectedToken.supply,
        selectedToken.decimals || 9
      );

      setResult({
        success: true,
        message: 'Token copied successfully!',
        tokenAddress
      });
    } catch (error) {
      console.error('Error creating token:', error);
      setResult({
        success: false,
        message: `Error: ${error.message || 'Unknown error'}`
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="token-copy" style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h2>Copy Token from Pump.fun</h2>
      
      {/* Token List */}
      <div className="token-list" style={{ marginTop: '20px' }}>
        <h3>Trending Tokens</h3>
        
        {fetchingTokens ? (
          <p>Loading trending tokens...</p>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
            gap: '15px',
            marginTop: '15px'
          }}>
            {tokens.map((token) => (
              <div 
                key={token.mintAddress}
                onClick={() => handleSelectToken(token)}
                style={{
                  border: selectedToken && selectedToken.mintAddress === token.mintAddress 
                    ? '2px solid #4CAF50' 
                    : '1px solid #ddd',
                  borderRadius: '8px',
                  padding: '12px',
                  cursor: 'pointer',
                  background: 'white'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  {token.image ? (
                    <img 
                      src={token.image} 
                      alt={token.name} 
                      style={{ width: '32px', height: '32px', borderRadius: '50%', marginRight: '8px' }}
                    />
                  ) : (
                    <div style={{ 
                      width: '32px', 
                      height: '32px', 
                      borderRadius: '50%', 
                      background: '#f0f0f0',
                      marginRight: '8px'
                    }}></div>
                  )}
                  <div>
                    <p style={{ fontWeight: 'bold', margin: '0' }}>{token.name}</p>
                    <p style={{ 
                      margin: '0', 
                      fontSize: '12px', 
                      background: '#f0f0f0', 
                      display: 'inline-block',
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}>{token.symbol}</p>
                  </div>
                </div>
                <p style={{ margin: '4px 0', fontSize: '14px' }}>
                  Price: ${Number(token.price).toFixed(6)}
                </p>
                <p style={{ margin: '4px 0', fontSize: '14px' }}>
                  Vol 24h: ${Number(token.volume24h || 0).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Selected Token Details */}
      {selectedToken && (
        <div style={{ 
          marginTop: '30px', 
          padding: '20px', 
          border: '1px solid #ddd', 
          borderRadius: '8px',
          background: '#f9f9f9' 
        }}>
          <h3>Selected Token</h3>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
            {selectedToken.image ? (
              <img 
                src={selectedToken.image} 
                alt={selectedToken.name} 
                style={{ width: '48px', height: '48px', borderRadius: '50%', marginRight: '12px' }}
              />
            ) : (
              <div style={{ 
                width: '48px', 
                height: '48px', 
                borderRadius: '50%', 
                background: '#f0f0f0',
                marginRight: '12px'
              }}></div>
            )}
            <div>
              <h4 style={{ margin: '0' }}>{selectedToken.name}</h4>
              <p style={{ 
                margin: '4px 0 0 0', 
                fontSize: '14px', 
                background: '#e0e0e0', 
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: '4px'
              }}>{selectedToken.symbol}</p>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <p><strong>Mint Address:</strong></p>
              <p style={{ 
                wordBreak: 'break-all', 
                fontSize: '14px', 
                background: '#e8e8e8',
                padding: '6px',
                borderRadius: '4px'
              }}>
                {selectedToken.mintAddress}
              </p>
            </div>
            <div>
              <p><strong>Supply:</strong> {Number(selectedToken.supply).toLocaleString()}</p>
              <p><strong>Decimals:</strong> {selectedToken.decimals || 9}</p>
              <p><strong>Price:</strong> ${Number(selectedToken.price).toFixed(6)}</p>
              <p><strong>Market Cap:</strong> ${Number(selectedToken.marketCap || 0).toLocaleString()}</p>
            </div>
          </div>
          
          <button 
            onClick={handleCopyToken} 
            disabled={loading || !publicKey}
            style={{ 
              padding: '12px 24px', 
              background: loading ? '#ccc' : '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '20px',
              width: '100%',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            {loading ? 'Creating Token Copy...' : 'Copy This Token'}
          </button>
        </div>
      )}
      
      {/* Result Message */}
      {result && (
        <div style={{
          marginTop: '30px',
          padding: '15px',
          borderRadius: '8px',
          background: result.success ? '#E8F5E9' : '#FFEBEE',
          border: `1px solid ${result.success ? '#A5D6A7' : '#FFCDD2'}`
        }}>
          <p style={{ fontWeight: 'bold', fontSize: '18px' }}>{result.message}</p>
          {result.tokenAddress && (
            <div>
              <p>Token Address:</p>
              <code style={{ 
                display: 'block',
                wordBreak: 'break-all',
                background: '#f0f0f0',
                padding: '8px',
                borderRadius: '4px',
                marginTop: '8px'
              }}>{result.tokenAddress}</code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TokenCopy;