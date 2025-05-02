// src/components/TokenCopy.jsx
import React, { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';

function TokenCopy() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  // Use mock data for now until API integration works
  const mockTokens = [
    {
      address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      name: 'Solana',
      symbol: 'SOL',
      image: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
      price: 0.0025,
      volume24h: 15000
    },
    {
      address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
      name: 'Example Token',
      symbol: 'EX',
      price: 0.00043,
      volume24h: 22000
    }
  ];
  
  const [tokens, setTokens] = useState(mockTokens);
  const [selectedToken, setSelectedToken] = useState(null);

  // Handle token selection
  const handleSelectToken = (token) => {
    setSelectedToken(token);
  };

  // Simple stub for token creation - replace with actual implementation later
  const handleCopyToken = async () => {
    if (!publicKey || !selectedToken) {
      alert('Please connect your wallet and select a token first!');
      return;
    }

    try {
      setLoading(true);
      setResult(null);
      
      // Simulate token creation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setResult({
        success: true,
        message: 'Token copied successfully!',
        tokenAddress: `${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`
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
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h2>Copy Token from Pump.fun</h2>
      
      {/* Token List */}
      <div>
        <h3>Trending Tokens</h3>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
          gap: '15px',
          marginTop: '15px'
        }}>
          {tokens.map((token, index) => (
            <div 
              key={token.address || `token-${index}`}
              onClick={() => handleSelectToken(token)}
              style={{
                border: selectedToken && selectedToken.address === token.address 
                  ? '2px solid #4CAF50' 
                  : '1px solid #ddd',
                borderRadius: '8px',
                padding: '12px',
                cursor: 'pointer',
                background: 'white'
              }}
            >
              <p style={{ fontWeight: 'bold', margin: '0' }}>{token.name || 'Unknown Token'}</p>
              <p style={{ 
                margin: '4px 0', 
                fontSize: '12px', 
                background: '#f0f0f0', 
                display: 'inline-block',
                padding: '2px 6px',
                borderRadius: '4px'
              }}>{token.symbol || '???'}</p>
              
              {token.price && (
                <p style={{ margin: '4px 0', fontSize: '14px' }}>
                  Price: ${Number(token.price).toFixed(6)}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Selected Token */}
      {selectedToken && (
        <div style={{ 
          marginTop: '30px', 
          padding: '20px', 
          border: '1px solid #ddd', 
          borderRadius: '8px',
          background: '#f9f9f9' 
        }}>
          <h3>Selected Token</h3>
          <p><strong>Name:</strong> {selectedToken.name}</p>
          <p><strong>Symbol:</strong> {selectedToken.symbol}</p>
          {selectedToken.price && (
            <p><strong>Price:</strong> ${Number(selectedToken.price).toFixed(6)}</p>
          )}
          
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