// src/components/token/CopyTokenButton.jsx
import React, { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';

const CopyTokenButton = ({ token, onSuccess, onError }) => {
  const { connection } = useConnection();
  const { publicKey, signTransaction, connected } = useWallet();
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // Handle token copy
  const handleCopyToken = async () => {
    if (!connected || !publicKey || !signTransaction) {
      alert('Please connect your wallet first!');
      return;
    }

    try {
      setLoading(true);
      setResult(null);

      // For demo purposes, we'll just log the token parameters
      // and simulate a successful token creation
      console.log('Creating token with parameters:', {
        name: token.name,
        symbol: token.symbol,
        initialSupply: 1000000,
        decimals: 9,
        bondingCurve: token.bondingCurve
      });
      
      // Simulate token creation delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate a mock token address
      const mockTokenAddress = `${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
      
      // Set success result
      setResult({
        success: true,
        message: 'Token copied successfully!',
        tokenAddress: mockTokenAddress
      });
      
      // Call onSuccess callback
      if (onSuccess) {
        onSuccess(mockTokenAddress);
      }
    } catch (error) {
      console.error('Error creating token:', error);
      
      // Set error result
      setResult({
        success: false,
        message: `Error: ${error.message || 'Unknown error'}`
      });
      
      // Call onError callback
      if (onError) {
        onError(error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="copy-token-button-container">
      <button 
        className={`copy-token-button ${loading ? 'loading' : ''}`}
        onClick={handleCopyToken}
        disabled={loading || !connected}
      >
        {loading ? 'Creating Token...' : 'Copy This Token'}
      </button>
      
      {!connected && (
        <div className="copy-token-notice">
          <p>Connect your wallet to copy this token</p>
        </div>
      )}
      
      {result && (
        <div className={`copy-token-result ${result.success ? 'success' : 'error'}`}>
          <h4>{result.message}</h4>
          {result.success && result.tokenAddress && (
            <div className="token-address-display">
              <p>Token Address:</p>
              <code>{result.tokenAddress}</code>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CopyTokenButton;